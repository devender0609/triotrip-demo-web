"use client";

import React, { useMemo, useState } from "react";

type Props = {
  pkg: any;
  index?: number;
  currency: string;
  pax?: number;
  comparedIds?: string[];
  onToggleCompare?: (id: string) => void;
  onSavedChangeGlobal?: (count: number) => void;
  large?: boolean; // <<< enlarge fonts
};

export default function ResultCard({
  pkg,
  index = 0,
  currency,
  pax = 1,
  comparedIds,
  onToggleCompare,
  onSavedChangeGlobal,
  large = false,
}: Props) {
  const id = pkg.id || `r-${index}`;
  const airline = pkg.flight?.carrier_name || pkg.flight?.carrier || "Airline";
  const price =
    pkg.total_cost ??
    pkg.flight_total ??
    pkg.total_cost_flight ??
    pkg.flight?.price_usd_converted ??
    pkg.flight?.price_usd ??
    0;

  const stops =
    typeof pkg.flight?.stops === "number"
      ? pkg.flight.stops
      : Math.max(0, (pkg.flight?.segments_out?.length || 1) - 1);

  const outSegs = pkg.flight?.segments_out || [];
  const inSegs = pkg.flight?.segments_in || [];

  // ---- Book via TripTrio (ensures pax is passed) ----
  async function bookViaTripTrio() {
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer: {
            currency: pkg.currency || currency,
            total_cost: price,
            flight: {
              carrier_name: airline,
              origin: outSegs?.[0]?.from || pkg.origin,
              destination: outSegs?.[outSegs.length - 1]?.to || pkg.destination,
              price_usd: price,
            },
            pax,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.bookingUrl) throw new Error(j?.error || "Failed to create booking");
      const url = new URL(j.bookingUrl);
      url.searchParams.set("pax", String(pax));
      window.location.href = url.toString();
    } catch (e: any) {
      alert(e?.message || "Booking failed");
    }
  }

  // ---- Google Flights / Skyscanner deeplinks ----
  const route = `${outSegs?.[0]?.from || pkg.origin}-${outSegs?.[outSegs.length - 1]?.to || pkg.destination}`;
  const dateOut = (outSegs?.[0]?.depart_time || "").slice(0, 10);
  const dateRet = (inSegs?.[0]?.depart_time || "").slice(0, 10);
  const gf =
    `https://www.google.com/travel/flights?q=Flights%20to%20${encodeURIComponent(route)}%20on%20${encodeURIComponent(
      dateOut
    )}` + (dateRet ? `%20return%20${encodeURIComponent(dateRet)}` : "");
  const sky =
    `https://www.skyscanner.com/transport/flights/${encodeURIComponent(route.replace("-", "/"))}/${dateOut}` +
    (dateRet ? `/${dateRet}` : "") +
    `/?adults=${pax}`;

  // ---- Save (requires login) ----
  const [saving, setSaving] = useState(false);
  function requireLoginThenSave() {
    const user = localStorage.getItem("triptrio:user");
    if (!user) {
      if (confirm("Please sign in to save this option. Go to login page now?")) {
        window.location.href = "/login";
      }
      return;
    }
    try {
      setSaving(true);
      const saved = JSON.parse(localStorage.getItem("triptrio:saved") || "[]");
      const next = Array.isArray(saved) ? saved : [];
      if (!next.find((x: any) => x?.id === id)) next.push({ id, airline, price });
      localStorage.setItem("triptrio:saved", JSON.stringify(next));
      window.dispatchEvent(new Event("triptrio:saved:changed"));
      onSavedChangeGlobal?.(next.length);
    } finally {
      setSaving(false);
    }
  }

  const isCompared = comparedIds?.includes(id);

  // ---- Hotels (show up to 3 per star tier) ----
  const hotels: any[] = Array.isArray(pkg.hotels) ? pkg.hotels : [];
  const groupedHotels = useMemo(() => {
    const map = new Map<number, any[]>();
    for (let i = 0; i < hotels.length; i++) {
      const h = hotels[i];
      const s = Number(h?.stars) || 0;
      const arr = map.get(s) || [];
      arr.push(h);
      map.set(s, arr);
    }
    map.forEach((arr, k) => {
      map.set(k, arr.slice(0, 3));
    });
    const entries: Array<[number, any[]]> = Array.from(map.entries());
    entries.sort((a, b) => b[0] - a[0]);
    return entries;
  }, [hotels]);

  const fsBase = large ? 15 : 14;

  return (
    <article
      data-offer-id={id}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 14,
        display: "grid",
        gap: 12,
        fontSize: fsBase,
        boxShadow: "0 8px 24px rgba(2,6,23,.05)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <strong style={{ fontSize: large ? 18 : 16 }}>{airline}</strong>
          <span style={{ opacity: 0.6 }}>•</span>
          <span style={{ fontWeight: 800 }}>{stops === 0 ? "Nonstop" : `${stops} stop(s)`}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {onToggleCompare && (
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 900, color: "#334155" }}>
              <input type="checkbox" checked={!!isCompared} onChange={() => onToggleCompare(id)} />
              Compare
            </label>
          )}
          <button
            onClick={requireLoginThenSave}
            disabled={saving}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 900,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {/* Price + booking buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900, fontSize: large ? 22 : 18 }}>
          {Math.round(Number(price))} {pkg.currency || currency}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={gf}
            target="_blank"
            rel="noreferrer"
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
          >
            Google Flights
          </a>
          <a
            href={sky}
            target="_blank"
            rel="noreferrer"
            style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 900 }}
          >
            Skyscanner
          </a>
          <button
            onClick={bookViaTripTrio}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "none",
              color: "#fff",
              fontWeight: 900,
              background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
            }}
          >
            Book via TripTrio
          </button>
        </div>
      </div>

      {/* Layovers display */}
      {Array.isArray(outSegs) && outSegs.length > 0 && (
        <div style={{ fontSize: fsBase - 1, color: "#334155" }}>
          <b>Outbound:</b>{" "}
          {outSegs.map((s: any, i: number) => {
            const segText = `${s.from} → ${s.to}`;
            const layover =
              i < outSegs.length - 1 ? ` — layover before next: ~${Math.max(45, 30 + i * 20)}m` : "";
            return (
              <span key={i}>
                {segText}
                {layover}
                {i < outSegs.length - 1 ? " | " : ""}
              </span>
            );
          })}
        </div>
      )}
      {Array.isArray(inSegs) && inSegs.length > 0 && (
        <div style={{ fontSize: fsBase - 1, color: "#334155" }}>
          <b>Return:</b>{" "}
          {inSegs.map((s: any, i: number) => {
            const segText = `${s.from} → ${s.to}`;
            const layover =
              i < inSegs.length - 1 ? ` — layover before next: ~${Math.max(45, 30 + i * 20)}m` : "";
            return (
              <span key={i}>
                {segText}
                {layover}
                {i < inSegs.length - 1 ? " | " : ""}
              </span>
            );
          })}
        </div>
      )}

      {/* Hotels block (if present) */}
      {groupedHotels.length > 0 && (
        <section style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>Hotels (top 3 per star)</div>
          <div style={{ display: "grid", gap: 8 }}>
            {groupedHotels.map(([stars, arr]) => (
              <div key={String(stars)}>
                <div style={{ fontWeight: 900, color: "#334155", marginBottom: 6 }}>{stars}★</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 10,
                  }}
                >
                  {(arr as any[]).map((h, i) => (
                    <a
                      key={i}
                      href={h.link || "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 10,
                        textDecoration: "none",
                        color: "#0f172a",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{h.name}</div>
                      <div style={{ color: "#475569", fontSize: fsBase - 2 }}>
                        {Math.round(h.price || 0)} {h.currency || pkg.currency || "USD"}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
