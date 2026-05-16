import { createReadStream, promises as fs } from "node:fs";
import path, { extname } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import statik from "@fastify/static";
import Fastify from "fastify";
import { getAssetType, isSupportedAsset } from "./lib/content-assets.js";
import {
  createUniqueFilename,
  ensureContentDirectory,
  getContentFilePath,
  listContentAssets,
  sanitizeFilename,
} from "./lib/content-server.js";
import {
  createProject,
  deleteProject,
  getActiveProject,
  listProjects,
  setActiveProject,
} from "./lib/project-store.js";

const contentTypes = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(multipart);
  await app.register(statik, {
    root: path.resolve("../../dist/web"),
    prefix: "/",
  });

  app.get("/api/health", async () => {
    return { ok: true };
  });

  app.get("/api/projects", async (_request, reply) => {
    try {
      const [projects, activeProject] = await Promise.all([
        listProjects(),
        getActiveProject(),
      ]);

      return { projects, activeProject };
    } catch {
      return reply.code(500).send({ error: "Unable to read projects." });
    }
  });

  app.post<{ Body: { name?: string } }>(
    "/api/projects",
    async (request, reply) => {
      const name = request.body?.name?.trim();

      if (!name) {
        return reply.code(400).send({ error: "Project name is required." });
      }

      try {
        const project = await createProject({ name });
        return reply.code(201).send({ project });
      } catch {
        return reply.code(500).send({ error: "Unable to create project." });
      }
    },
  );

  app.delete<{ Querystring: { id?: string } }>(
    "/api/projects",
    async (request, reply) => {
      if (!request.query.id) {
        return reply.code(400).send({ error: "Project ID is required." });
      }

      try {
        const removed = await deleteProject(request.query.id);

        if (!removed) {
          return reply.code(404).send({ error: "Project not found." });
        }

        return { success: true };
      } catch {
        return reply.code(500).send({ error: "Unable to delete project." });
      }
    },
  );

  app.put<{ Body: { projectId?: string | null } }>(
    "/api/projects/active",
    async (request, reply) => {
      if (request.body?.projectId === undefined) {
        return reply.code(400).send({ error: "Project ID is required." });
      }

      try {
        const project = await setActiveProject(request.body.projectId ?? null);

        if (request.body.projectId && !project) {
          return reply.code(404).send({ error: "Project not found." });
        }

        return { project };
      } catch {
        return reply.code(500).send({ error: "Unable to switch project." });
      }
    },
  );

  app.get<{ Querystring: { filename?: string } }>(
    "/api/upload",
    async (request, reply) => {
      try {
        if (request.query.filename) {
          const safeFilename = sanitizeFilename(request.query.filename);
          const filePath = await getContentFilePath(safeFilename);
          const stats = await fs.stat(filePath);
          const extension = extname(safeFilename).toLowerCase();

          reply.header("Cache-Control", "no-store");
          reply.header("Content-Length", stats.size.toString());
          reply.header(
            "Content-Type",
            contentTypes.get(extension) ?? "application/octet-stream",
          );

          return reply.send(createReadStream(filePath));
        }

        const assets = await listContentAssets();
        return { assets };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return reply.code(404).send({ error: "File not found." });
        }

        return reply
          .code(500)
          .send({ error: "Unable to read content assets." });
      }
    },
  );

  app.post("/api/upload", async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({ error: "Missing file field." });
      }

      if (!isSupportedAsset(file.filename)) {
        return reply.code(400).send({ error: "Unsupported file type." });
      }

      const contentDirectory = await ensureContentDirectory();
      const filename = await createUniqueFilename(
        file.filename,
        contentDirectory,
      );
      const filePath = await getContentFilePath(filename, contentDirectory);
      const buffer = await file.toBuffer();

      await fs.writeFile(filePath, buffer);

      return {
        success: true,
        filename,
        path: `content/${filename}`,
        type: getAssetType(filename),
      };
    } catch {
      return reply.code(500).send({ error: "Unable to save uploaded file." });
    }
  });

  app.delete<{ Querystring: { filename?: string } }>(
    "/api/upload",
    async (request, reply) => {
      if (!request.query.filename) {
        return reply.code(400).send({ error: "Missing filename." });
      }

      try {
        const filePath = await getContentFilePath(request.query.filename);
        await fs.unlink(filePath);
        return { success: true };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return reply.code(404).send({ error: "File not found." });
        }

        return reply.code(500).send({ error: "Unable to delete file." });
      }
    },
  );

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found." });
    }

    return reply
      .type("text/html")
      .send(
        await fs.readFile(path.resolve("../../dist/web/index.html"), "utf8"),
      );
  });

  return app;
}
