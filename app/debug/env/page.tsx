"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function EnvDebug() {
  const [probe, setProbe] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/places?q=bos`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const text = await r.text();
        let j: any = {};
        try { j = text ? JSON.parse(text) : {}; } catch {}
        setProbe({
          requestUrl: r.url,
          ok: r.ok,
          status: r.status,
          length: Array.isArray(j?.data) ? j.data.length : 0,
          sample: Array.isArray(j?.data) ? j.data.slice(0, 3) : [],
          raw: text.slice(0, 400)
        });
      } catch (e: any) {
        setProbe({
          error: String(e?.message || e),
          name: e?.name ?? null
        });
      }
    })();
  }, []);

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "(ssr)";

  return (
    <pre style={{ padding: 16, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(
        {
          origin,
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present (public)" : "(missing)",
          NEXT_PUBLIC_API_BASE:
            process.env.NEXT_PUBLIC_API_BASE || "(missing)",
          places_probe: probe
        },
        null,
        2
      )}
    </pre>
  );
}
