"use client";

import Image from "next/image";
import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="tt-brand" aria-label="TrioTrip home">
      {/* Make sure the file really exists at /public/logo.png */}
      <Image src="/logo.png" alt="TrioTrip logo" width={48} height={48} priority />
      <span className="tt-brand-text">TripTrio</span>

      <style jsx>{`
        .tt-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          user-select: none;
        }
        .tt-brand-text {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 0.2px;
          color: #0f172a;
        }
      `}</style>
    </Link>
  );
}
