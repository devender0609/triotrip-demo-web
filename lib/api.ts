"use client";

/**
 * In production, always call same-origin /api/* to avoid CORS.
 * In local dev, if you set NEXT_PUBLIC_API_BASE (e.g., http://localhost:4000),
 * we'll use it. In production we ignore it.
 */

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";
const PUBLIC_BASE = isDev ? (process.env.NEXT_PUBLIC_API_BASE || "") : "";

/** Normalize to /api/<path>; return absolute only in dev if PUBLIC_BASE set */
function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const withApi = p.startsWith("/api/") ? p : `/api${p}`;
  return isBrowser && PUBLIC_BASE ? `${PUBLIC_BASE.replace(/\/+$/, "")}${withApi}` : withApi;
}

/** Generic JSON fetch (same-origin in prod) */
async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    credentials: "same-origin",
  });

  if (!res.ok) {
    // Try to surface a useful error
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

/** =========================
 *  Places (autocomplete)
 *  ========================= */
export async function searchPlaces(term: string) {
  const q = (term || "").trim();
  if (q.length < 2) return { ok: true, data: [] as any[] };
  // Always hit our own API route; dev base is auto-applied by apiUrl
  return fetchJSON<{ ok: boolean; data: any[] }>(`/api/places?q=${encodeURIComponent(q)}`);
}

/** =========================
 *  Favorites API (used by app/saved and ResultCard)
 *  ========================= */

/** GET /api/favorites -> { items: any[] } */
export async function listFavorites() {
  return fetchJSON<{ items: any[] }>(`/api/favorites`);
}

/** POST /api/favorites { payload } -> { item: any } */
export async function addFavorite(payload: any) {
  return fetchJSON<{ item: any }>(`/api/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
}

/** DELETE /api/favorites/:id -> { ok: boolean } */
export async function removeFavorite(id: string) {
  return fetchJSON<{ ok: boolean }>(`/api/favorites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** (Optional utility if you need it elsewhere) */
export const getJSON = fetchJSON;
