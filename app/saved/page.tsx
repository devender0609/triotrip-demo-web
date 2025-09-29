"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupa } from "../../lib/auth/supabase";
import { listFavorites, removeFavorite } from "../../lib/api";

export default function SavedPage() {
  const [mounted, setMounted] = useState(false);
  const [supaReady, setSupaReady] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const { items } = await listFavorites();
      setItems(items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;

    const supa = getSupa();
    if (!supa) {
      setSupaReady(false);
      setLoading(false);
      return;
    }
    setSupaReady(true);

    let alive = true;

    supa.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const email = data?.user?.email ?? null;
      setUserEmail(email);
      if (email) load();
    });

    const { data: sub } = supa.auth.onAuthStateChange((_evt, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      if (email) load();
      else setItems([]);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Saved</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!supaReady) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Saved</h1>
        <p>Auth not configured. Check your <code>web/.env.local</code> and restart <code>npm run dev</code>.</p>
        <p>Quick check: <Link href="/debug/env">/debug/env</Link> should show your NEXT_PUBLIC vars.</p>
        <p>Then try <Link href="/login">/login</Link> to sign in.</p>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Saved</h1>
        <p>Please <Link href="/login?next=/saved">sign in</Link> to view your saved trips.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>Saved</h1>
      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "#b91c1c" }}>⚠ {err}</p>}
      {!loading && !err && items.length === 0 && <p>No saved trips yet.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800 }}>
                {it.payload?.flight?.carrier_name || it.payload?.flight?.carrier || "Trip"}
                {it.payload?.hotel?.name ? ` • ${it.payload.hotel.name}` : ""}
              </div>
              <button
                style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 800 }}
                onClick={async () => {
                  try {
                    await removeFavorite(it.id);
                    setItems((s) => s.filter((x) => x.id !== it.id));
                  } catch (e: any) {
                    alert(e?.message || "Could not remove");
                  }
                }}
              >
                Remove
              </button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, color: "#475569" }}>
              {JSON.stringify(it.payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </main>
  );
}
