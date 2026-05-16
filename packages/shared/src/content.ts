export type ContentAssetKind = "image" | "video" | "text" | "other";

export type ContentAsset = {
  filename: string;
  path: string;
  type: ContentAssetKind;
  size: number;
  updatedAt: string;
  preview?: string;
};
