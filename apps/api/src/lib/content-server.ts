import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentAsset } from "./content-assets.js";
import { getAssetType, isSupportedAsset } from "./content-assets.js";
import { getActiveProject } from "./project-store.js";

const fallbackContentDirectory = path.join(process.cwd(), "content");
const textPreviewLimit = 900;

export async function getContentDirectory(): Promise<string> {
  const activeProject = await getActiveProject();

  if (!activeProject) {
    return fallbackContentDirectory;
  }

  return path.join(activeProject.rootDir, "content");
}

export async function ensureContentDirectory(contentDirectory?: string) {
  const directory = contentDirectory ?? (await getContentDirectory());
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export function sanitizeFilename(filename: string): string {
  const parsedName = path.parse(path.basename(filename));
  const safeBase = parsedName.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeExtension = parsedName.ext.toLowerCase();

  return `${safeBase || "asset"}${safeExtension}`;
}

export async function getContentFilePath(
  filename: string,
  contentDirectory?: string,
): Promise<string> {
  const safeFilename = sanitizeFilename(filename);
  const directory = contentDirectory ?? (await getContentDirectory());
  return path.join(directory, safeFilename);
}

export async function createUniqueFilename(
  filename: string,
  contentDirectory?: string,
): Promise<string> {
  const safeFilename = sanitizeFilename(filename);
  const parsedName = path.parse(safeFilename);
  const directory = await ensureContentDirectory(contentDirectory);
  let candidate = safeFilename;
  let index = 1;

  while (true) {
    try {
      await fs.access(path.join(directory, candidate));
      candidate = `${parsedName.name}-${index}${parsedName.ext}`;
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function readTextPreview(
  filename: string,
  contentDirectory: string,
): Promise<string | undefined> {
  const filePath = await getContentFilePath(filename, contentDirectory);
  const content = await fs.readFile(filePath, "utf8");
  const previewLines = content
    .slice(0, textPreviewLimit)
    .split(/\r?\n/)
    .slice(0, 8);

  return previewLines.join("\n");
}

export async function listContentAssets(
  contentDirectory?: string,
): Promise<ContentAsset[]> {
  const directory = await ensureContentDirectory(contentDirectory);

  const directoryEntries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const assets = await Promise.all(
    directoryEntries
      .filter((entry) => entry.isFile() && isSupportedAsset(entry.name))
      .map(async (entry) => {
        const filename = entry.name;
        const filePath = await getContentFilePath(filename, directory);
        const stats = await fs.stat(filePath);
        const type = getAssetType(filename);

        return {
          filename,
          path: `content/${filename}`,
          type,
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          preview:
            type === "text"
              ? await readTextPreview(filename, directory)
              : undefined,
        } satisfies ContentAsset;
      }),
  );

  return assets.sort(
    (assetA: ContentAsset, assetB: ContentAsset) =>
      new Date(assetB.updatedAt).getTime() -
      new Date(assetA.updatedAt).getTime(),
  );
}
