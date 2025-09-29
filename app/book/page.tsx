"use client";
export const dynamic = 'force-dynamic';

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type Pax = {
  title: "mr" | "mrs" | "ms" | "";
  given_name: string;
  family_name: string;
  gender: "m" | "f" | "x" | "";
  born_on: string; // YYYY-MM-DD
};

export default function BookPage() {
  const params = useSearchParams();
  const router = useRouter();

  const flightId    = params.get("flightId")    || "";
  const carrier     = params.get("carrier")     || "";
  const origin      = params.get("origin")      || "";
  const destination = params.get("destination") || "";
  const depart      = params.get("depart")      || "";
  const ret         = params.get("return")      || "";
  const hotel       = params.get("hotel")       || "";
  const currency    = (params.get("currency")   || "USD").toUpperCase();
  const totalRaw    = params.get("total");
  const cabin       = (params.get("cabin") || "").toUpperCase();
  const paxRaw      = params.get("pax");

  const paxCount = useMemo(() => {
    const n = Number(paxRaw);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.max(1, n), 9) : 1;
  }, [paxRaw]);

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // init passengers state
  const [passengers, setPassengers] = useState<Pax[]>(
    Array.from({ length: paxCount }).map(() => ({
      title: "",
      given_name: "",
      family_name: "",
      gender: "",
      born_on: "",
    }))
  );

  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency });
    } catch {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
    }
  }, [currency]);

  const total = useMemo(() => {
    const n = Number(totalRaw);
    return Number.isFinite(n) ? n : undefined;
  }, [totalRaw]);

  function updatePax(i: number, patch: Partial<Pax>) {
    setPassengers((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function validISODate(s: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s;
  }

  function validate(): string | null {
    if (!flightId) return "Missing flight ID.";
    if (!contactEmail || !/.+@.+\..+/.test(contactEmail)) return "Enter a valid contact email.";
    if (!contactPhone) return "Enter a contact phone number.";
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.given_name) return `Passenger ${i + 1}: first name is required.`;
      if (!p.family_name) return `Passenger ${i + 1}: last name is required.`;
      if (!p.title) return `Passenger ${i + 1}: title is required.`;
      if (!p.gender) return `Passenger ${i + 1}: gender is required.`;
      if (!p.born_on) return `Passenger ${i + 1}: Date of birth is required.`;
      if (!validISODate(p.born_on)) return `Passenger ${i + 1}: Date of birth must be YYYY-MM-DD.`;
    }
    return null;
  }

  async function payAndBook() {
    setError(null);
    setOrderId(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    try {
      setSubmitting(true);
      const r = await fetch(`${API_BASE}/duffel/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: flightId,
          contact: { email: contactEmail, phone_number: contactPhone },
          passengers: passengers.map((p) => ({
            title: p.title,
            given_name: p.given_name.trim(),
            family_name: p.family_name.trim(),
            born_on: p.born_on,
            gender: p.gender,
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Checkout failed");
      const id = j?.data?.id || j?.id || null;
      setOrderId(id);
      if (!id) setError("Order created, but no order ID returned.");
      // Optionally: router.push(`/book/confirmation?id=${id}`)
    } catch (e: any) {
      setError(e?.message || "Could not create order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "20px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => router.back()} className="btn" style={{ height: 36 }}>
          â† Back
        </button>
        <Link href="/" className="btn ghost" style={{ marginLeft: "auto", height: 36 }}>
          TripTrio Home
        </Link>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ marginTop: 0, marginBottom: 6, fontWeight: 900 }}>Book via TripTrio</h1>
        <p style={{ color: "#475569", marginTop: 0 }}>
          Enter passenger details and confirm to create a Duffel sandbox order.
        </p>

        {/* Summary */}
        <section
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div><b>Flight ID:</b> {flightId || "â€”"}</div>
            <div><b>Carrier:</b> {carrier || "â€”"}</div>
            <div><b>Route:</b> {origin || "â€”"} â†’ {destination || "â€”"}</div>
            <div><b>Depart:</b> {depart || "â€”"}</div>
            {ret ? <div><b>Return:</b> {ret}</div> : null}
            {hotel ? <div><b>Hotel:</b> {hotel}</div> : null}
          </div>

          <div
            style={{
              border: "1px dashed #e2e8f0",
              borderRadius: 12,
              padding: 12,
              background: "#f8fafc",
              display: "grid",
              gap: 6,
              justifyItems: "end",
            }}
          >
            <div style={{ color: "#64748b", fontWeight: 700 }}>
              {cabin ? `Cabin: ${cabin} â€¢ ` : ""}Pax: {paxCount}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {total !== undefined ? fmt.format(Math.round(total)) : "â€”"}
            </div>
            <div style={{ color: "#64748b", fontWeight: 700 }}>Total ({currency})</div>
          </div>
        </section>

        {/* Contact */}
        <section style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>Contact</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800, color: "#334155" }}>Email</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="name@example.com"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 800, color: "#334155" }}>Phone</span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 415 555 1234"
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        {/* Passengers */}
        <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <h3 style={{ margin: 0, fontWeight: 900 }}>Passenger details</h3>

          {passengers.map((p, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                background: "#ffffff",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, color: "#0f172a" }}>Passenger {i + 1}</div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10 }}>
                <label style={labelStyle}>
                  <span>Title</span>
                  <select
                    value={p.title}
                    onChange={(e) => updatePax(i, { title: e.target.value as Pax["title"] })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    <option value="mr">Mr</option>
                    <option value="ms">Ms</option>
                    <option value="mrs">Mrs</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  <span>First name (as on passport)</span>
                  <input
                    value={p.given_name}
                    onChange={(e) => updatePax(i, { given_name: e.target.value })}
                    style={inputStyle}
                    placeholder="Given name"
                  />
                </label>

                <label style={labelStyle}>
                  <span>Last name (as on passport)</span>
                  <input
                    value={p.family_name}
                    onChange={(e) => updatePax(i, { family_name: e.target.value })}
                    style={inputStyle}
                    placeholder="Family name"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={labelStyle}>
                  <span>Gender</span>
                  <select
                    value={p.gender}
                    onChange={(e) => updatePax(i, { gender: e.target.value as Pax["gender"] })}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                    <option value="x">Unspecified / X</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={p.born_on}
                    onChange={(e) => updatePax(i, { born_on: e.target.value })}
                    style={inputStyle}
                    placeholder="YYYY-MM-DD"
                    max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10)}
                  />
                </label>
              </div>
            </div>
          ))}
        </section>

        {/* Errors / Success */}
        {error && (
          <div style={{ marginTop: 12, padding: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 10, fontWeight: 800 }}>
            {error}
          </div>
        )}
        {orderId && (
          <div style={{ marginTop: 12, padding: 10, border: "1px solid #bbf7d0", background: "#ecfdf5", color: "#065f46", borderRadius: 10, fontWeight: 800 }}>
            âœ… Order created (sandbox). Duffel Order ID: <code>{orderId}</code>
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={payAndBook}
            disabled={submitting}
            style={{
              height: 42,
              padding: "0 16px",
              border: "none",
              borderRadius: 10,
              fontWeight: 900,
              color: "#fff",
              background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
            }}
          >
            {submitting ? "Processingâ€¦" : "Pay (sandbox) & Book"}
          </button>

          <a
            href="/"
            style={{
              height: 42,
              lineHeight: "42px",
              padding: "0 16px",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              fontWeight: 800,
              textDecoration: "none",
              color: "#0f172a",
              background: "#fff",
            }}
          >
            Start a new search
          </a>
        </div>
      </div>

      <style jsx>{`
        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          border: 1px solid #e2e8f0; background: #fff; color: #0f172a;
          padding: 0 10px; border-radius: 8px; font-weight: 800; text-decoration: none;
        }
        .btn.ghost { color: #0ea5e9; border-color: #bae6fd; }
        input, select { height: 40px; }
      `}</style>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "0 10px",
  height: 40,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 800,
  color: "#334155",
};

