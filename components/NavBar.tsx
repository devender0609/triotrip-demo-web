// web/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function NavBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  // IMPORTANT: this must match a file inside web/public/
  // e.g. web/public/triptrio-logo.png  ->  src="/triptrio-logo.png"
  const logoSrc = "/triptrio-logo.png"; // <-- set this to your actual filename

  const homeReset = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.assign("/"); // full reload for fresh state
  };

  return (
    <header className="nav" role="navigation" aria-label="Main">
      <Link href="/" className="brand" onClick={homeReset} aria-label="TripTrio home">
        <img
          src={logoSrc}
          alt="TripTrio logo"
          width={28}
          height={28}
          className="logo"
          draggable={false}
        />
        <span className="title">TripTrio</span>
      </Link>

      <nav className="links">
        <Link
          href="/saved"
          className={`link ${isActive("/saved") ? "active" : ""}`}
          aria-current={isActive("/saved") ? "page" : undefined}
        >
          Saved
        </Link>

        <span className="sep" aria-hidden="true" />

        <Link
          href="/login"
          className={`link ${isActive("/login") ? "active" : ""}`}
          aria-current={isActive("/login") ? "page" : undefined}
        >
          Login
        </Link>
      </nav>

      <style jsx>{`
        .nav {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }

        /* Kill all underlines in the navbar */
        .nav :global(a),
        .brand,
        .link,
        .title {
          text-decoration: none !important;
        }

        .brand {
          display: inline-flex;      /* logo + text on one line */
          align-items: center;
          gap: 10px;
          white-space: nowrap;       /* never wrap title under logo */
        }

        .logo {
          display: block;
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        .title {
          font-weight: 900;
          font-size: 20px;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .links {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .link {
          padding: 6px 10px;
          border-radius: 10px;
          font-weight: 800;
          color: #0f172a;
          border: 1px solid transparent; /* avoids any underline-looking border */
        }
        .link:hover { background: #f1f5f9; }
        .link.active {
          background: #eef6ff; /* subtle active pill */
          border-color: #cfe8ff;
          color: #0b6bb5;
        }

        .sep {
          width: 1px;
          height: 20px;
          background: #e5e7eb;
          display: inline-block;
          margin: 0 2px;
        }
      `}</style>
    </header>
  );
}
