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
function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function minsToHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}m`;
}

export default function ResultCard({
  pkg,
  currency,
  compareMode = false, // when false, compare chip is hidden entirely
  onSave,
  passengersCount = 1,
}: {
  pkg: any;
  currency: string;
  compareMode?: boolean;
  onSave?: (id: string) => void;
  passengersCount?: number;
}) {
  const [compareChecked, setCompareChecked] = useState(false);

  const airline = pkg.airline_name || pkg.airline || "Airline";
  const airlineCode = pkg.airline_code || "";

  const priceNum: number =
    pkg.flight?.price_total ??
    pkg.flight?.price ??
    pkg.flight?.price_usd_converted ??
    pkg.flight?.price_usd ??
    0;

  const formattedPrice = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(priceNum);
    } catch {
      return `${currency} ${priceNum.toFixed(0)}`;
    }
  }, [currency, priceNum]);

  const outSegs = pkg.flight?.segments_out || [];
  const inSegs = pkg.flight?.segments_in || [];

  const stops =
    typeof pkg.flight?.stops === "number"
      ? pkg.flight.stops
      : Math.max(0, (outSegs.length || 1) - 1);

  /* --- Deeplinks (Skyscanner robust) --- */
  const oIata = String(pkg.origin || outSegs?.[0]?.from || "").slice(0, 3);
  const dIata = String(
    pkg.destination || outSegs?.[outSegs.length - 1]?.to || ""
  ).slice(0, 3);
  const outIso =
    outSegs?.[0]?.depart_time ||
    (pkg.departDate ? `${pkg.departDate}T00:00:00Z` : "");
  const retIso =
    inSegs?.[0]?.depart_time ||
    (pkg.returnDate ? `${pkg.returnDate}T00:00:00Z` : "");
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
        ? `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/${fmtYYYYMMDD(
            dateOutISO
          )}/${fmtYYYYMMDD(dateRetISO)}/?adults=${pax}`
        : `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/${fmtYYYYMMDD(
            dateOutISO
          )}/?adults=${pax}`
      : `${skyBase}/${oIata.toLowerCase()}/${dIata.toLowerCase()}/?adults=${pax}`
    : skyBase;

  const googleFlightsUrl = `https://www.google.com/travel/flights?hl=en#flt=${oIata}.${dIata}.${dateOutISO};${
    hasRet ? `${dIata}.${oIata}.${dateRetISO};` : ""
  }${pax};;;;;`;

  const airlineSiteUrl =
    AIRLINE_SITE[airline] ||
    `https://www.google.com/search?q=${encodeURIComponent(
      airline + " booking"
    )}`;

  const trioTripUrl = (() => {
    const url = new URL(
      "/checkout",
      typeof window !== "undefined" ? window.location.origin : "https://example.com"
    );
    url.searchParams.set("count", String(pax));
    url.searchParams.set("airline", airline);
    url.searchParams.set("from", oIata);
    url.searchParams.set("to", dIata);
    if (dateOutISO) url.searchParams.set("out", dateOutISO);
    if (hasRet) url.searchParams.set("ret", dateRetISO);
    return url.toString();
  })();

  /* --- durations --- */
  const outDur = outSegs.reduce(
    (t: number, s: any) => t + (Number(s?.duration_minutes) || 0),
    0
  );
  const retDur = inSegs.reduce(
    (t: number, s: any) => t + (Number(s?.duration_minutes) || 0),
    0
  );
  const totalDur = outDur + retDur;

  /* --- hotels top-3 (kept, but only shown if present) --- */
  const hotels: any[] = Array.isArray(pkg.hotels) ? pkg.hotels : [];
  const hotelTop3 = useMemo(() => {
    if (!hotels.length) return [] as any[];
    const arr = hotels
      .slice()
      .sort((a, b) => (Number(a?.price) || 9e9) - (Number(b?.price) || 9e9));
    return arr.slice(0, 3);
  }, [hotels]);

  const chipBtn =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-semibold no-underline";

  // --- Layover helpers (only for round-trip view per requirement) ---
  function layoverBetween(a: any, b: any): number | null {
    // prefer an explicit layover_minutes on 'a'
    if (typeof a?.layover_minutes === "number") return a.layover_minutes;

    // otherwise try to compute if we have arrival and next departure timestamps
    const arrive = a?.arrive_time || a?.arrival_time;
    const depart = b?.depart_time || b?.departure_time;
    if (!arrive || !depart) return null;
    const t1 = Date.parse(arrive);
    const t2 = Date.parse(depart);
    if (Number.isFinite(t1) && Number.isFinite(t2) && t2 > t1) {
      return Math.round((t2 - t1) / 60000);
    }
    return null;
  }

  return (
    <article className="rounded-2xl border bg-white p-3 md:p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full w-9 h-9 flex items-center justify-center font-extrabold border">
            {airlineCode || airline.slice(0, 2).toUpperCase()}
          </div>
          <div className="font-extrabold text-lg">{airline}</div>
          {pkg.greener && (
            <span className="text-xs font-bold px-2 py-1 rounded-full border">
              Greener
            </span>
          )}
          {pkg.refundable && (
            <span className="text-xs font-bold px-2 py-1 rounded-full border">
              Refundable
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {compareMode && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compareChecked}
                onChange={(e) => setCompareChecked(e.target.checked)}
              />
              <span>Compare</span>
            </label>
          )}
          <button
            className="text-xs px-3 py-1 rounded-full border font-bold no-underline"
            onClick={() => onSave?.(pkg.id)}
          >
            Save
          </button>
        </div>
      </div>

      {/* Body */}
      <section className="grid md:grid-cols-[1fr_240px] gap-8">
        {/* Left: legs */}
        <div>
          <div className="font-black text-slate-900">
            {pkg.origin} → {pkg.destination} •{" "}
            {stops === 0 ? "Nonstop" : `${stops} stop${stops === 1 ? "" : "s"}`}{" "}
            • {minsToHM(totalDur)}
          </div>

          {/* Outbound */}
          <div className="mt-2 grid gap-2">
            {outSegs.map((s: any, i: number) => {
              const leg = (
                <div
                  key={`o${i}`}
                  className="grid md:grid-cols-3 gap-2 items-center"
                >
                  <div className="font-bold">
                    {s.from} → {s.to}
                  </div>
                  <div className="text-slate-600">
                    {(s.depart_time || "").slice(0, 16).replace("T", " ")}
                  </div>
                  <div className="text-slate-600 font-semibold">
                    {minsToHM(Number(s.duration_minutes || 0))}
                  </div>
                </div>
              );

              // Layover row between segments — ONLY if round-trip (hasRet)
              if (hasRet && i < outSegs.length - 1) {
                const next = outSegs[i + 1];
                const lay = layoverBetween(s, next);
                return (
                  <React.Fragment key={`o-wrap-${i}`}>
                    {leg}
                    {typeof lay === "number" && (
                      <div className="text-center text-sm italic text-slate-700">
                        Layover • {minsToHM(lay)}
                      </div>
                    )}
                  </React.Fragment>
                );
              }
              return leg;
            })}
          </div>

          {/* Return (only if segments exist) */}
          {inSegs.length > 0 && (
            <div className="mt-4">
              <div className="font-black">Return</div>
              <div className="mt-1 grid gap-2">
                {inSegs.map((s: any, i: number) => {
                  const leg = (
                    <div
                      key={`i${i}`}
                      className="grid md:grid-cols-3 gap-2 items-center"
                    >
                      <div className="font-bold">
                        {s.from} → {s.to}
                      </div>
                      <div className="text-slate-600">
                        {(s.depart_time || "").slice(0, 16).replace("T", " ")}
                      </div>
                      <div className="text-slate-600 font-semibold">
                        {minsToHM(Number(s.duration_minutes || 0))}
                      </div>
                    </div>
                  );

                  // Layover row between return segments (always round-trip here)
                  if (i < inSegs.length - 1) {
                    const next = inSegs[i + 1];
                    const lay = layoverBetween(s, next);
                    return (
                      <React.Fragment key={`i-wrap-${i}`}>
                        {leg}
                        {typeof lay === "number" && (
                          <div className="text-center text-sm italic text-slate-700">
                            Layover • {minsToHM(lay)}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }
                  return leg;
                })}
              </div>
            </div>
          )}

          {/* Hotels Top-3 (only when provided; keeps your rule “Top-3 for hotels”) */}
          {hotelTop3.length > 0 && (
            <div className="mt-4 border rounded-xl p-2">
              <div className="font-black text-slate-900 mb-2">Hotels (Top 3)</div>
              <div className="grid gap-2">
                {hotelTop3.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border rounded-xl px-3 py-2"
                  >
                    <div className="font-bold">
                      {h?.name} ({Number(h?.stars) || 0}★)
                    </div>
                    <div className="font-extrabold">
                      {Math.round(Number(h?.price) || 0)}{" "}
                      {h?.currency || pkg.currency || currency}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: price + actions */}
        <div className="flex flex-col gap-3">
          <div className="text-right font-black text-2xl">{formattedPrice}</div>

          <div className="flex flex-wrap gap-2 mt-1">
            <a
              href={airlineSiteUrl}
              target="_blank"
              rel="noreferrer"
              className={chipBtn}
            >
              Airline site
            </a>
            <a
              href={googleFlightsUrl}
              target="_blank"
              rel="noreferrer"
              className={chipBtn}
            >
              Google Flights
            </a>
            <a
              href={skyscannerUrl}
              target="_blank"
              rel="noreferrer"
              className={chipBtn}
            >
              Skyscanner
            </a>
          </div>

          <a
            href={trioTripUrl}
            className="w-full text-center font-extrabold rounded-xl border px-4 py-3 mt-3 no-underline"
            style={{
              background: "#0ea5e9",
              color: "#fff",
              borderColor: "#0ea5e9",
            }}
          >
            Book via TrioTrip
          </a>
        </div>
      </section>
    </article>
  );
}
