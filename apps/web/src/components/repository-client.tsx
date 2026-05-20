"use client";

import type { ContentAsset, ContentAssetKind, WorkspaceProject } from "@shared";
import {
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { ChangeEvent, ComponentType } from "react";
import { useMemo, useRef, useState, useTransition } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiJson } from "@/ui/lib/api";

type RepositoryClientProps = {
  initialAssets: ContentAsset[];
  activeProject: WorkspaceProject | null;
};

type UploadResponse = {
  asset: ContentAsset;
};

type ExportResponse = {
  content?: string;
  downloadUrl?: string;
  filename: string;
  mimeType: string;
};

type FilerobotEditorProps = {
  source: string;
  onClose: () => void;
  onSave: (
    image: {
      imageBase64?: string;
    },
    designState: unknown,
  ) => void;
};

const typeFilters: Array<"all" | ContentAssetKind> = [
  "all",
  "text",
  "image",
  "video",
];
const imageTypes = ".png,.jpg,.jpeg,.gif,.webp,.svg";
const videoTypes = ".mp4,.webm";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function assetKind(asset: ContentAsset) {
  return asset.kind ?? asset.type;
}

function isEditableImage(asset: ContentAsset) {
  const extension = asset.filename
    .slice(asset.filename.lastIndexOf("."))
    .toLowerCase();
  return assetKind(asset) === "image" && ![".gif", ".svg"].includes(extension);
}

