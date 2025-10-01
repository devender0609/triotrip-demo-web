"use client";

import { getSupa } from "./auth/supabase";

/* =========================================================================
   SAME-ORIGIN HELPERS
   ======================================================================== */

/** Build a same-origin absolute URL from a path when in the browser. */
function sameOriginUrl(path: string) {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      return new URL(path, window.location.origin).toString();
    }
  } catch {}
  return path; // SSR/unknown env fallback keeps it relative
}

/**
 * Decide API base for *client-side* authed calls.
 * - On Vercel (non-localhost), FORCE same-origin to avoid CORS/localhost leaks.
 * - On localhost, if NEXT_PUBLIC_API_BASE is a full http(s) URL, allow it (dev).
 */
const RAW_BASE =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined;

function effectiveBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal) {
      // On production/preview domains: always same-origin
      return "";
    }
  }
  // Local dev (SSR or browser): honor full http(s) URL if provided
  if (RAW_BASE && /^https?:\/\//i.test(RAW_BASE)) return RAW_BASE;
  return ""; // otherwise same-origin
}

/** Build the final URL for authed calls. */
function urlFor(path: string) {
  const base = effectiveBase();
  return base ? `${base}${path}` : sameOriginUrl(path);
}

/* =========================================================================
   PLACES AUTOCOMPLETE (PUBLIC) — ALWAYS SAME-ORIGIN
   ======================================================================== */

export async function searchPlaces(q: string) {
  const url = sameOriginUrl(`/api/places?q=${encodeURIComponent(q)}`);

  // Debug in browser console
  // eslint-disable-next-line no-console
  console.log("[searchPlaces] requesting", url);

  let res: Response;
  try {
    // Optional safety timeout so a hung fetch doesn't mask issues
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);

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

  return res.json() as Promise<{
    data: Array<{
      label: string;
      code?: string;
      name: string;
      city?: string;
      country?: string;
    }>;
  }>;
}

/* =========================================================================
   AUTHED BACKEND CALLS (FAVORITES, ETC.)
   ======================================================================== */

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

/** Fetch helper that adds Authorization when available and uses safe base URL. */
async function authedFetch(path: string, init: RequestInit = {}) {
  const url = urlFor(path);

  const token = await getToken();
  const headers = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "same-origin",
    });
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
  const r = await authedFetch(
    `/favorites/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  return r.json() as Promise<{ ok: boolean }>;
}
