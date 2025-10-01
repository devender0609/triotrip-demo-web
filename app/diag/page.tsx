"use client";

import { useEffect, useState } from "react";

export default function Diag() {
  const [state, setState] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/places?q=bos`, { cache: "no-store" });
        const j = await r.json().catch(()=>({}));
        setState({ ok: r.ok, status: r.status, count: (j?.data||[]).length, sample: (j?.data||[]).slice(0,3) });
      } catch (e: any) {
        setState({ error: String(e?.message || e) });
      }
    })();
  }, []);

  return <pre style={{padding:20}}>{JSON.stringify(state, null, 2)}</pre>;
}
