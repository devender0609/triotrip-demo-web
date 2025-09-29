"use client";
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Title = "Mr" | "Mrs" | "Ms" | "Mx" | "Dr";
type Gender = "male" | "female" | "unspecified";

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();

  // from deeplink
  const flightId    = params.get("flightId")    || "";
  const currency    = (params.get("currency")   || "USD").toUpperCase();
  const totalRaw    = Number(params.get("total") || "");
  const paxRaw      = Number(params.get("pax") || "1");
  const total = Number.isFinite(totalRaw) ? totalRaw : undefined;
  const pax = Number.isFinite(paxRaw) && paxRaw > 0 ? paxRaw : 1;

  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }); }
    catch { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }); }
  }, [currency]);

  // contact
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");

  // passenger (adult 1)
  const [title, setTitle]   = useState<Title>("Mr");
  const [first, setFirst]   = useState("");
  const [last, setLast]     = useState("");
  const [dob, setDob]       = useState("");     // YYYY-MM-DD
  const [gender, setGender] = useState<Gender>("male");

  const canSubmit =
    flightId &&
    email.trim() &&
    first.trim() &&
    last.trim() &&
    dob; // keep it simple for sandbox

  async function handlePay() {
    if (!canSubmit) return;
    // This is still sandbox â€” stub server hook youâ€™ll wire to Duffel + Stripe later.
    try {
      const res = await fetch("/api/checkout/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightId,
          currency,
          total,
          pax,
          contact: { email, phone },
          passengers: [{
            title, first_name: first, last_name: last,
            date_of_birth: dob, gender
          }],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Checkout failed");
      }
      alert("Sandbox: this is where youâ€™d be redirected to Stripe Checkout.");
      // router.push("/success"); // when you have a success page
    } catch (e: any) {
      alert(e?.message || "Checkout failed");
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "16px auto", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => router.back()} className="btn-ghost">â† Back</button>
        <Link href="/" className="home-link">TripTrio Home</Link>
      </div>

      <section className="card">
        <h1 className="title">Checkout</h1>
        <p className="sub">Enter passenger and contact details. Weâ€™ll create the order in Duffel (sandbox).</p>

        <div className="total">
          <b>Total:</b>{" "}
          {total !== undefined ? <span className="amt">{fmt.format(Math.round(total))}</span> : "â€”"}
          <span className="meta">{pax > 1 ? `  â€¢  ${pax} passenger(s)` : ""}</span>
        </div>

        <div className="block">
          <div className="block-title">Contact</div>
          <div className="grid">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="tel"
              placeholder="Phone (+1â€¦)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="block">
          <div className="block-title">Passenger (Adult)</div>
          <div className="grid grid-4">
            <select value={title} onChange={(e) => setTitle(e.target.value as Title)}>
              {["Mr", "Mrs", "Ms", "Mx", "Dr"].map((t) => <option key={t} value={t as Title}>{t}</option>)}
            </select>
            <input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>
          <div className="grid one">
            <label className="doblabel">
              <span>Date of birth</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="actions">
          <button
            className="btn-primary"
            disabled={!canSubmit}
            onClick={handlePay}
            title={canSubmit ? "Proceed to sandbox payment" : "Fill required fields"}
          >
            Pay (sandbox) &amp; Book
          </button>
        </div>
      </section>

      <style jsx>{`
        .btn-ghost { border:1px solid #e2e8f0; border-radius:8px; height:36px; padding:0 10px; background:#fff; cursor:pointer; }
        .home-link { margin-left:auto; text-decoration:none; font-weight:900; color:#0ea5e9; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; display:grid; gap:12px; }
        .title { margin:0; font-weight:900; }
        .sub { margin:0; color:#475569; }
        .total { margin-top:4px; }
        .amt { font-weight:900; margin-left:6px; }
        .meta { color:#64748b; font-weight:700; margin-left:6px; }
        .block { border-top:1px solid #f1f5f9; padding-top:10px; display:grid; gap:8px; }
        .block-title { font-weight:900; color:#0f172a; }
        .grid { display:grid; gap:8px; grid-template-columns: 1fr 1fr; }
        .grid.grid-4 { grid-template-columns: 120px 1fr 1fr 160px; }
        .grid.one { grid-template-columns: 1fr; }
        input, select { height:42px; padding:0 10px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; }
        .doblabel { display:grid; gap:6px; font-weight:800; color:#334155; }
        .actions { margin-top:8px; }
        .btn-primary { height:42px; padding:0 16px; border:none; border-radius:10px; font-weight:900; color:#fff;
                       background:linear-gradient(90deg,#06b6d4,#0ea5e9); }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
        @media (max-width: 840px) {
          .grid { grid-template-columns: 1fr; }
          .grid.grid-4 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
