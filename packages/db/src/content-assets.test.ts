import { describe, expect, it } from "vitest";
import {
  assertVideoSize,
  getAssetType,
  isEditableImage,
  isSupportedAsset,
  isSupportedMimeForKind,
} from "./content-assets.js";

describe("content asset helpers", () => {
  it("detects supported asset types", () => {
    expect(getAssetType("hero.png")).toBe("image");
    expect(getAssetType("clip.webm")).toBe("video");
    expect(getAssetType("notes.md")).toBe("text");
  });

  it("treats unknown extensions as unsupported", () => {
    expect(getAssetType("archive.zip")).toBe("other");
    expect(isSupportedAsset("archive.zip")).toBe(false);
    expect(isSupportedAsset("brief.json")).toBe(true);
  });

  it("validates editable image formats and MIME types", () => {
    expect(isEditableImage("hero.webp")).toBe(true);
    expect(isEditableImage("animation.gif")).toBe(false);
    expect(isEditableImage("logo.svg")).toBe(false);
    expect(isSupportedMimeForKind("image", "image/png")).toBe(true);
    expect(isSupportedMimeForKind("video", "image/png")).toBe(false);
  });

  it("limits video uploads to 100MB", () => {
    expect(assertVideoSize(100 * 1024 * 1024)).toBe(true);
    expect(assertVideoSize(100 * 1024 * 1024 + 1)).toBe(false);
  });
});
