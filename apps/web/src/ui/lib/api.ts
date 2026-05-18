const jsonMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let accessTokenProvider: (() => Promise<string | null>) | null = null;
let activeProjectIdProvider: (() => string | null) | null = null;

export function configureApiAuth(
  provider: (() => Promise<string | null>) | null,
) {
  accessTokenProvider = provider;
}

export function configureApiProject(provider: (() => string | null) | null) {
  activeProjectIdProvider = provider;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (
    jsonMethods.has(init?.method?.toUpperCase() ?? "") &&
    init?.body !== undefined &&
    !hasFormDataBody &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = accessTokenProvider ? await accessTokenProvider() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeProjectId = activeProjectIdProvider?.();
  if (activeProjectId) {
    headers.set("X-Open-Growth-Project-Id", activeProjectId);
  }

  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat("en", {
    notation: value && value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