function AssetPreview({ asset }: { asset: ContentAsset }) {
  const kind = assetKind(asset);

  if (kind === "image") {
    return (
      <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
        <img
          alt={asset.filename}
          className="size-full object-cover"
          src={`/api/content-assets/${asset.id}/blob`}
        />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <Film aria-hidden="true" className="mx-auto size-10 text-cyan-300" />
          <p className="mt-3 max-w-48 truncate text-sm font-medium">
            {asset.filename}
          </p>
        </div>
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div className="aspect-[4/3] overflow-hidden bg-emerald-950 p-4 text-white">
        <FileText aria-hidden="true" className="mb-3 size-5 text-emerald-200" />
        <pre className="line-clamp-7 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-emerald-50/85">
          {asset.bodyPreview || asset.preview || "Empty snippet"}
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

function dataUrlToBlob(dataUrl: string) {
  const [metadata, data] = dataUrl.split(",");
  const mimeType = metadata.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function RepositoryClient({
  initialAssets,
  activeProject,
}: RepositoryClientProps) {
  const [assets, setAssets] = useState<ContentAsset[]>(initialAssets);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    initialAssets[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<(typeof typeFilters)[number]>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [textBody, setTextBody] = useState("");
  const [editorOpenFor, setEditorOpenFor] = useState<ContentAsset | null>(null);
  const [FilerobotEditor, setFilerobotEditor] =
    useState<ComponentType<FilerobotEditorProps> | null>(null);
  const [isPending, startTransition] = useTransition();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(
    () =>
      [...new Set(assets.flatMap((asset) => asset.tags ?? []))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [assets],
  );

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const kind = assetKind(asset);
      const matchesType = typeFilter === "all" || kind === typeFilter;
      const matchesTag =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => (asset.tags ?? []).includes(tag));
      const searchable = [
        asset.filename,
        asset.title,
        asset.description,
        asset.preview,
        asset.body,
        asset.bodyPreview,
        ...(asset.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || searchable.includes(normalizedQuery);

      return matchesType && matchesTag && matchesQuery;
    });
  }, [assets, query, selectedTags, typeFilter]);

  const selectedAsset = useMemo(
    () =>
      visibleAssets.find((asset) => asset.id === selectedAssetId) ??
      visibleAssets[0] ??
      null,
    [selectedAssetId, visibleAssets],
  );

  const selectedKind = selectedAsset ? assetKind(selectedAsset) : null;

  const upsertAsset = (asset: ContentAsset) => {
    setAssets((current) => {
      const exists = current.some((candidate) => candidate.id === asset.id);
      return exists
        ? current.map((candidate) =>
            candidate.id === asset.id ? asset : candidate,
          )
        : [asset, ...current];
    });
    setSelectedAssetId(asset.id ?? null);
    setTextBody(asset.body ?? "");
  };

  const createTextSnippet = () => {
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await apiJson<{ asset: ContentAsset }>(
          "/api/content-assets/text-snippets",
          {
            method: "POST",
            body: JSON.stringify({
              title: "Untitled snippet",
              body: "",
              tags: [],
            }),
          },
        );
        upsertAsset(result.asset);
        setMessage("Text snippet created.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to create snippet.",
        );
      }
    });
  };

  const uploadFile = (file: File, kind: "image" | "video") => {
    startTransition(async () => {
      setMessage(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await apiJson<UploadResponse>(
          `/api/content-assets/${kind === "image" ? "images" : "videos"}`,
          { method: "POST", body: formData, headers: {} },
        );
        upsertAsset(result.asset);
        setMessage(`${file.name} uploaded.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  };

  const handleFileChange =
    (kind: "image" | "video") => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) uploadFile(file, kind);
      event.target.value = "";
    };

  const saveMetadata = (asset: ContentAsset, formData: FormData) => {
    startTransition(async () => {
      setMessage(null);
      const tagsValue = String(formData.get("tags") ?? "");

      try {
        const result = await apiJson<{ asset: ContentAsset }>(
          `/api/content-assets/${asset.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              tags: tagsValue
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            }),
          },
        );
        upsertAsset(result.asset);
        setMessage("Asset details saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Save failed.");
      }
    });
  };

  const saveText = (asset: ContentAsset, formData: FormData) => {
    startTransition(async () => {
      setMessage(null);
      const tagsValue = String(formData.get("tags") ?? "");

      try {
        const result = await apiJson<{ asset: ContentAsset }>(
          `/api/content-assets/${asset.id}/text`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              tags: tagsValue
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              body: textBody,
            }),
          },
        );
        upsertAsset(result.asset);
        setMessage("Text snippet saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Save failed.");
      }
    });
  };

  const deleteAsset = (asset: ContentAsset) => {
    startTransition(async () => {
      setMessage(null);
      try {
        await apiJson<{ success: boolean }>(`/api/content-assets/${asset.id}`, {
          method: "DELETE",
        });
        setAssets((current) =>
          current.filter((candidate) => candidate.id !== asset.id),
        );
        setSelectedAssetId(null);
        setMessage(`${asset.title || asset.filename} deleted.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Delete failed.");
      }
    });
  };

  const copyText = async (asset: ContentAsset, format: "text" | "markdown") => {
    try {
      const result = await apiJson<ExportResponse>(
        `/api/content-assets/${asset.id}/export`,
        { method: "POST", body: JSON.stringify({ format }) },
      );
      await navigator.clipboard.writeText(result.content ?? "");
      setMessage(format === "text" ? "Text copied." : "Markdown copied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy failed.");
    }
  };

  const copyImageUrl = async (asset: ContentAsset) => {
    try {
      const result = await apiJson<{ url: string }>(
        `/api/content-assets/${asset.id}/copy-url`,
        { method: "POST", body: JSON.stringify({ target: "current" }) },
      );
      await navigator.clipboard.writeText(result.url);
      setMessage("Image URL copied.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message} Download is still available.`
          : "Copy failed. Download is still available.",
      );
    }
  };

  const downloadAsset = async (
    asset: ContentAsset,
    format: "markdown" | "file" = "file",
  ) => {
    const result = await apiJson<ExportResponse>(
      `/api/content-assets/${asset.id}/export`,
      { method: "POST", body: JSON.stringify({ format }) },
    );

    if (result.content !== undefined) {
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (result.downloadUrl) {
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = result.filename;
      link.click();
    }
  };

  const openImageEditor = async (asset: ContentAsset) => {
    if (!FilerobotEditor) {
      const module = await import("react-filerobot-image-editor");
      setFilerobotEditor(
        () => module.default as unknown as ComponentType<FilerobotEditorProps>,
      );
    }
    setEditorOpenFor(asset);
  };

  const saveEditedImage = async (
    asset: ContentAsset,
    imageBase64: string,
    designState: unknown,
  ) => {
    const blob = dataUrlToBlob(imageBase64);
    const formData = new FormData();
    formData.append("file", blob, asset.filename);
    formData.append("editState", JSON.stringify(designState ?? {}));
    const result = await apiJson<{ asset: ContentAsset }>(
      `/api/content-assets/${asset.id}/image-edits`,
      { method: "POST", body: formData, headers: {} },
    );
    upsertAsset(result.asset);
    setEditorOpenFor(null);
    setMessage("Image edit saved.");
  };

  return (
    <div className="w-full px-6 py-6 lg:px-8">
      <input
        ref={imageInputRef}
        accept={imageTypes}
        className="sr-only"
        onChange={handleFileChange("image")}
        type="file"
      />
      <input
        ref={videoInputRef}
        accept={videoTypes}
        className="sr-only"
        onChange={handleFileChange("video")}
        type="file"
      />

      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Content Repository
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeProject
              ? `${activeProject.name} · ${assets.length} assets`
              : `${assets.length} assets`}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 dark:bg-white dark:text-slate-950"
              disabled={isPending}
              type="button"
            >
              {isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Plus aria-hidden="true" className="size-4" />
              )}
              Add content
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={createTextSnippet}>
              <FileText aria-hidden="true" />
              Text snippet
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              Upload image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => videoInputRef.current?.click()}>
              <Video aria-hidden="true" />
              Upload video
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-72 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label="Search assets"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-cyan-400 dark:border-slate-800 dark:bg-slate-950"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, filename, tags, description, or text"
            value={query}
          />
        </label>
        <select
          aria-label="Filter asset type"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          onChange={(event) =>
            setTypeFilter(event.target.value as typeof typeFilter)
          }
          value={typeFilter}
        >
          {typeFilters.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All types" : type}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex min-h-9 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Tag filter
        </span>
        {tags.length === 0 ? (
          <span className="text-sm text-slate-500">No tags yet</span>
        ) : (
          tags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                aria-pressed={active}
                className={[
                  "h-8 rounded-full border px-3 text-sm transition",
                  active
                    ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
                ].join(" ")}
                key={tag}
                onClick={() =>
                  setSelectedTags((current) =>
                    active
                      ? current.filter((candidate) => candidate !== tag)
                      : [...current, tag],
                  )
                }
                type="button"
              >
                {tag}
              </button>
            );
          })
        )}
        {selectedTags.length > 0 ? (
          <button
            className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
            onClick={() => setSelectedTags([])}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      {message ? (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-96">
          {visibleAssets.length === 0 ? (
            <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-slate-300 text-center text-slate-500 dark:border-slate-700">
              <div>
                <MoreHorizontal aria-hidden="true" className="mx-auto size-9" />
                <p className="mt-3 font-medium">No matching assets</p>
              </div>
            </div>
          ) : (
            <div className="grid content-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleAssets.map((asset) => (
                <article
                  key={asset.id ?? asset.filename}
                  className={[
                    "overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md dark:bg-slate-950",
                    selectedAsset?.id === asset.id
                      ? "border-cyan-400 ring-4 ring-cyan-300/15"
                      : "border-slate-200 dark:border-slate-800",
                  ].join(" ")}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => {
                      setSelectedAssetId(asset.id ?? null);
                      setTextBody(asset.body ?? "");
                    }}
                    type="button"
                  >
                    <AssetPreview asset={asset} />
                  </button>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className="truncate text-sm font-semibold"
                          title={asset.title || asset.filename}
                        >
                          {asset.title || asset.filename}
                        </h3>
                        <p className="mt-1 text-xs uppercase text-slate-500">
                          {assetKind(asset)} · {formatBytes(asset.size)} ·{" "}
                          {asset.status ?? "ready"}
                        </p>
                      </div>
                      <button
                        aria-label={`Delete ${asset.title || asset.filename}`}
                        className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                        disabled={isPending}
                        onClick={() => deleteAsset(asset)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                    {(asset.tags ?? []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(asset.tags ?? []).slice(0, 4).map((tag) => (
                          <span
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            key={tag}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500">
                      Updated {formatDate(asset.updatedAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {selectedAsset ? (
          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Asset details</h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {selectedAsset.filename}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {selectedKind}
              </span>
            </div>

            {selectedKind === "image" ? (
              <div className="mb-5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <img
                  alt={selectedAsset.filename}
                  className="max-h-80 w-full object-contain"
                  src={`/api/content-assets/${selectedAsset.id}/blob`}
                />
              </div>
            ) : null}

            {selectedKind === "video" ? (
              <video
                className="mb-5 max-h-80 w-full rounded-lg border border-slate-200 bg-black dark:border-slate-800"
                controls
                src={`/api/content-assets/${selectedAsset.id}/blob`}
              >
                <track kind="captions" />
              </video>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (selectedKind === "text") {
                  saveText(selectedAsset, new FormData(event.currentTarget));
                } else {
                  saveMetadata(
                    selectedAsset,
                    new FormData(event.currentTarget),
                  );
                }
              }}
            >
              <label className="block">
                <span className="text-sm font-medium">Title</span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                  defaultValue={selectedAsset.title ?? ""}
                  key={`${selectedAsset.id}-title`}
                  name="title"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                  defaultValue={selectedAsset.description ?? ""}
                  key={`${selectedAsset.id}-description`}
                  name="description"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Tags</span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                  defaultValue={(selectedAsset.tags ?? []).join(", ")}
                  key={`${selectedAsset.id}-tags`}
                  name="tags"
                  placeholder="launch, social, evergreen"
                />
              </label>

              {selectedKind === "text" ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Body</span>
                    <span className="text-xs text-slate-500">
                      {textBody.length} characters
                    </span>
                  </div>
                  <MarkdownEditor onChange={setTextBody} value={textBody} />
                </div>
              ) : null}

              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
                disabled={isPending}
                type="submit"
              >
                <Save aria-hidden="true" className="size-4" />
                Save
              </button>
            </form>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {selectedKind === "text" ? (
                <>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    onClick={() => copyText(selectedAsset, "text")}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    Copy text
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    onClick={() => copyText(selectedAsset, "markdown")}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    Copy Markdown
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 sm:col-span-2"
                    onClick={() => downloadAsset(selectedAsset, "markdown")}
                    type="button"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Download .md
                  </button>
                </>
              ) : null}

              {selectedKind === "image" ? (
                <>
                  {isEditableImage(selectedAsset) ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                      onClick={() => openImageEditor(selectedAsset)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                      Edit image
                    </button>
                  ) : null}
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    onClick={() => copyImageUrl(selectedAsset)}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    Copy URL
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 sm:col-span-2"
                    onClick={() => downloadAsset(selectedAsset)}
                    type="button"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Download image
                  </button>
                </>
              ) : null}

              {selectedKind === "video" ? (
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 sm:col-span-2"
                  onClick={() => downloadAsset(selectedAsset)}
                  type="button"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Download video
                </button>
              ) : null}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">MIME type</dt>
                <dd className="mt-1 truncate">
                  {selectedAsset.mimeType ?? "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Size</dt>
                <dd className="mt-1">{formatBytes(selectedAsset.size)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="mt-1">{formatDate(selectedAsset.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1">{selectedAsset.status ?? "ready"}</dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </section>

      {editorOpenFor && FilerobotEditor ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4">
          <div className="h-full overflow-hidden rounded-lg bg-white dark:bg-slate-950">
            <FilerobotEditor
              source={`/api/content-assets/${editorOpenFor.id}/blob`}
              onClose={() => setEditorOpenFor(null)}
              onSave={(
                image: { imageBase64?: string },
                designState: unknown,
              ) => {
                if (image.imageBase64) {
                  void saveEditedImage(
                    editorOpenFor,
                    image.imageBase64,
                    designState,
                  );
                }
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
