import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentAsset } from "@/lib/content-assets";
import { getAssetType, isSupportedAsset } from "@/lib/content-assets";

export const contentDirectory = path.resolve(process.cwd(), "content");

const textPreviewLimit = 900;

export async function ensureContentDirectory() {
  await fs.mkdir(contentDirectory, { recursive: true });
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

export function getContentFilePath(filename: string): string {
  const safeFilename = sanitizeFilename(filename);
  return path.join(contentDirectory, safeFilename);
}

export async function createUniqueFilename(filename: string): Promise<string> {
  const safeFilename = sanitizeFilename(filename);
  const parsedName = path.parse(safeFilename);
  let candidate = safeFilename;
  let index = 1;

  await ensureContentDirectory();

  while (true) {
    try {
      await fs.access(path.join(contentDirectory, candidate));
      candidate = `${parsedName.name}-${index}${parsedName.ext}`;
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function readTextPreview(filename: string): Promise<string | undefined> {
  const filePath = getContentFilePath(filename);
  const content = await fs.readFile(filePath, "utf8");
  const previewLines = content
    .slice(0, textPreviewLimit)
    .split(/\r?\n/)
    .slice(0, 8);

  return previewLines.join("\n");
}

export async function listContentAssets(): Promise<ContentAsset[]> {
  await ensureContentDirectory();

  const directoryEntries = await fs.readdir(contentDirectory, {
    withFileTypes: true,
  });

  const assets = await Promise.all(
    directoryEntries
      .filter((entry) => entry.isFile() && isSupportedAsset(entry.name))
      .map(async (entry) => {
        const filename = entry.name;
        const stats = await fs.stat(getContentFilePath(filename));
        const type = getAssetType(filename);

        return {
          filename,
          path: `content/${filename}`,
          type,
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          preview: type === "text" ? await readTextPreview(filename) : undefined,
        } satisfies ContentAsset;
      }),
  );

  return assets.sort(
    (assetA, assetB) =>
      new Date(assetB.updatedAt).getTime() - new Date(assetA.updatedAt).getTime(),
  );
}
