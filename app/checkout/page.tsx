"use client";
export const dynamic = "force-dynamic";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Title = "Mr" | "Mrs" | "Ms" | "Mx" | "Dr";
type Gender = "male" | "female" | "unspecified";

type Passenger = {
  title: Title;
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  gender: Gender;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE || "").startsWith("http")
    ? process.env.NEXT_PUBLIC_API_BASE!
    : "";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();

  // Accept both deeplink shapes
  const flightId = params.get("flightId") || "";
  const airline = params.get("airline") || "Airline";
  const origin = params.get("origin") || "—";
  const destination = params.get("destination") || "—";
  const currency = (params.get("currency") || params.get("ccy") || "USD").toUpperCase();
  const totalRawA = Number(params.get("total") || "");
  const totalRawB = Number(params.get("price") || "");
  const total = Number.isFinite(totalRawA) ? totalRawA : Number.isFinite(totalRawB) ? totalRawB : undefined;

  const paxRaw = Number(params.get("pax") || "1");
  const pax = Number.isFinite(paxRaw) && paxRaw > 0 ? Math.min(9, Math.max(1, paxRaw)) : 1; // clamp 1..9

  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency });
    } catch {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
    }
  }, [currency]);

  // Contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Passengers list (length = pax)
  const [passengers, setPassengers] = useState<Passenger[]>(
    Array.from({ length: pax }, () => ({
      title: "Mr",
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "male",
    }))
  );

  // If URL pax changes (navigation), resize the array
  React.useEffect(() => {
    setPassengers((prev) => {
      const next = prev.slice(0, pax);
      while (next.length < pax)
        next.push({ title: "Mr", first_name: "", last_name: "", date_of_birth: "", gender: "male" });
      return next;
    });
  }, [pax]);

  function upd(i: number, patch: Partial<Passenger>) {
    setPassengers((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  const canSubmit =
    (!!flightId || !!airline) &&
    !!email.trim() &&
    passengers.every((p) => p.first_name && p.last_name && p.date_of_birth);

  async function handlePay() {
    if (!canSubmit) return;

    const payload = {
      flightId: flightId || undefined,
      currency,
      total,
      pax,
      contact: { email, phone },
      passengers,
      airline,
      origin,
      destination,
    };

    try {
      const endpoint = API_BASE
        ? `${API_BASE.replace(/\/+$/, "")}/api/checkout/sandbox`
        : "/api/checkout/sandbox";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Checkout failed");
      }

      alert("Sandbox booking successful!");
      // router.push("/success");
    } catch (e: any) {
      alert(e?.message || "Checkout failed");
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "16px auto", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => router.back()} style={btnGhost}>← Back</button>
        <Link href="/" className="home-link">TripTrio Home</Link>
      </div>

      <section style={card}>
        <h1 style={titleStyle}>Checkout</h1>
        <p style={subStyle}>Enter passenger and contact details. This is a sandbox flow.</p>

        <div style={summary}>
          <div><b>Airline:</b> {airline}</div>
          <div><b>Route:</b> {origin} → {destination}</div>
          <div><b>Passengers:</b> {pax}</div>
          <div><b>Total:</b> {total !== undefined ? fmt.format(Math.round(total)) : "—"} <span style={{ color:"#64748b" }}>({currency})</span></div>
        </div>

        {/* Contact */}
        <div style={block}>
          <div style={blockTitle}>Contact</div>
          <div style={grid2}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        {/* Passengers */}
        <div style={block}>
          <div style={blockTitle}>Passengers</div>
          <div style={{ display: "grid", gap: 12 }}>
            {passengers.map((p, i) => (
              <div key={i} style={passengerCard}>
                <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Passenger {i + 1}</div>
                <div style={grid4}>
                  <select value={p.title} onChange={(e) => upd(i, { title: e.target.value as Title })}>
                    {["Mr", "Mrs", "Ms", "Mx", "Dr"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="First name" value={p.first_name} onChange={(e) => upd(i, { first_name: e.target.value })} />
                  <input placeholder="Last name" value={p.last_name} onChange={(e) => upd(i, { last_name: e.target.value })} />
                  <select value={p.gender} onChange={(e) => upd(i, { gender: e.target.value as Gender })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="unspecified">Unspecified</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 800, color: "#334155", marginBottom: 6 }}>Date of birth</label>
                  <input type="date" value={p.date_of_birth} onChange={(e) => upd(i, { date_of_birth: e.target.value })} style={input} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button disabled={!canSubmit} onClick={handlePay} style={btnPrimary} title={canSubmit ? "Proceed" : "Fill required fields"}>
            Pay (sandbox) &amp; Book
          </button>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}

/* ------------ styles ------------ */
const input: React.CSSProperties = { height: 42, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" };
const btnGhost: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 8, height: 36, padding: "0 10px", background: "#fff", cursor: "pointer" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "grid", gap: 12 };
const titleStyle: React.CSSProperties = { margin: 0, fontWeight: 900 };
const subStyle: React.CSSProperties = { margin: 0, color: "#475569" };
const summary: React.CSSProperties = { display: "grid", gap: 4, padding: 10, border: "1px dashed #e2e8f0", borderRadius: 8, background: "#f8fafc", fontWeight: 800 };
const block: React.CSSProperties = { display: "grid", gap: 8, marginTop: 12 };
const blockTitle: React.CSSProperties = { fontWeight: 900, color: "#0f172a" };
const grid2: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" };
const grid4: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "120px 1fr 1fr 160px" };
const passengerCard: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" };
const btnPrimary: React.CSSProperties = { height: 42, padding: "0 16px", border: "none", borderRadius: 10, fontWeight: 900, color: "#fff", background: "linear-gradient(90deg,#06b6d4,#0ea5e9)" };
