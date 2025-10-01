"use client";

import { getSupa } from "./auth/supabase";

/* =========================================================================
   SAME-ORIGIN PUBLIC API (browser) — used by airport autocomplete
   ======================================================================== */

/** Safely build a same-origin URL in the browser. */
function sameOriginUrl(path: string) {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return new URL(path, window.location.origin).toString();
    }
  } catch {}
  return path; // SSR/unknown env fallback (keeps path relative)
}

/**
 * GET /api/places?q=...
 * - Always calls your own domain (same origin)
 * - Verbose logs to surface the real cause of “NetworkError…”
 * - Small timeout so a hanging extension won’t stall forever
 */
export async function searchPlaces(q: string) {
  const url = sameOriginUrl(`/api/places?q=${encodeURIComponent(q)}`);

  // Debug: visible in browser console
  // eslint-disable-next-line no-console
  console.log("[searchPlaces] requesting", url);

  let res: Response;
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000); // 8s safety timeout

    res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      signal: ctl.signal,
    }).finally(() => clearTimeout(to));
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[searchPlaces] fetch threw:", {
      name: e?.name,
      message: e?.message || String(e),
      cause: e?.cause ?? null,
    });
    throw e;
  }

  // eslint-disable-next-line no-console
  console.log("[searchPlaces] response", res.status, res.ok);

  if (!res.ok) {
    let message = `API error (${res.status})`;
    try {
      const j = await res.clone().json();
      if (j?.error) message = j.error;
    } catch {
      try {
        const t = await res.clone().text();
        if (t) message = t;
      } catch {}
    }
    // eslint-disable-next-line no-console
    console.error("[searchPlaces] non-OK", message);
    throw new Error(message);
  }

  // Expecting { data: [...] }
  return res.json() as Promise<{
    data: Array<{ label: string; code?: string; name: string; city?: string; country?: string }>;
  }>;
}

/* =========================================================================
   AUTHED BACKEND API (your external server) — favorites, etc.
   ======================================================================== */

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

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

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[authedFetch] network error:", e?.message || e);
    throw e;
  }

  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Please log in to continue.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const j = await res.clone().json();
      if (j?.error) message = j.error;
    } catch {
      try {
        const t = await res.clone().text();
        if (t) message = t;
      } catch {}
    }
    throw new Error(message);
  }

  return res;
}

/** Favorites API */
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
