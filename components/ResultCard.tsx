"use client";

import React, { useMemo } from "react";

type Props = {
  pkg: any;
  index: number;
  currency: string;
  comparedIds?: string[];
  onToggleCompare?: (id: string) => void;
};

function fmt(n?: number, ccy = "USD") {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(
      Math.round(n)
    );
  } catch {
    return `${ccy} ${Math.round(n)}`;
  }
}

function minutesToText(m?: number) {
  if (typeof m !== "number") return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function parseISO(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(+d) ? d : null;
}
function diffMinutes(aISO?: string, bISO?: string): number | null {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  if (!a || !b) return null;
  return Math.max(0, Math.round((+b - +a) / 60000));
}

function yyyymmdd(s: string) {
  // expects yyyy-mm-dd
  return s && s.length >= 10 ? s.replaceAll("-", "") : s;
}

function googleFlightsUrl(origin: string, destination: string, departDate: string, roundTrip: boolean, returnDate?: string, curr = "USD") {
  // Stable generic link that opens Google Flights with query
  const q = encodeURIComponent(`flights from ${origin} to ${destination} on ${departDate}${roundTrip && returnDate ? " returning " + returnDate : ""}`);
  return `https://www.google.com/travel/flights?hl=en-US&curr=${encodeURIComponent(curr)}&q=${q}`;
}

function skyscannerUrl(origin: string, destination: string, departDate: string, roundTrip: boolean, returnDate?: string) {
  // Skyscanner path style uses yymmdd
  const d = yyyymmdd(departDate).slice(2); // yymmdd
  const r = returnDate ? yyyymmdd(returnDate).slice(2) : "";
  if (roundTrip && r) {
    return `https://www.skyscanner.com/transport/flights/${origin}/${destination}/${d}/${r}/?adults=1&cabinclass=economy`;
  }
  return `https://www.skyscanner.com/transport/flights/${origin}/${destination}/${d}/?adults=1&cabinclass=economy`;
}

async function bookViaTripTrio(pkg: any) {
  const res = await fetch("/api/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offer: pkg }),
  });
  const j = await res.json();
  if (!res.ok) {
    alert(j?.error || "Booking failed");
    return;
  }
  if (j.redirectUrl) {
    window.open(j.redirectUrl, "_blank", "noopener,noreferrer");
  } else {
    alert("Booking request received.");
  }
}

