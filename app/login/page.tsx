"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { getSupa } from "../../lib/auth/supabase";

export default function LoginPage() {
  const supa = getSupa();
  const router = useRouter();
  const params = useSearchParams();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nextPath = params?.get("next") || null;

  useEffect(() => {
    if (!supa) return;
    let mounted = true;

    supa.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const email = data?.user?.email ?? null;
      setUserEmail(email);
      setLoading(false);
      if (email && nextPath) router.replace(nextPath);
    });

    const { data: sub } = supa.auth.onAuthStateChange((_evt, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      if (email && nextPath) router.replace(nextPath);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supa, nextPath, router]);

  if (!supa) {
    return (
      <main className="auth-wrap">
        <div className="card">
          <h1 className="title">Login</h1>
          <p>
            Supabase client not configured. Make sure
            <code> NEXT_PUBLIC_SUPABASE_URL </code> and
            <code> NEXT_PUBLIC_SUPABASE_ANON_KEY </code> are set in
            <code> web/.env.local</code>.
          </p>
          <Link href="/" className="btn">â† Back to home</Link>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  async function handleSignOut() {
    await supa.auth.signOut();
    setUserEmail(null);
  }

  return (
    <main className="auth-wrap">
      <div className="card">
        <h1 className="title">Login</h1>

        {loading ? (
          <p>Checking sessionâ€¦</p>
        ) : userEmail ? (
          <div className="signed">
            <p>Signed in as <b>{userEmail}</b></p>
            <div className="row">
              <button className="btn" onClick={handleSignOut}>Sign out</button>
              <Link href="/" className="btn primary">Go to Home</Link>
            </div>
          </div>
        ) : null}

        <Auth
          supabaseClient={supa}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: { brand: "#0ea5e9", brandAccent: "#06b6d4" },
              },
            },
          }}
          providers={["google"]}   // GitHub removed
          // keep email/password visible (donâ€™t set onlyThirdPartyProviders)
          redirectTo={
            typeof window !== "undefined"
              ? window.location.origin + "/login"
              : undefined
          }
        />

        {!userEmail && (
          <p className="hint">
            After signing in youâ€™ll be redirected{nextPath ? ` to ${nextPath}` : ""}.
          </p>
        )}
      </div>
      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
.auth-wrap{
  min-height: calc(100vh - 64px);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  background:#f8fafc;
}
.card{
  width:100%;
  max-width:480px;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:16px;
  padding:20px;
  box-shadow: 0 10px 24px rgba(2,6,23,.06);
}
.title{
  margin:0 0 12px 0;
  font-weight:900;
  font-size:22px;
  text-align:center;
}
.row{display:flex; gap:8px; margin:8px 0 12px;}
.btn{height:36px; padding:0 12px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; font-weight:800; text-decoration:none; display:inline-flex; align-items:center;}
.btn.primary{background:linear-gradient(90deg,#06b6d4,#0ea5e9); color:#fff; border:none;}
.hint{margin-top:10px; color:#475569; text-align:center;}
.signed p{margin:0 0 8px 0;}
`;

