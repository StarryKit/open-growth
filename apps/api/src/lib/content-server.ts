import path from "node:path";

export function sanitizeFilename(filename: string): string {
  const parsedName = path.parse(path.basename(filename));
  const safeBase = parsedName.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeExtension = parsedName.ext.toLowerCase();

  return `${safeBase || "asset"}${safeExtension}`;
}
