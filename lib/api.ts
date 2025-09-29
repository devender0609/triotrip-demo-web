// web/lib/api.ts
"use client";

import { getSupa } from "./auth/supabase";

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

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // Not logged in / token invalid → send to login
    redirectToLogin();
    throw new Error("Please log in to continue.");
  }

  if (!res.ok) {
    // Try to extract a helpful message
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
