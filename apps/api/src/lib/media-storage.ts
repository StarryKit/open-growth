import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  markDatabaseContentAssetFailed,
  prepareDatabaseContentAssetUpload,
  type StoreContext,
} from "../../../../packages/db/src/database-store.js";
import type { ContentAssetKind } from "../../../../packages/shared/src/index.js";
import { sanitizeFilename } from "./content-server.js";

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
    throw new Error("Supabase storage credentials are not configured.");
  }

  return { url, serviceRoleKey, bucket };
}

export function isSupabaseStorageEnabled() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
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
  const filename = sanitizeFilename(input.originalFilename);
  const prepared = await prepareDatabaseContentAssetUpload(
    {
      filename,
      storageBucket: config.bucket,
      mimeType: input.mimeType,
    },
    input.context,
  );

  if (!prepared) {
    throw new Error("Unable to prepare Supabase content asset upload.");
  }

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(prepared.storagePath, input.buffer, {
      contentType: input.mimeType ?? "application/octet-stream",
      upsert: false,
    });

  if (error) {
    await markDatabaseContentAssetFailed(prepared.assetId, input.context);
    throw error;
  }

  return {
    assetId: prepared.assetId,
    filename,
    path: prepared.storagePath,
    bucket: config.bucket,
    storagePath: prepared.storagePath,
    sha256: sha256(input.buffer),
    size: input.buffer.byteLength,
    type: input.type,
    preview: textPreview(input),
  };
}

export async function deleteSupabaseMediaObject(storagePath: string) {
  const config = supabaseStorageConfig();

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
