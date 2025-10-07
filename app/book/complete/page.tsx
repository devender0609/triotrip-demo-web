"use client";
export const dynamic = 'force-dynamic';


import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CompleteInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId") || "";

  return (
    <main style={{ maxWidth: 720, margin: "20px auto", padding: 16 }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ marginTop: 0, fontWeight: 900 }}>Booking complete</h1>
        <p>Your order was created in the Duffel sandbox.</p>
        <p><b>Order ID:</b> {orderId || "—"}</p>
        <div style={{ marginTop: 12 }}>
          <Link href="/" style={{ fontWeight: 800, textDecoration: "none", color: "#0ea5e9" }}>
            Back to TripTrio
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={null}>
      <CompleteInner />
    </Suspense>
  );
}

