"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import {
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { ContentAsset } from "@/lib/content-assets";

type RepositoryClientProps = {
  initialAssets: ContentAsset[];
};

type UploadResponse = {
  success: boolean;
  filename: string;
  path: string;
  type: ContentAsset["type"];
};

const supportedTypes =
  ".png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.webm,.txt,.md,.json";

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetPreview({ asset }: { asset: ContentAsset }) {
  if (asset.type === "image") {
    return (
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={asset.filename}
          className="size-full object-cover"
          src={`/api/upload?filename=${encodeURIComponent(asset.filename)}`}
        />
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-slate-900 text-slate-100">
        <div className="text-center">
          <Film aria-hidden="true" className="mx-auto size-10 text-cyan-300" />
          <p className="mt-3 max-w-48 truncate text-sm font-medium">{asset.filename}</p>
        </div>
      </div>
    );
  }

  if (asset.type === "text") {
    return (
      <div className="aspect-[4/3] overflow-hidden bg-slate-950 p-4 text-slate-100">
        <FileText aria-hidden="true" className="mb-3 size-5 text-emerald-300" />
        <pre className="line-clamp-6 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">
          {asset.preview || "No preview available."}
        </pre>
      </div>
    );
  }

  return (
    <div className="grid aspect-[4/3] place-items-center bg-slate-100 dark:bg-slate-900">
      <ImageIcon aria-hidden="true" className="size-10 text-slate-400" />
    </div>
  );
}

export function RepositoryClient({ initialAssets }: RepositoryClientProps) {
  const [assets, setAssets] = useState<ContentAsset[]>(initialAssets);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshAssets = useCallback(async () => {
    const response = await fetch("/api/upload", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to load assets.");
    }

    const data = (await response.json()) as { assets: ContentAsset[] };
    setAssets(data.assets);
  }, []);

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      const selectedFiles = Array.from(files);

      if (selectedFiles.length === 0) {
        return;
      }

      startTransition(async () => {
        setMessage(null);

        try {
          for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const data = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(data?.error || `Failed to upload ${file.name}.`);
            }

            await response.json() as UploadResponse;
          }

          await refreshAssets();
          setMessage(`${selectedFiles.length} asset${selectedFiles.length === 1 ? "" : "s"} uploaded.`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Upload failed.");
        } finally {
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }
      });
    },
    [refreshAssets],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      uploadFiles(event.target.files);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    uploadFiles(event.dataTransfer.files);
  };

  const deleteAsset = (filename: string) => {
    startTransition(async () => {
      setMessage(null);

      try {
        const response = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error || `Failed to delete ${filename}.`);
        }

        setAssets((currentAssets) =>
          currentAssets.filter((asset) => asset.filename !== filename),
        );
        setMessage(`${filename} deleted.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Delete failed.");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <header className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Asset intake
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Content Repository</h1>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
              Import images, videos, and text references for growth campaigns.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="font-semibold">{assets.length}</span> stored assets
          </div>
        </div>
      </header>

      <label
        className={[
          "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 text-center shadow-sm transition dark:bg-slate-900",
          isDragging
            ? "border-cyan-400 ring-4 ring-cyan-300/25"
            : "border-slate-300 hover:border-cyan-400 dark:border-slate-700",
        ].join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          accept={supportedTypes}
          className="sr-only"
          multiple
          onChange={handleInputChange}
          type="file"
        />
        <div className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950">
          {isPending ? (
            <Loader2 aria-hidden="true" className="size-7 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="size-7" />
          )}
        </div>
        <p className="mt-5 text-lg font-semibold">
          Drop files here or click to browse
        </p>
        <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Supports PNG, JPG, GIF, WebP, SVG, MP4, WebM, TXT, MD, and JSON files.
        </p>
        {message ? (
          <p className="mt-4 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {message}
          </p>
        ) : null}
      </label>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Uploaded assets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sorted by latest update
          </p>
        </div>

        {assets.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-xl border border-slate-200 bg-white text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <ImageIcon aria-hidden="true" className="mx-auto size-10 text-slate-400" />
              <p className="mt-3 font-medium">No assets yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Upload a file to start building the repository.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {assets.map((asset) => (
              <article
                key={asset.filename}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <AssetPreview asset={asset} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold" title={asset.filename}>
                        {asset.filename}
                      </h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {asset.type} · {formatBytes(asset.size)}
                      </p>
                    </div>
                    <button
                      aria-label={`Delete ${asset.filename}`}
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950"
                      disabled={isPending}
                      onClick={() => deleteAsset(asset.filename)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
