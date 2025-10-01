"use client";

import { getSupa } from "./auth/supabase";

/**
 * SAME-ORIGIN helper (no base URL). Adds Supabase token when available.
 */
async function authedFetch(path: string, init: RequestInit = {}) {
  // add Authorization if we have a Supabase session
  let headers: HeadersInit = init.headers || {};
  try {
    const supa = getSupa();
    if (supa) {
      const { data } = await supa.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers = { ...headers, Authorization: `Bearer ${token}` };
    }
  } catch {
    /* ignore */
  }

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
    throw new Error("Please log in to continue.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res;
}

/** Airport/City suggestions used by the inputs */
export async function searchPlaces(term: string, signal?: AbortSignal) {
  const q = (term || "").trim();
  if (q.length < 2) return [];
  const url = `/api/places?q=${encodeURIComponent(q)}`;
  console.log("[searchPlaces] requesting", url);
  const res = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("[searchPlaces] non-OK", res.status, body.slice(0, 160));
    return [];
  }
  const json = await res.json().catch(() => ({}));
  return Array.isArray(json?.data) ? json.data : [];
}

/** Favorites API (unchanged logic, now same-origin) */
export async function listFavorites() {
  const r = await authedFetch(`/favorites`, { cache: "no-store" });
  return r.json() as Promise<{ items: any[] }>;
}

export async function addFavorite(payload: any) {
  const r = await authedFetch(`/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return r.json() as Promise<{ item: any }>;
}

export async function removeFavorite(id: string) {
  const r = await authedFetch(`/favorites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return r.json() as Promise<{ ok: boolean }>;
}
