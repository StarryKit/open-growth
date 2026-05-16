import type { ContentAssetKind } from "../../../../packages/shared/src/content.js";

export type {
  ContentAsset,
  ContentAssetKind,
} from "../../../../packages/shared/src/content.js";

const imageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);
const videoExtensions = new Set([".mp4", ".webm"]);
const textExtensions = new Set([".txt", ".md", ".json"]);

export function getAssetType(filename: string): ContentAssetKind {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  if (imageExtensions.has(extension)) {
    return "image";
  }

  if (videoExtensions.has(extension)) {
    return "video";
  }

  if (textExtensions.has(extension)) {
    return "text";
  }

  return "other";
}

export function isSupportedAsset(filename: string): boolean {
  return getAssetType(filename) !== "other";
}
