"use client";

import Link from "next/link";
import Image from "next/image";
import AuthBar from "./AuthBar";

export default function Header() {
  return (
    <header className="tt-header" role="banner">
      <Link href="/" className="brand" aria-label="TripTrio home">
        {/* Use your PNG (or SVG) and show the name beside it */}
        <Image src="/triptrio-logo.png" alt="TripTrio" width={40} height={40} priority />
        <span className="title">TripTrio</span>
      </Link>

      <nav className="nav" aria-label="Main">
        <Link href="/saved">Saved</Link>
        <AuthBar />
      </nav>

      <style jsx>{`
        .tt-header{
          position: sticky; top:0; z-index:40;
          display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:10px 16px;
          background:#fff; border-bottom:1px solid #e5e7eb;
        }
        .brand{ display:inline-flex; align-items:center; gap:10px; text-decoration:none; }
        .title{
          font-weight:900; letter-spacing:-0.02em;
          background: linear-gradient(90deg,#0ea5e9,#10b981,#8b5cf6);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          font-size:20px;
        }
        .nav{ display:flex; gap:14px; align-items:center; font-weight:800; }
        .nav a{ color:#334155; }
        .nav a:hover{ text-decoration:underline; }
      `}</style>
    </header>
  );
}
