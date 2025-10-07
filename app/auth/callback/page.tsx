"use client";
export const dynamic = 'force-dynamic';

import { useEffect } from "react";
import { getSupa } from "../../../lib/auth/supabase";

export default function SupabaseCallback() {
  // Just mounting this page lets Supabase parse the URL fragment and establish the session
  useEffect(() => {
    const supa = getSupa();
    // nothing else needed; detectSessionInUrl=true handles it
  }, []);

  return (
    <div style={{padding:16}}>
      <b>Signing you in…</b>
      <p>You’ll be redirected back automatically.</p>
    </div>
  );
}
