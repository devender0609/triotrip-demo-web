"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sh">
      <div className="sh-inner">
        <Link href="/" className="brand" aria-label="TripTrio home">
          <span className="plane">✈</span>
          <span className="name">TripTrio</span>
        </Link>

        <nav className="nav">
          <Link href="/saved" className={`navlink ${isActive("/saved") ? "active" : ""}`}>
            Saved
          </Link>
          <Link href="/login" className={`navlink ${isActive("/login") ? "active" : ""}`}>
            Login
          </Link>
        </nav>
      </div>

      <style jsx>{`
        .sh { position: sticky; top: 0; z-index: 50; background: #ffffff;
              border-bottom: 1px solid #e5e7eb; }
        .sh-inner { max-width: 1100px; margin: 0 auto; padding: 10px 16px;
                    display: flex; align-items: center; justify-content: space-between; }

        /* Brand – the “previous” look */
        .brand { display: inline-flex; gap: 8px; align-items: baseline;
                 text-decoration: none; }                /* ← no underline */
        .plane { font-size: 18px; }
        .name  { font-weight: 900; letter-spacing: -0.02em; font-size: 20px; color: #0f172a; }

        /* Nav links: no underline, subtle hover, no bottom border/line */
        .nav { display: inline-flex; gap: 10px; }
        .navlink {
          text-decoration: none;                         /* ← no underline */
          border: none;                                  /* ← no line */
          color: #0f172a;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 8px;
        }
        .navlink:hover { background: #f1f5f9; }
        .navlink.active { background: #e2e8f0; }
      `}</style>
    </header>
  );
}
