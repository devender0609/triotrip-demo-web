"use client";
export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Title = "Mr" | "Mrs" | "Ms" | "Mx" | "Dr";
type Gender = "male" | "female" | "unspecified";
type Passenger = { title: Title; first_name: string; last_name: string; date_of_birth: string; gender: Gender };

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE || "").startsWith("http")
    ? process.env.NEXT_PUBLIC_API_BASE!
    : "";

/* ------------------------------ Page ------------------------------ */
function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();

  // accept multiple deeplink shapes
  const flightId = params.get("flightId") || "";
  const airline = params.get("airline") || "Airline";
  const origin = params.get("origin") || "—";
  const destination = params.get("destination") || "—";
  const currency = (params.get("currency") || params.get("ccy") || "USD").toUpperCase();
  const totalRawA = Number(params.get("total") || "");
  const totalRawB = Number(params.get("price") || "");
  const total = Number.isFinite(totalRawA) ? totalRawA : Number.isFinite(totalRawB) ? totalRawB : undefined;
  const paxRaw = Number(params.get("pax") || "1");
  const pax = Number.isFinite(paxRaw) && paxRaw > 0 ? Math.min(9, Math.max(1, paxRaw)) : 1;

  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }); }
    catch { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }); }
  }, [currency]);

  // contact + prefs
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);

  // passengers array (length = pax)
  const [passengers, setPassengers] = useState<Passenger[]>(
    Array.from({ length: pax }, () => ({ title: "Mr", first_name: "", last_name: "", date_of_birth: "", gender: "male" }))
  );
  useEffect(() => {
    setPassengers(prev => {
      const next = prev.slice(0, pax);
      while (next.length < pax)
        next.push({ title: "Mr", first_name: "", last_name: "", date_of_birth: "", gender: "male" });
      return next;
    });
  }, [pax]);

  // restore saved contact if present
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("triptrio:checkout:contact") || "{}");
      if (saved?.email) setEmail(saved.email);
      if (saved?.phone) setPhone(saved.phone);
    } catch {}
  }, []);

  // validation
  function allPassengersValid() {
    return passengers.every(p => p.first_name.trim() && p.last_name.trim() && p.date_of_birth);
  }
  const canSubmit = (!!flightId || !!airline) && !!email.trim() && allPassengersValid();

  function updPassenger(idx: number, patch: Partial<Passenger>) {
    setPassengers(prev => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

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

      if (saveDetails) {
        localStorage.setItem("triptrio:checkout:contact", JSON.stringify({ email, phone }));
      }

      alert("Sandbox booking successful!");
      // router.push("/success"); // add when you have a success page
    } catch (e: any) {
      alert(e?.message || "Checkout failed");
    }
  }

  /* ------------------------------ UI ------------------------------ */
  return (
    <main style={outer}>
      {/* Top bar */}
      <div style={topbar}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => router.back()} style={btnGhost}>← Back</button>
          <Link href="/" className="site-logo" style={logoLink}>
            <span style={logoMark}>▦</span>
            <span style={logoText}>TripTrio</span>
          </Link>
        </div>
        <div style={secureBadge}>🔒 Secure sandbox checkout</div>
      </div>

      {/* Stepper */}
      <ol style={stepper} aria-label="Checkout steps">
        {["Review", "Passengers", "Payment"].map((label, i) => (
          <li key={label} style={stepItem(i === 1)}>
            <span style={stepCircle(i === 1)}>{i + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {/* Grid layout */}
      <div style={grid}>
        {/* Left: forms */}
        <section style={card}>
          <h1 style={h1}>Passenger details</h1>
          <p style={muted}>Enter traveler information exactly as it appears on government ID.</p>

          {/* Contact */}
          <fieldset style={fieldset}>
            <legend style={legend}>Contact</legend>
            <div style={grid2}>
              <label style={label}>
                Email
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={input}
                />
              </label>
              <label style={label}>
                Phone
                <input
                  type="tel"
                  placeholder="+1 555-555-5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={input}
                />
              </label>
            </div>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
              />
              Save my details for next time
            </label>
          </fieldset>

          {/* Passengers */}
          <fieldset style={fieldset}>
            <legend style={legend}>Passengers ({pax})</legend>

            <div style={{ display: "grid", gap: 12 }}>
              {passengers.map((p, i) => (
                <div key={i} style={passengerCard}>
                  <div style={passengerHeader}>
                    <span style={pill}>#{i + 1}</span>
                    <strong>Primary traveler</strong>
                  </div>

                  <div style={grid4}>
                    <label style={label}>
                      Title
                      <select
                        value={p.title}
                        onChange={(e) => updPassenger(i, { title: e.target.value as Title })}
                        style={input}
                      >
                        {["Mr", "Mrs", "Ms", "Mx", "Dr"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </label>

                    <label style={label}>
                      First name
                      <input
                        required
                        placeholder="First name"
                        value={p.first_name}
                        onChange={(e) => updPassenger(i, { first_name: e.target.value })}
                        style={input}
                      />
                    </label>

                    <label style={label}>
                      Last name
                      <input
                        required
                        placeholder="Last name"
                        value={p.last_name}
                        onChange={(e) => updPassenger(i, { last_name: e.target.value })}
                        style={input}
                      />
                    </label>

                    <label style={label}>
                      Gender
                      <select
                        value={p.gender}
                        onChange={(e) => updPassenger(i, { gender: e.target.value as Gender })}
                        style={input}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="unspecified">Unspecified</option>
                      </select>
                    </label>
                  </div>

                  <div style={grid1}>
                    <label style={label}>
                      Date of birth
                      <input
                        required
                        type="date"
                        value={p.date_of_birth}
                        onChange={(e) => updPassenger(i, { date_of_birth: e.target.value })}
                        style={input}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Actions */}
          <div style={actions}>
            <button
              onClick={handlePay}
              disabled={!canSubmit}
              style={canSubmit ? btnPrimary : btnDisabled}
              title={canSubmit ? "Proceed with sandbox payment" : "Fill required fields"}
            >
              Pay &amp; Book (Sandbox)
            </button>
            <p style={{ ...muted, margin: 0 }}>No real charges. This is a demo flow.</p>
          </div>
        </section>

        {/* Right: sticky order summary */}
        <aside style={summaryWrap}>
          <div style={summaryCard}>
            <div style={summaryHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={airBadge}>{airline.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 900 }}>{airline}</div>
                  <div style={muted}>{origin} → {destination}</div>
                </div>
              </div>
              <div style={priceBig}>
                {total !== undefined ? fmt.format(Math.round(total)) : "—"}
                <span style={priceMinor}> {currency}</span>
              </div>
            </div>

            <div style={divider} />

            <ul style={metaList}>
              <li><b>Passengers:</b> {pax}</li>
              <li><b>Fare type:</b> Economy (example)</li>
              <li><b>Rules:</b> Changes may incur fees (demo)</li>
            </ul>

            <div style={divider} />

            <button
              onClick={handlePay}
              disabled={!canSubmit}
              style={{ ...btnPrimary, width: "100%" }}
            >
              Pay &amp; Book (Sandbox)
            </button>
            <div style={{ ...muted, textAlign: "center", marginTop: 8 }}>
              🔒 Your details are used only for this demo checkout.
            </div>
          </div>
        </aside>
      </div>
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

/* ------------------------------ Styles ------------------------------ */
const outer: React.CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 16,
  background: "linear-gradient(180deg, #f8fafc, #ffffff)",
  minHeight: "100dvh",
};

const topbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  maxWidth: 1200,
  width: "100%",
  margin: "0 auto",
};

const logoLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  borderBottom: "0",
};

const logoMark: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 16,
  boxShadow: "0 6px 18px rgba(14,165,233,.2)",
};

const logoText: React.CSSProperties = {
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.02em",
  fontSize: 18,
};

const secureBadge: React.CSSProperties = {
  fontWeight: 800,
  color: "#0f172a",
  background: "#e2f3fb",
  border: "1px solid #bae6fd",
  padding: "6px 10px",
  borderRadius: 999,
};

const stepper: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  display: "flex",
  gap: 18,
  alignItems: "center",
  listStyle: "none",
  padding: 0,
};
const stepItem = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: active ? "#0f172a" : "#64748b",
  fontWeight: active ? 900 : 800,
});
const stepCircle = (active: boolean): React.CSSProperties => ({
  width: 26,
  height: 26,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  border: active ? "none" : "1px solid #e2e8f0",
  background: active ? "linear-gradient(90deg,#06b6d4,#0ea5e9)" : "#fff",
  color: active ? "#fff" : "#0f172a",
  fontWeight: 900,
  boxShadow: active ? "0 8px 18px rgba(14,165,233,.25)" : "none",
});

const grid: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr)",
  maxWidth: 1200,
  width: "100%",
  margin: "0 auto",
};
const mediaQuery = "@media (min-width: 980px)";
(grid as any)[mediaQuery] = {
  gridTemplateColumns: "minmax(0, 1fr) 360px",
  alignItems: "start",
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 14,
  boxShadow: "0 8px 24px rgba(2,6,23,.06)",
};

