"use client";
export const dynamic = 'force-dynamic';

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ConfirmPage() {
  const p = useSearchParams();
  const orderId = p.get("orderId") || "â€”";
  const status  = p.get("status")  || "created";
  const total   = p.get("total");
  const currency = (p.get("currency") || "USD").toUpperCase();

  const carrier = p.get("carrier") || "";
  const origin  = p.get("origin") || "";
  const dest    = p.get("destination") || "";
  const depart  = p.get("depart") || "";
  const ret     = p.get("return") || "";

  return (
    <main style={{ maxWidth: 880, margin: "20px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href="/" style={{ marginLeft: "auto", textDecoration: "none", fontWeight: 900, color: "#0ea5e9" }}>
          TripTrio Home
        </Link>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ marginTop: 0, fontWeight: 900 }}>Booking placed</h1>
        <p style={{ color: "#475569" }}>
          Thanks! Your booking has been created{status ? ` (status: ${status})` : ""}.
          Youâ€™ll also receive an email from the airline/TripTrio (sandbox).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div><b>Order ID:</b> {orderId}</div>
            <div><b>Airline:</b> {carrier || "â€”"}</div>
            <div><b>Route:</b> {origin} â†’ {dest}</div>
            <div><b>Depart:</b> {depart}</div>
            {ret ? <div><b>Return:</b> {ret}</div> : null}
          </div>
          <div style={{ justifySelf: "end", textAlign: "right" }}>
            {total ? <div style={{ fontSize: 22, fontWeight: 900 }}>{Number(total).toLocaleString(undefined, { style: "currency", currency })}</div> : null}
            <div style={{ color: "#64748b" }}>({currency})</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/" className="btn">Back to search</Link>
        </div>
      </div>
    </main>
  );
}
