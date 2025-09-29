// components/Brand.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="tt-brand" aria-label="TripTrio home">
      {/* Ensure your image is placed at public/logo.png */}
      <Image src="/logo.png" alt="TripTrio logo" width={96} height={96} priority />
      <span className="tt-brand-text">TripTrio</span>

      <style jsx>{`
        .tt-brand {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          user-select: none;
        }
        .tt-brand-text {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 0.3px;
          color: #0f172a;
        }
      `}</style>
    </Link>
  );
}
