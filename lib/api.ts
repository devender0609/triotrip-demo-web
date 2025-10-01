"use client";

import { getSupa } from "./auth/supabase";

/* ----------------- same-origin helper for browser ----------------- */
function sameOriginUrl(path: string) {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return new URL(path, window.location.origin).toString();
    }
  } catch {}
  return path; // SSR fallback
}

/* ----------------- Places autocomplete (unchanged) ---------------- */
export async function searchPlaces(q: string) {
  const url = sameOriginUrl(`/api/places?q=${encodeURIComponent(q)}`);
  console.log("[searchPlaces] requesting", url);
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  console.log("[searchPlaces] response", res.status, res.ok);
  if (!res.ok) {
    let msg = `API error (${res.status})`;
    try { const j = await res.clone().json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<{ data: Array<{ label: string; code?: string; name: string; city?: string; country?: string }> }>;
}

/* ----------------- External/authed API base resolution ------------ */
/**
 * RULES:
 * - If NEXT_PUBLIC_API_BASE is a full http(s) URL → use it.
 * - Else (unset/blank) → use SAME-ORIGIN (build absolute from window.location.origin).
 * This prevents accidental calls to http://localhost:4000 in production.
 */
const RAW_BASE = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined);
const ABSOLUTE_BASE = (RAW_BASE && /^https?:\/\//i.test(RAW_BASE)) ? RAW_BASE : "";

/** Build the final URL for authed calls. */
function urlFor(path: string) {
  if (ABSOLUTE_BASE) return `${ABSOLUTE_BASE}${path}`;
  // No absolute base → same-origin
  return sameOriginUrl(path);
}

/* ----------------- Auth helpers (unchanged) ---------------------- */
async function getToken(): Promise<string | null> {
  const supa = getSupa();
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

/* ----------------- Authed fetch (now uses urlFor) ----------------- */
async function authedFetch(path: string, init: RequestInit = {}) {
  // Build URL safely
  const url = urlFor(path);

  const token = await getToken();
  const headers = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, credentials: "same-origin" });
  } catch (e: any) {
    console.error("[authedFetch] network error:", e?.message || e);
    throw e;
  }

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Please log in to continue.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try { const j = await res.clone().json(); if (j?.error) message = j.error; } catch {
      try { const t = await res.clone().text(); if (t) message = t; } catch {}
    }
    throw new Error(message);
  }

  return res;
}

/* ----------------- Favorites API (unchanged semantics) ------------ */
export async function listFavorites() {
  // NOTE: If NEXT_PUBLIC_API_BASE is unset, this will call SAME-ORIGIN /favorites.
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