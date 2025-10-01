"use client";

/**
 * lib/api.ts — same-origin helpers
 *
 * - No NEXT_PUBLIC_*BASE — we always call Next routes on the same origin.
 * - Safe auth header via Supabase (when available).
 * - Strong error messages (tries JSON, then text).
 * - Console logs so you can see exactly what’s called.
 */

import { getSupa } from "./auth/supabase";

/* ---------------- internal utils ---------------- */

function toSameOrigin(path: string): string {
  // In the browser, turn "/api/..." into "https://<origin>/api/..."
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return new URL(path, window.location.origin).toString();
    }
  } catch {}
  return path; // SSR or unexpected — let fetch handle it
}

async function getToken(): Promise<string | null> {
  const supa = getSupa?.();
  if (!supa) return null;
  try {
    const { data } = await supa.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

/** Low-level JSON requester with good error surfacing */
async function requestJSON<T = any>(
  path: string,
  init: RequestInit = {},
  opts?: { requireAuth?: boolean }
): Promise<T> {
  const url = toSameOrigin(path);
  const token = await getToken();

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"] && init.body) headers["Content-Type"] = "application/json";

  // eslint-disable-next-line no-console
  console.log("[api] fetch", { url, method: init.method || "GET" });

  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers,
  });

  if (res.status === 401 && opts?.requireAuth) {
    redirectToLogin();
    throw new Error("Please log in to continue.");
  }

  // Try to parse JSON; if that fails, fall back to text
  let data: any = null;
  let text = "";
  try {
    data = await res.clone().json();
  } catch {
    try {
      text = await res.clone().text();
    } catch {
      /* no-op */
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      (text && text.slice(0, 300)) ||
      `Request failed (${res.status})`;
    // eslint-disable-next-line no-console
    console.error("[api] non-OK", { url, status: res.status, msg });
    throw new Error(msg);
  }

  return (data ?? (text as unknown)) as T;
}

/* ---------------- public helpers ---------------- */

/**
 * Places autocomplete (same-origin)
 * Expects your Next route at /api/places to return: { ok: true, data: Array<{ label, code?, name, city?, country? }> }
 */
export async function searchPlaces(q: string): Promise<{
  ok?: boolean;
  source?: string;
  data: Array<{ label: string; code?: string; name: string; city?: string; country?: string }>;
}> {
  const url = `/api/places?q=${encodeURIComponent(q)}`;
  try {
    const json = await requestJSON(url);
    // eslint-disable-next-line no-console
    console.log("[searchPlaces] ok", { q, count: Array.isArray(json?.data) ? json.data.length : 0, source: json?.source });
    return json;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[searchPlaces] failed", e?.message || String(e));
    throw e;
  }
}

/**
 * Main trip search (same-origin)
 * Your Next route should be implemented at /api/search (POST) to avoid CORS.
 */
export async function postSearch(payload: any): Promise<{
  results: any[];
  hotelWarning?: string | null;
}> {
  return requestJSON(`/api/search`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ---------------- favorites API (same-origin) ---------------- */

export async function listFavorites(): Promise<{ items: any[] }> {
  return requestJSON(`/api/favorites`, {}, { requireAuth: true });
}

export async function addFavorite(payload: any): Promise<{ item: any }> {
  return requestJSON(
    `/api/favorites`,
    {
      method: "POST",
      body: JSON.stringify({ payload }),
    },
    { requireAuth: true }
  );
}

export async function removeFavorite(id: string): Promise<{ ok: boolean }> {
  return requestJSON(
    `/api/favorites/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { requireAuth: true }
  );
}
