"use client";

import React from "react";

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
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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
  const stops = typeof f.stops === "number" ? f.stops : Math.max(0, (out?.length || 1) - 1);
  const id = pkg.id || `f-${index}`;

  // Totals provided by backend (flight_total is always the flight-only price)
  const flightTotal: number | undefined = pkg.flight_total;
  const hotelTotal: number | undefined = pkg.hotel_total;
  const bundleTotal: number | undefined = pkg.total_cost;

  const airlineLink: { name: string; url: string } | null =
    pkg?.deeplinks?.airline || f?.deeplinks?.airline || null;

  const checked = comparedIds?.includes(id) ?? false;

  return (
    <article className="rc">
      <header className="rc-h">
        <div className="rc-title">
          <b>#{index + 1}</b> • {airline} • {f.cabin || "—"} •{" "}
          {stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}
        </div>

        <div className="rc-price">
          {/* Show bundle price if a hotel is actually counted; otherwise show flight price */}
          <div className="price-main">
            {fmt(hotelTotal && hotelTotal > 0 ? bundleTotal : flightTotal, pkg.currency || currency)}
          </div>
          <div className="price-sub">
            {hotelTotal && hotelTotal > 0 ? (
              <>
                Flight {fmt(flightTotal, pkg.currency || currency)} + Hotel {fmt(hotelTotal, pkg.currency || currency)}
              </>
            ) : (
              <>Flight only</>
            )}
          </div>
        </div>
      </header>

      <div className="rc-body">
        <div className="rc-col">
          <div className="rc-block">
            <div className="rc-sub">Outbound</div>
            {Array.isArray(out) && out.length > 0 ? (
              <ul className="rc-list">
                {out.map((s: any, i: number) => (
                  <li key={i}>
                    {s.from} → {s.to} • {String(s.depart_time).slice(11, 16)} →{" "}
                    {String(s.arrive_time).slice(11, 16)} ({minutesToText(s.duration_minutes)})
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">—</div>
            )}
          </div>

          {Array.isArray(back) && back.length > 0 && (
            <div className="rc-block">
              <div className="rc-sub">Return</div>
              <ul className="rc-list">
                {back.map((s: any, i: number) => (
                  <li key={i}>
                    {s.from} → {s.to} • {String(s.depart_time).slice(11, 16)} →{" "}
                    {String(s.arrive_time).slice(11, 16)} ({minutesToText(s.duration_minutes)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rc-col">
          {pkg.hotel ? (
            <div className="rc-block">
              <div className="rc-sub">Hotel</div>
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
                  pkg.hotel.deeplinks?.expedia) && !pkg.hotel.filteredOutByStar && (
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
            </div>
          ) : (
            <div className="muted">No hotel in this bundle</div>
          )}
        </div>
      </div>

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

          <button className="btn secondary" onClick={() => bookViaTripTrio(pkg)}>
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
        .rc { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:12px; display:grid; gap:10px; }
        .rc-h { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .rc-title { font-weight:900; color:#0f172a; }
        .rc-price { text-align:right; }
        .price-main { font-weight:900; color:#0ea5e9; font-size:18px; }
        .price-sub { color:#64748b; font-weight:700; font-size:12px; }

        .rc-body { display:grid; gap:10px; grid-template-columns: 1fr 1fr; }
        .rc-col { display:grid; gap:10px; }
        .rc-sub { font-weight:900; color:#334155; margin-bottom:6px; }
        .rc-list { margin:0; padding-left:16px; }
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
        .ck { display:flex; gap:8px; align-items:center; font-weight:800; color:#334155; }

        @media (max-width: 820px) {
          .rc-body { grid-template-columns: 1fr; }
        }
      `}</style>
    </article>
  );
}
