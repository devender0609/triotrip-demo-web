"use client";

import Link from "next/link";
import Image from "next/image";
import AuthBar from "./AuthBar";

export default function Header() {
  return (
    <header className="tt-header" role="banner">
      <Link href="/" className="brand" aria-label="TrioTrip home">
        <Image src="/logo.png" alt="TrioTrip logo" width={40} height={40} priority />
        <span className="title">TrioTrip</span>
      </Link>

      <nav className="nav" aria-label="Main">
        <Link href="/saved">Saved</Link>
        <AuthBar />
      </nav>

      <style jsx>{`
        .tt-header { position: sticky; top: 0; z-index: 40; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 16px; background:#fff; border-bottom:1px solid #e5e7eb; }
        .brand { display:inline-flex; align-items:center; gap:10px; text-decoration:none; }
        .title { font-weight:900; letter-spacing:-0.02em; font-size:20px; color:#0f172a; }
        .nav { display:flex; gap:14px; align-items:center; font-weight:600; }
        .nav a { color:#334155; text-decoration:none; }
      `}</style>
    </header>
  );
}
