"use client";
export const dynamic = 'force-dynamic';

export default function EnvDebug() {
  return (
    <pre style={{ padding: 16, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(
        {
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)",
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present (public)" : "(missing)",
          NEXT_PUBLIC_API_BASE:
            process.env.NEXT_PUBLIC_API_BASE || "(missing)",
        },
        null,
        2
      )}
    </pre>
  );
}
