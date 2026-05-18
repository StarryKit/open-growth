import { describe, expect, it } from "vitest";
import { getAssetType, isSupportedAsset } from "./content-assets.js";

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
});
