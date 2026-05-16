import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createUniqueFilename,
  listContentAssets,
  sanitizeFilename,
} from "./content-server.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTempDirectory() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "open-growth-content-"),
  );
  tempDirectories.push(directory);
  return directory;
}

describe("content server helpers", () => {
  it("sanitizes unsafe filenames", () => {
    expect(sanitizeFilename("../../My File!!.png")).toBe("My-File.png");
    expect(sanitizeFilename("###.md")).toBe("asset.md");
  });

  it("creates unique filenames when collisions exist", async () => {
    const directory = await createTempDirectory();
    await writeFile(path.join(directory, "asset.png"), "existing");

    await expect(createUniqueFilename("asset.png", directory)).resolves.toBe(
      "asset-1.png",
    );
  });

  it("lists supported assets with text previews sorted by latest update", async () => {
    const directory = await createTempDirectory();
    await writeFile(
      path.join(directory, "older.md"),
      "first line\nsecond line",
    );
    await writeFile(path.join(directory, "latest.png"), "png");
    await writeFile(path.join(directory, "ignore.zip"), "zip");

    const assets = await listContentAssets(directory);

    expect(assets).toHaveLength(2);
    expect(assets[0]?.filename).toBe("latest.png");
    expect(assets[1]).toMatchObject({
      filename: "older.md",
      type: "text",
      preview: "first line\nsecond line",
    });
  });
});
