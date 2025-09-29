// web/components/AuthBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { getSupa } from "../lib/auth/supabase";

type UserLite = { id: string; email?: string; avatar?: string };

export default function AuthBar() {
  const [user, setUser] = useState<UserLite | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loginDisabled, setLoginDisabled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const supa = getSupa(); // null if NEXT_PUBLIC_* envs missing

  useEffect(() => {
    if (!supa) {
      setLoginDisabled(true);
      return;
    }
    supa.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(mapUser(data.user));
    });
    const { data: sub } = supa.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ? mapUser(session.user) : null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, [supa]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function mapUser(u: any): UserLite {
    const avatar =
      u.user_metadata?.avatar_url ||
      u.user_metadata?.picture ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`;
    return { id: u.id, email: u.email || undefined, avatar };
  }

  async function signInGoogle() {
    if (!supa) return;
    await supa.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supa) return;
    try {
      setSending(true);
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      alert("Magic link sent. Check your email.");
      setOpen(false);
    } catch (err: any) {
      alert(err?.message || "Could not send magic link.");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    if (!supa) return;
    await supa.auth.signOut();
  }

  if (loginDisabled && !user) {
    return (
      <>
        <button className="btn" title="Login disabled (check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)">
          Login
        </button>
        <style jsx>{`
          .btn{height:40px;padding:0 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:not-allowed;opacity:.6;font-weight:800}
        `}</style>
      </>
    );
  }

  if (user) {
    return (
      <div className="auth" ref={menuRef}>
        <button className="user" onClick={() => setMenu(m => !m)} title={user.email || "Account"}>
          <img src={user.avatar} alt="" />
          <span>{user.email || "Account"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M7 10l5 5 5-5z"/></svg>
        </button>
        {menu && (
          <div className="menu">
            <div className="mi" onClick={logout}>Log out</div>
          </div>
        )}
        <style jsx>{`
          .auth{position:relative}
          .user{display:inline-flex;gap:8px;align-items:center;height:40px;padding:0 12px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-weight:800}
          img{width:20px;height:20px;border-radius:999px}
          .menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px;min-width:140px;box-shadow:0 8px 28px rgba(2,6,23,.12)}
          .mi{padding:8px 10px;border-radius:8px;cursor:pointer}
          .mi:hover{background:#f1f5f9}
        `}</style>
      </div>
    );
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>Log in</button>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Log in">
          <div className="card">
            <div className="hd">Welcome to TripTrio</div>
            <button className="google" onClick={signInGoogle}>
              <img src="https://www.google.com/favicon.ico" alt="" />
              Continue with Google
            </button>

            <div className="or"><span>or</span></div>

            <form onSubmit={sendMagicLink} className="form">
              <label>Email for magic link</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/>
              <button className="btn primary" disabled={sending}>{sending ? "Sending…" : "Send magic link"}</button>
            </form>

            <button className="close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn{height:40px;padding:0 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;font-weight:800}
        .sheet{position:fixed;inset:0;background:rgba(2,6,23,.36);display:grid;place-items:center;z-index:60}
        .card{width:min(92vw,420px);background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;display:grid;gap:12px;box-shadow:0 24px 60px rgba(2,6,23,.2)}
        .hd{font-size:18px;font-weight:900}
        .google{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 14px;border-radius:12px;cursor:pointer;border:1px solid #e2e8f0;background:#fff;font-weight:800}
        .google img{width:16px;height:16px}
        .or{text-align:center;color:#64748b;font-weight:800;position:relative}
        .or:before,.or:after{content:"";position:absolute;top:50%;width:30%;height:1px;background:#e5e7eb}
        .or:before{left:0}.or:after{right:0}
        .form{display:grid;gap:8px}
        .form input{height:44px;border:1px solid #e2e8f0;border-radius:12px;padding:0 12px}
        .primary{background:linear-gradient(90deg,#06b6d4,#0ea5e9);color:#fff;border:none}
        .close{height:40px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;font-weight:800}
      `}</style>
    </>
  );
}
