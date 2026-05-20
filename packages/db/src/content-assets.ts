import type { ContentAssetKind } from "../../shared/src/content.js";

export type {
  ContentAsset,
  ContentAssetKind,
} from "../../shared/src/content.js";

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
const editableImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const maxVideoBytes = 100 * 1024 * 1024;

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

export function isEditableImage(filename: string): boolean {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return editableImageExtensions.has(extension);
}

export function isSupportedMimeForKind(
  kind: ContentAssetKind,
  mimeType: string,
) {
  if (kind === "image") {
    return [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ].includes(mimeType);
  }

  if (kind === "video") {
    return ["video/mp4", "video/webm"].includes(mimeType);
  }

  if (kind === "text") {
    return [
      "text/plain",
      "text/markdown",
      "application/json",
      "text/plain; charset=utf-8",
      "text/markdown; charset=utf-8",
      "application/json; charset=utf-8",
    ].includes(mimeType);
  }

  return false;
}

export function assertVideoSize(size: number) {
  return size <= maxVideoBytes;
}