const h1: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  letterSpacing: "-0.02em",
  fontSize: 22,
  color: "#0f172a",
};

const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };

const fieldset: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 12,
  background: "#fff",
};
const legend: React.CSSProperties = {
  padding: "0 6px",
  fontWeight: 900,
  color: "#0f172a",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 800,
  color: "#334155",
  fontSize: 13,
};

const checkLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
  color: "#334155",
};

const input: React.CSSProperties = {
  height: 42,
  padding: "0 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#fff",
  outline: "none",
};

const grid1: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "1fr" };
const grid2: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" };
const grid4: React.CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "120px 1fr 1fr 160px" };

const passengerCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};
const passengerHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
};
const pill: React.CSSProperties = {
  background: "#eef2ff",
  color: "#3730a3",
  border: "1px solid #c7d2fe",
  borderRadius: 999,
  padding: "4px 8px",
  fontWeight: 900,
  fontSize: 12,
};

const actions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const btnGhost: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  height: 36,
  padding: "0 12px",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const btnPrimary: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  border: "none",
  borderRadius: 12,
  fontWeight: 900,
  color: "#fff",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
  boxShadow: "0 10px 30px rgba(14,165,233,.25)",
  cursor: "pointer",
};
const btnDisabled: React.CSSProperties = {
  ...btnPrimary,
  opacity: 0.5,
  cursor: "not-allowed",
};

const summaryWrap: React.CSSProperties = {
  position: "relative",
};
(summaryWrap as any)[mediaQuery] = {
  position: "sticky",
  top: 16,
};

const summaryCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 8px 24px rgba(2,6,23,.06)",
};

const summaryHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const airBadge: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "#0ea5e9",
  color: "#fff",
  fontWeight: 900,
  boxShadow: "0 6px 18px rgba(14,165,233,.25)",
};

const priceBig: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#0f172a",
};
const priceMinor: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  fontSize: 12,
  marginLeft: 6,
};

const divider: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)",
  border: "none",
};

const metaList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 700,
};
