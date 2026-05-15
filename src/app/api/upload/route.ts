import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { NextRequest } from "next/server";
import {
  createUniqueFilename,
  ensureContentDirectory,
  getContentFilePath,
  listContentAssets,
  sanitizeFilename,
} from "@/lib/content-server";
import { getAssetType, isSupportedAsset } from "@/lib/content-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

async function readRequestFile(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename");

  if (!filename) {
    return null;
  }

  const safeFilename = sanitizeFilename(filename);
  const filePath = getContentFilePath(safeFilename);
  const stats = await fs.stat(filePath);
  const extension = extname(safeFilename).toLowerCase();
  const stream = createReadStream(filePath);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": stats.size.toString(),
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const fileResponse = await readRequestFile(request);

    if (fileResponse) {
      return fileResponse;
    }

    const assets = await listContentAssets();
    return Response.json({ assets });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    return Response.json({ error: "Unable to read content assets." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureContentDirectory();

    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return badRequest("Missing file field.");
    }

    if (!isSupportedAsset(uploadedFile.name)) {
      return badRequest("Unsupported file type.");
    }

    const filename = await createUniqueFilename(uploadedFile.name);
    const filePath = getContentFilePath(filename);
    const arrayBuffer = await uploadedFile.arrayBuffer();

    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    return Response.json({
      success: true,
      filename,
      path: `content/${filename}`,
      type: getAssetType(filename),
    });
  } catch {
    return Response.json({ error: "Unable to save uploaded file." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename");

  if (!filename) {
    return badRequest("Missing filename.");
  }

  try {
    await fs.unlink(getContentFilePath(filename));
    return Response.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    return Response.json({ error: "Unable to delete file." }, { status: 500 });
  }
}
