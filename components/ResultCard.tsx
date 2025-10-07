"use client";

import React, { useMemo, useState } from "react";

/* Airline homepages (fallback to Google) */
const AIRLINE_SITE: Record<string, string> = {
  American: "https://www.aa.com",
  "American Airlines": "https://www.aa.com",
  Delta: "https://www.delta.com",
  "Delta Air Lines": "https://www.delta.com",
  United: "https://www.united.com",
  "United Airlines": "https://www.united.com",
  Alaska: "https://www.alaskaair.com",
  "Alaska Airlines": "https://www.alaskaair.com",
  Southwest: "https://www.southwest.com",
  JetBlue: "https://www.jetblue.com",
  "JetBlue Airways": "https://www.jetblue.com",
};

function fmtYYYYMMDD(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(" "); }

export default function ResultCard({
  pkg,
  currency,
  compareMode = false,   // when false, compare chip is hidden entirely
  onSave,
  passengersCount = 1,
}: {
  pkg: any;
  currency: string;
  compareMode?: boolean;
  onSave?: (id: string) => void;
  passengersCount?: number;
}) {
  const [checked, setChecked] = useState(false);

  const airline = pkg.airline_name || pkg.airline || "Airline";
  const airlineCode = pkg.airline_code || "";
  const price: number =
    pkg.flight?.price_total ??
    pkg.flight?.price ??
    pkg.flight?.price_usd_converted ??
    pkg.flight?.price_usd ??
    0;

  const outSegs = pkg.flight?.segments_out || [];
  const inSegs  = pkg.flight?.segments_in || [];
  const stops   = typeof pkg.flight?.stops === "number"
    ? pkg.flight.stops
    : Math.max(0, (outSegs.length || 1) - 1);

  /* --- Deeplinks (Skyscanner robust) --- */
  const oIata = String(pkg.origin || outSegs?.[0]?.from || "").slice(0, 3);
  const dIata = String(pkg.destination || outSegs?.[outSegs.length - 1]?.to || "").slice(0, 3);
  const outIso = outSegs?.[0]?.depart_time || (pkg.departDate ? `${pkg.departDate}T00:00:00Z` : "");
  const retIso = inSegs?.[0]?.depart_time || (pkg.returnDate ? `${pkg.returnDate}T00:00:00Z` : "");
  const dateOutISO = outIso ? outIso.slice(0, 10) : "";
  const dateRetISO = retIso ? retIso.slice(0, 10) : "";
  const pax = Math.max(1, Number(pkg.passengersAdults || passengersCount || 1));

  const skyBase = "https://www.skyscanner.com/transport/flights";
  const haveCodes = oIata.length === 3 && dIata.length === 3;
  const hasOut = Boolean(dateOutISO);
  const hasRet = Boolean(dateRetISO) && (inSegs.length > 0 || pkg.returnDate);

  const skyscannerUrl = haveCodes
    ? hasOut
      ? hasRet
        ? `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/${fmtYYYYMMDD(dateOutISO)}/${fmtYYYYMMDD(dateRetISO)}/?adults=${pax}`
        : `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/${fmtYYYYMMDD(dateOutISO)}/?adults=${pax}`
      : `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/?adults=${pax}`
    : skyBase;

  const googleFlightsUrl =
    `https://www.google.com/travel/flights?hl=en#flt=${oIata}.${dIata}.${dateOutISO};${hasRet ? `${dIata}.${oIata}.${dateRetISO};` : ""}${pax};;;;;`;

  const airlineSiteUrl =
    AIRLINE_SITE[airline] || `https://www.google.com/search?q=${encodeURIComponent(airline + " booking")}`;

  const trioTripUrl = (() => {
    const url = new URL("/checkout", typeof window !== "undefined" ? window.location.origin : "https://example.com");
    url.searchParams.set("count", String(pax));
    url.searchParams.set("airline", airline);
    url.searchParams.set("from", oIata);
    url.searchParams.set("to", dIata);
    if (dateOutISO) url.searchParams.set("out", dateOutISO);
    if (hasRet) url.searchParams.set("ret", dateRetISO);
    return url.toString();
  })();

  /* --- durations --- */
  const outDur = outSegs.reduce((t: number, s: any) => t + (Number(s?.duration_minutes) || 0), 0);
  const retDur = inSegs.reduce((t: number, s: any) => t + (Number(s?.duration_minutes) || 0), 0);
  const totalDur = outDur + retDur;

  /* --- hotels top-3 --- */
  const hotels: any[] = Array.isArray(pkg.hotels) ? pkg.hotels : [];
  const hotelTop3 = useMemo(() => {
    if (!hotels.length) return [] as any[];
    const arr = hotels.slice().sort((a, b) => (Number(a?.price) || 9e9) - (Number(b?.price) || 9e9));
    return arr.slice(0, 3);
  }, [hotels]);

  const chipBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 999,
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
    color: "inherit", // no blue links
  };

  return (
    <article className="rounded-2xl border bg-white" style={{ padding: 12 }}>
      {/* header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full w-9 h-9 flex items-center justify-center font-extrabold border">
            {airlineCode || airline.slice(0, 2).toUpperCase()}
          </div>
          <div className="font-extrabold text-lg">{airline}</div>
          {pkg.greener && <span className="text-xs font-bold px-2 py-1 rounded-full border">Greener</span>}
          {pkg.refundable && <span className="text-xs font-bold px-2 py-1 rounded-full border">Refundable</span>}
        </div>

        <div className="flex items-center gap-2">
          {compareMode && (
            <button
              className={cx("text-xs px-3 py-1 rounded-full border font-bold", checked && "bg-sky-100")}
              onClick={() => setChecked((v) => !v)}
              title="Compare"
            >
              {checked ? "Selected" : "Compare"}
            </button>
          )}
          <button className="text-xs px-3 py-1 rounded-full border font-bold" onClick={() => onSave?.(pkg.id)} style={{ color: "inherit" }}>
            Save
          </button>
        </div>
      </div>

      {/* body */}
      <section className="grid md:grid-cols-[1fr_220px] gap-12">
        <div>
          <div className="font-black text-slate-900">
            {pkg.origin} → {pkg.destination} • {stops} stop{stops === 1 ? "" : "s"} • {Math.floor(totalDur / 60)}h {totalDur % 60}m
          </div>

          <div className="mt-2 grid gap-2">
            {outSegs.map((s: any, i: number) => (
              <div key={`o${i}`} className="grid md:grid-cols-3 gap-2 items-center">
                <div className="font-bold">{s.from} → {s.to}</div>
                <div className="text-slate-600">{(s.depart_time || "").slice(0, 16).replace("T", " ")}</div>
                <div className="text-slate-600 font-semibold">{Math.round(Number(s.duration_minutes || 0) / 60)}h {Number(s.duration_minutes || 0) % 60}m</div>
              </div>
            ))}
          </div>

          {inSegs.length > 0 && (
            <div className="mt-4">
              <div className="font-black">Return</div>
              <div className="mt-1 grid gap-2">
                {inSegs.map((s: any, i: number) => (
                  <div key={`i${i}`} className="grid md:grid-cols-3 gap-2 items-center">
                    <div className="font-bold">{s.from} → {s.to}</div>
                    <div className="text-slate-600">{(s.depart_time || "").slice(0, 16).replace("T", " ")}</div>
                    <div className="text-slate-600 font-semibold">{Math.round(Number(s.duration_minutes || 0) / 60)}h {Number(s.duration_minutes || 0) % 60}m</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hotelTop3.length > 0 && (
            <div className="mt-4 border rounded-xl p-2">
              <div className="font-black text-slate-900 mb-2">Hotels (Top 3)</div>
              <div className="grid gap-2">
                {hotelTop3.map((h, i) => (
                  <div key={i} className="flex items-center justify-between border rounded-xl px-3 py-2">
                    <div className="font-bold">{h?.name} ({Number(h?.stars) || 0}★)</div>
                    <div className="font-extrabold">{Math.round(Number(h?.price) || 0)} {h?.currency || pkg.currency || currency}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* price + actions */}
        <div className="flex flex-col gap-2">
          <div className="text-right font-black text-2xl">
            {currency} {price.toFixed(0)}
          </div>

          <div className="flex flex-wrap gap-6 mt-2">
            <a href={airlineSiteUrl} target="_blank" rel="noreferrer" style={chipBtn}>Airline site</a>
            <a href={googleFlightsUrl} target="_blank" rel="noreferrer" style={chipBtn}>Google Flights</a>
            <a href={skyscannerUrl} target="_blank" rel="noreferrer" style={chipBtn}>Skyscanner</a>
          </div>

          <a
            href={trioTripUrl}
            className="w-full text-center font-extrabold rounded-xl border px-4 py-3 mt-4"
            style={{ textDecoration: "none", background: "#0ea5e9", color: "#fff", borderColor: "#0ea5e9" }}
          >
            Book via TrioTrip
          </a>
        </div>
      </section>
    </article>
  );
}
