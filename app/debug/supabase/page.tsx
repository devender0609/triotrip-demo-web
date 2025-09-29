"use client";
export const dynamic = 'force-dynamic';

import { getSupa } from "../../../lib/auth/supabase";

export default function SupabaseDebug() {
  const supa = getSupa();

  async function test() {
    if (!supa) return { supa: "null" };
    const { data: sessionData, error: sErr } = await supa.auth.getSession();
    const { data: userData, error: uErr } = await supa.auth.getUser();
    return {
      supa: "ok",
      session: !!sessionData?.session,
      userEmail: userData?.user?.email ?? null,
      sessionError: sErr?.message ?? null,
      userError: uErr?.message ?? null,
    };
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>Supabase Debug</h1>
      <p>Env URL: {String(process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)")}</p>
      <p>Env Anon: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "(missing)"}</p>
      <button
        style={{ height: 36, padding: "0 12px", borderRadius: 8 }}
        onClick={async () => {
          const res = await test();
          alert(JSON.stringify(res, null, 2));
          console.log(res);
        }}
      >
        Test getSupa() & session
      </button>
    </main>
  );
}
