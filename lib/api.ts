"use client";

/**
 * In production: always same-origin (/api/**) to avoid CORS.
 * In dev: if NEXT_PUBLIC_API_BASE is set to http://localhost:4000 we use it.
 */

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

// Only allow NEXT_PUBLIC_API_BASE in dev builds.
// In production, force same-origin.
const PUBLIC_BASE =
  isDev ? (process.env.NEXT_PUBLIC_API_BASE || "") : "";

/** Build a URL to our API. In production this is always relative (/api/...). */
function apiUrl(path: string) {
  // normalize
  const p = path.startsWith("/") ? path : `/${path}`;
  // If caller passes already “/api/...”, keep it; else prefix.
  const withApi = p.startsWith("/api/") ? p : `/api${p}`;
  // If browser + prod => same-origin; if dev and PUBLIC_BASE present => absolute.
  return isBrowser ? `${PUBLIC_BASE}${withApi}` : withApi;
}

/** Generic helper */
export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...init,
    // avoid stale suggestions during typing
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.clone().json();
      if ((j as any)?.error) msg = (j as any).error;
    } catch {
      const t = await res.clone().text().catch(() => "");
      if (t) msg = t;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Public helper used by Airport fields */
export async function searchPlaces(term: string) {
  // NOTE: we call /api/places on the **same origin**
  return getJSON<{ ok: boolean; data: any[] }>(`/api/places?q=${encodeURIComponent(term)}`);
}
