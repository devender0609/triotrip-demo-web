"use client";
export const dynamic = 'force-dynamic';

import Link from "next/link";

export default function DebugHome() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 900, fontSize: 22, marginBottom: 12 }}>Debug</h1>
      <ul style={{ lineHeight: 1.9 }}>
        <li><Link href="/debug/env">/debug/env</Link> — show NEXT_PUBLIC envs</li>
        <li><Link href="/debug/supabase">/debug/supabase</Link> — test Supabase client/session</li>
      </ul>
    </main>
  );
}