export default function ResultCard({ pkg, index, currency, comparedIds, onToggleCompare }: Props) {
  const f = pkg.flight || {};
  const out = f.segments_out || f.outbound || [];
  const back = f.segments_in || f.inbound || [];
  const airline = f.carrier_name || f.carrier || "Airline";
  const id = pkg.id || `f-${index}`;
  const origin = out?.[0]?.from || "";
  const destination = out?.[out.length - 1]?.to || "";
  const departDate = String(out?.[0]?.depart_time || "").slice(0, 10);
  const returnDate = String(back?.[0]?.depart_time || "").slice(0, 10);
  const roundTrip = back && back.length > 0;

  const flightTotal: number | undefined = pkg.flight_total ?? f.price_usd;
  const hotelTotal: number | undefined = pkg.hotel_total;
  const bundleTotal: number | undefined = pkg.total_cost;

  const airlineLink: { name: string; url: string } | null =
    pkg?.deeplinks?.airline || f?.deeplinks?.airline || null;

  const gflight = useMemo(
    () => googleFlightsUrl(origin, destination, departDate, !!roundTrip, returnDate, pkg.currency || currency),
    [origin, destination, departDate, roundTrip, returnDate, currency, pkg.currency]
  );
  const sky = useMemo(
    () => skyscannerUrl(origin, destination, departDate, !!roundTrip, returnDate),
    [origin, destination, departDate, roundTrip, returnDate]
  );

  const checked = comparedIds?.includes(id) ?? false;

  return (
    <article className="rc">
      <header className="rc-h">
        <div className="rc-title">
          <b>#{index + 1}</b> • {airline} • {f.cabin || "—"} •{" "}
          {typeof f.stops === "number" ? (f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`) : (out?.length > 1 ? `${out.length - 1} stop(s)` : "Nonstop")}
        </div>

        <div className="rc-price">
          <div className="price-main">
            {fmt(hotelTotal && hotelTotal > 0 ? bundleTotal : flightTotal, pkg.currency || currency)}
          </div>
          <div className="price-sub">
            {hotelTotal && hotelTotal > 0 ? (
              <>Flight {fmt(flightTotal, pkg.currency || currency)} + Hotel {fmt(hotelTotal, pkg.currency || currency)}</>
            ) : (
              <>Flight only</>
            )}
          </div>
        </div>
      </header>

      {/* FLIGHT block (always first) */}
      <div className="rc-block">
        <div className="rc-sub">Flight</div>

        {/* Outbound */}
        {Array.isArray(out) && out.length > 0 ? (
          <ul className="rc-list">
            {out.map((s: any, i: number) => (
              <React.Fragment key={`out-${i}`}>
                {i > 0 && (
                  <li className="layover">
                    Layover {out[i-1]?.to} • {minutesToText(diffMinutes(out[i-1]?.arrive_time, s?.depart_time) || undefined)}
                  </li>
                )}
                <li>
                  {s.from} → {s.to} • {String(s.depart_time).slice(11, 16)} →{" "}
                  {String(s.arrive_time).slice(11, 16)} ({minutesToText(s.duration_minutes)})
                </li>
              </React.Fragment>
            ))}
          </ul>
        ) : (
          <div className="muted">—</div>
        )}

        {/* Return */}
        {Array.isArray(back) && back.length > 0 && (
          <>
            <div className="rc-sub rc-sub2">Return</div>
            <ul className="rc-list">
              {back.map((s: any, i: number) => (
                <React.Fragment key={`ret-${i}`}>
                  {i > 0 && (
                    <li className="layover">
                      Layover {back[i-1]?.to} • {minutesToText(diffMinutes(back[i-1]?.arrive_time, s?.depart_time) || undefined)}
                    </li>
                  )}
                  <li>
                    {s.from} → {s.to} • {String(s.depart_time).slice(11, 16)} →{" "}
                    {String(s.arrive_time).slice(11, 16)} ({minutesToText(s.duration_minutes)})
                  </li>
                </React.Fragment>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* HOTEL block (below flight, never side-by-side) */}
      <div className="rc-block">
        <div className="rc-sub">Hotel</div>
        {pkg.hotel ? (
          <div className="hotel">
            <div className="h-name">
              {pkg.hotel.name} {pkg.hotel.star ? `(${Math.round(pkg.hotel.star)}★)` : ""}
            </div>
            <div className="muted">{pkg.hotel.city || ""}</div>

            {pkg.hotel.filteredOutByStar && (
              <div className="badge warn">
                No hotel met your star filter — showing flight only
              </div>
            )}

            {!pkg.hotel.filteredOutByStar && "price_converted" in pkg.hotel ? (
              <div className="h-price">
                {fmt(pkg.hotel.price_converted, pkg.hotel.currency || pkg.currency || currency)}
              </div>
            ) : null}

            {(pkg.hotel.deeplinks?.booking ||
              pkg.hotel.deeplinks?.hotels ||
              pkg.hotel.deeplinks?.expedia) &&
              !pkg.hotel.filteredOutByStar && (
                <div className="h-links">
                  {pkg.hotel.deeplinks?.booking && (
                    <a href="https://www.booking.com/" target="_blank" rel="noreferrer">
                      Booking.com
                    </a>
                  )}
                  {pkg.hotel.deeplinks?.hotels && (
                    <a href="https://www.hotels.com/" target="_blank" rel="noreferrer">
                      Hotels.com
                    </a>
                  )}
                  {pkg.hotel.deeplinks?.expedia && (
                    <a href="https://www.expedia.com/" target="_blank" rel="noreferrer">
                      Expedia
                    </a>
                  )}
                </div>
              )}
          </div>
        ) : (
          <div className="muted">No hotel in this bundle</div>
        )}
      </div>

      {/* ACTIONS */}
      <footer className="rc-f">
        <div className="rc-actions">
          {airlineLink ? (
            <a className="btn" href={airlineLink.url} target="_blank" rel="noreferrer">
              Book on {airlineLink.name}
            </a>
          ) : (
            <button className="btn" onClick={() => alert("No direct airline link available.")}>
              Book on airline
            </button>
          )}
          <a className="btn secondary" href={gflight} target="_blank" rel="noreferrer">
            Google Flights
          </a>
          <a className="btn secondary" href={sky} target="_blank" rel="noreferrer">
            Skyscanner
          </a>
          <button className="btn ghost" onClick={() => bookViaTripTrio(pkg)}>
            Book via TripTrio
          </button>
        </div>

        {onToggleCompare && (
          <label className="ck">
            <input type="checkbox" checked={checked} onChange={() => onToggleCompare(id)} />
            Add to compare
          </label>
        )}
      </footer>

      <style jsx>{`
        .rc { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:14px; display:grid; gap:14px; }
        .rc-h { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .rc-title { font-weight:900; color:#0f172a; }
        .rc-price { text-align:right; }
        .price-main { font-weight:900; color:#0ea5e9; font-size:18px; }
        .price-sub { color:#64748b; font-weight:700; font-size:12px; }

        .rc-block { display:grid; gap:8px; }
        .rc-sub { font-weight:900; color:#334155; }
        .rc-sub2 { margin-top:6px; }
        .rc-list { margin:0; padding-left:16px; display:grid; gap:4px; }
        .layover { color:#0f172a; font-weight:800; list-style-type: none; margin-left:-16px; }
        .hotel { display:grid; gap:6px; }
        .h-name { font-weight:900; color:#0f172a; }
        .h-price { font-weight:900; color:#059669; }
        .h-links { display:flex; gap:10px; flex-wrap:wrap; }
        .muted { color:#64748b; font-weight:700; }
        .badge.warn { display:inline-block; padding:4px 8px; border-radius:999px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-weight:800; font-size:12px; }

        .rc-f { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .rc-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .btn { height:34px; padding:0 12px; border-radius:10px; border:1px solid #0ea5e9; background:#0ea5e9; color:#fff; font-weight:900; }
        .btn.secondary { background:#fff; color:#0ea5e9; }
        .btn.ghost { background:#fff; color:#0f172a; border-color:#cbd5e1; }
        .ck { display:flex; gap:8px; align-items:center; font-weight:800; color:#334155; }
      `}</style>
    </article>
  );
}
