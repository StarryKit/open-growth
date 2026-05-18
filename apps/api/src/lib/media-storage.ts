import { createHash, randomUUID } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ContentAssetKind } from "../../../../packages/shared/src/index.js";
import {
  createUniqueFilename,
  ensureContentDirectory,
  getContentFilePath,
  sanitizeFilename,
} from "./content-server.js";
import {
  markDatabaseContentAssetFailed,
  prepareDatabaseContentAssetUpload,
  type StoreContext,
} from "./database-store.js";
import { getActiveProject } from "./project-store.js";

export type StoredMediaObject = {
  assetId?: string;
  filename: string;
  path: string;
  bucket?: string;
  storagePath?: string;
  sha256?: string;
  size: number;
  type: ContentAssetKind;
  preview?: string;
};

type SaveMediaInput = {
  originalFilename: string;
  buffer: Buffer;
  type: ContentAssetKind;
  mimeType?: string;
  context?: StoreContext;
};

function supabaseStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "content-assets";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey, bucket };
}

export function isSupabaseStorageEnabled() {
  return Boolean(supabaseStorageConfig());
}

function textPreview(input: SaveMediaInput) {
  return input.type === "text"
    ? input.buffer.toString("utf8").slice(0, 900)
    : undefined;
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function saveMediaObject(
  input: SaveMediaInput,
): Promise<StoredMediaObject> {
  const config = supabaseStorageConfig();

  if (config) {
    const filename = sanitizeFilename(input.originalFilename);
    const prepared = await prepareDatabaseContentAssetUpload(
      {
        filename,
        storageBucket: config.bucket,
        mimeType: input.mimeType,
      },
      input.context,
    );
    const activeProject = prepared
      ? null
      : await getActiveProject(input.context);
    const workspaceId = prepared?.workspaceId ?? "workspace-local";
    const projectId =
      prepared?.projectId ??
      input.context?.activeProjectId ??
      activeProject?.id ??
      "default-project";
    const assetId = prepared?.assetId ?? randomUUID();
    const storagePath =
      prepared?.storagePath ??
      `${workspaceId}/${projectId}/${assetId}/${filename}`;
    const supabase = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error } = await supabase.storage
      .from(config.bucket)
      .upload(storagePath, input.buffer, {
        contentType: input.mimeType ?? "application/octet-stream",
        upsert: false,
      });

    if (error) {
      if (prepared?.assetId) {
        await markDatabaseContentAssetFailed(prepared.assetId, input.context);
      }
      throw error;
    }

    return {
      assetId: prepared?.assetId,
      filename,
      path: storagePath,
      bucket: config.bucket,
      storagePath,
      sha256: sha256(input.buffer),
      size: input.buffer.byteLength,
      type: input.type,
      preview: textPreview(input),
    };
  }

  const contentDirectory = await ensureContentDirectory();
  const filename = await createUniqueFilename(
    input.originalFilename,
    contentDirectory,
  );
  const filePath = await getContentFilePath(filename, contentDirectory);

  await fs.writeFile(filePath, input.buffer);

  return {
    filename,
    path: `content/${filename}`,
    size: input.buffer.byteLength,
    type: input.type,
    preview: textPreview(input),
  };
}

export async function readLocalMediaObject(filename: string) {
  const filePath = await getContentFilePath(filename);
  const stats = await fs.stat(filePath);
  return {
    stream: createReadStream(filePath),
    size: stats.size,
    extension: path.extname(filename).toLowerCase(),
  };
}

export async function deleteLocalMediaObject(filename: string) {
  const filePath = await getContentFilePath(filename);
  await fs.unlink(filePath);
}

export async function deleteSupabaseMediaObject(storagePath: string) {
  const config = supabaseStorageConfig();

  if (!config) {
    return false;
  }

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await supabase.storage
    .from(config.bucket)
    .remove([storagePath]);

  if (error) {
    throw error;
  }

  return true;
}

export async function readSupabaseMediaObject(storagePath: string) {
  const config = supabaseStorageConfig();

  if (!config) {
    return null;
  }

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .download(storagePath);

  if (error) {
    throw error;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
