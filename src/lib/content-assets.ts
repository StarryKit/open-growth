export type ContentAssetKind = "image" | "video" | "text" | "other";

export type ContentAsset = {
  filename: string;
  path: string;
  type: ContentAssetKind;
  size: number;
  updatedAt: string;
  preview?: string;
};

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
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
