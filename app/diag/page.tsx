"use client";

import { useEffect, useState } from "react";

export default function Diag() {
  const [state, setState] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/places?q=bos`, { cache: "no-store", credentials: "same-origin" });
        const text = await r.text();
        let j: any = {};
        try { j = text ? JSON.parse(text) : {}; } catch {}
        setState({
          requestUrl: r.url,
          ok: r.ok,
          status: r.status,
          length: Array.isArray(j?.data) ? j.data.length : 0,
          sample: Array.isArray(j?.data) ? j.data.slice(0, 3) : [],
          raw: text.slice(0, 400),
        });
      } catch (e: any) {
        setState({ error: String(e?.message || e), name: e?.name ?? null });
      }
    })();
  }, []);

  return <pre style={{ padding: 20 }}>{JSON.stringify(state, null, 2)}</pre>;
}
