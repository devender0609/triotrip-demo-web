"use client";
export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type OfferInfo = { total_amount: string; total_currency: string };

export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const flightId = params.get("flightId") || "";

  const [offer, setOffer] = useState<OfferInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // passenger (1 adult)
  const [title, setTitle] = useState<"mr"|"mrs"|"ms">("mr");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");           // YYYY-MM-DD
  const [gender, setGender] = useState<"m"|"f"|"x">("m");

  useEffect(() => {
    (async () => {
      if (!flightId) return;
      try {
        setErr(null);
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"}/duffel/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offer_id: flightId }),
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        setOffer({ total_amount: j.total_amount, total_currency: j.total_currency });
      } catch (e: any) {
        setErr(e?.message || "Could not fetch offer");
      }
    })();
  }, [flightId]);

  async function placeOrder() {
    try {
      setLoading(true); setErr(null);
      const body = {
        offer_id: flightId,
        contact: { email, phone_number: phone },
        passengers: [{
          title, given_name: first, family_name: last, born_on: dob, gender,
        }],
      };
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"}/duffel/order`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt);
      const j = JSON.parse(txt);
      const orderId = j?.data?.id || j?.id || "";
      router.push(`/book/complete?orderId=${encodeURIComponent(orderId)}`);
    } catch (e: any) {
      setErr(e?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "20px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <a href="/book" style={{ border: "1px solid #e2e8f0", borderRadius: 8, height: 36, lineHeight: "36px", padding: "0 10px", textDecoration: "none" }}>
          â† Back
        </a>
        <Link href="/" style={{ marginLeft: "auto", textDecoration: "none", fontWeight: 900, color: "#0ea5e9" }}>
          TripTrio Home
        </Link>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ marginTop: 0, marginBottom: 8, fontWeight: 900 }}>Checkout</h1>
        <p style={{ color: "#475569", marginTop: 0 }}>
          Enter passenger and contact details. Weâ€™ll create the order in Duffel (sandbox).
        </p>

        {offer && <div style={{ marginBottom: 12, fontWeight: 800 }}>Total: {offer.total_amount} {offer.total_currency}</div>}
        {err && <div style={{ color: "#b91c1c", marginBottom: 12 }}>{err}</div>}

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontWeight: 800 }}>Contact</legend>
          <div style={{ display: "grid", gap: 8 }}>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
                   style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }} />
            <input placeholder="Phone (+1â€¦)" value={phone} onChange={e=>setPhone(e.target.value)}
                   style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }} />
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontWeight: 800 }}>Passenger (Adult)</legend>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 8 }}>
            <select value={title} onChange={(e)=>setTitle(e.target.value as any)}
                    style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }}>
              <option value="mr">Mr</option><option value="mrs">Mrs</option><option value="ms">Ms</option>
            </select>
            <input placeholder="First name" value={first} onChange={e=>setFirst(e.target.value)}
                   style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }} />
            <input placeholder="Last name" value={last} onChange={e=>setLast(e.target.value)}
                   style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <input type="date" value={dob} onChange={e=>setDob(e.target.value)}
                   style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }} />
            <select value={gender} onChange={(e)=>setGender(e.target.value as any)}
                    style={{ height: 38, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px" }}>
              <option value="m">Male</option><option value="f">Female</option><option value="x">Unspecified</option>
            </select>
          </div>
        </fieldset>

        <button onClick={placeOrder} disabled={loading || !flightId || !email || !first || !last || !dob}
                style={{ height: 44, padding: "0 16px", border: "none", borderRadius: 10, fontWeight: 900,
                         color: "#fff", background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
                         opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Bookingâ€¦" : "Pay (sandbox) & Book"}
        </button>
      </div>
    </main>
  );
}

