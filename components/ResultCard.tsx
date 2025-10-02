"use client";

import React, { useEffect, useMemo, useState } from "react";

type ResultCardProps = {
  pkg: any;
  index: number;
  currency: string;
  comparedIds?: string[];
  onToggleCompare?: (id: string) => void;
  onSavedChangeGlobal?: (count: number) => void;
};

function minutesToText(m?: number) {
  if (typeof m !== "number") return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min}m`;
}

function segsFromFlight(f: any, which: "out" | "ret"): any[] {
  if (!f) return [];
  if (which === "out") {
    return (
      f?.outbound ||
      f?.segments_out ||
      f?.legs?.[0]?.segments ||
      f?.itineraries?.[0]?.segments ||
      f?.segments ||
      []
    );
  } else {
    return (
      f?.inbound ||
      f?.segments_in ||
      f?.legs?.[1]?.segments ||
      f?.itineraries?.[1]?.segments ||
      []
    );
  }
}

function layoverMinutes(prevArrive: string, nextDepart: string) {
  const a = +new Date(prevArrive);
  const d = +new Date(nextDepart);
  if (!a || !d) return undefined;
  return Math.max(0, Math.round((d - a) / 60000));
}

function fmtCurrency(n?: number, ccy = "USD") {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(
      Math.round(n)
    );
  } catch {
    return `${ccy} ${Math.round(n)}`;
  }
}

/** localStorage helpers for “Save” */
const SAVED_KEY = "triptrio:saved";
function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]") || [];
  } catch {
    return [];
  }
}
function writeSaved(ids: string[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
}

/** airline url helper (basic map + fallback search) */
function airlineHomepage(name?: string): string | null {
  if (!name) return null;
  const key = name.toLowerCase();
  const map: Record<string, string> = {
    "american": "https://www.aa.com",
    "american airlines": "https://www.aa.com",
    "delta": "https://www.delta.com",
    "united": "https://www.united.com",
    "alaska": "https://www.alaskaair.com",
    "jetblue": "https://www.jetblue.com",
    "spirit": "https://www.spirit.com",
    "frontier": "https://www.flyfrontier.com",
    "southwest": "https://www.southwest.com",
    "air canada": "https://www.aircanada.com",
    "lufthansa": "https://www.lufthansa.com",
    "british airways": "https://www.britishairways.com",
    "air france": "https://wwws.airfrance.us",
    "klm": "https://www.klm.com",
    "emirates": "https://www.emirates.com",
    "qatar": "https://www.qatarairways.com",
    "qatar airways": "https://www.qatarairways.com",
    "singapore airlines": "https://www.singaporeair.com",
    "turkish airlines": "https://www.turkishairlines.com",
  };
  for (const k of Object.keys(map)) {
    if (key.includes(k)) return map[k];
  }
  // fallback: a generic search (still airline-first)
  return `https://www.google.com/search?q=${encodeURIComponent(name + " official site booking")}`;
}

export default function ResultCard({
  pkg,
  index,
  currency,
  comparedIds,
  onToggleCompare,
  onSavedChangeGlobal,
}: ResultCardProps) {
  const id = pkg?.id || `f-${index}`;
  const f = pkg?.flight || {};
  const airline = f?.carrier_name || f?.carrier || "Airline";
  const stops =
    typeof f?.stops === "number"
      ? f.stops
      : (() => {
          const segs = segsFromFlight(f, "out");
          return segs.length ? segs.length - 1 : 0;
        })();

  const price =
    pkg?.total_cost ??
    pkg?.total_cost_converted ??
    f?.price_usd_converted ??
    f?.price_usd ??
    0;

  /* save */
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    const saved = readSaved();
    setIsSaved(saved.includes(id));
  }, [id]);

  function toggleSave() {
    const saved = readSaved();
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    writeSaved(next);
    setIsSaved(next.includes(id));
    onSavedChangeGlobal?.(next.length);
    window.dispatchEvent(new Event("triptrio:saved:changed"));
  }

  /* compare */
  const compared = comparedIds?.includes(id);

  /* deeplinks */
  function openGoogleFlights() {
    const o = encodeURIComponent(f?.segments_out?.[0]?.from || pkg?.origin || "");
    const d = encodeURIComponent(f?.segments_out?.[0]?.to || pkg?.destination || "");
    const dd = encodeURIComponent(f?.segments_out?.[0]?.depart_time?.slice(0, 10) || "");
    const rd = encodeURIComponent(f?.segments_in?.[0]?.depart_time?.slice(0, 10) || "");
    const rt = rd ? `${o}.${d}.${dd}*${d}.${o}.${rd}` : `${o}.${d}.${dd}`;
    window.open(`https://www.google.com/travel/flights?q=${rt}`, "_blank", "noopener");
  }

  function openSkyscanner() {
    const o = (f?.segments_out?.[0]?.from || pkg?.origin || "").toUpperCase();
    const d = (f?.segments_out?.[0]?.to || pkg?.destination || "").toUpperCase();
    const dd = (f?.segments_out?.[0]?.depart_time || "").slice(0, 10).replaceAll("-", "");
    const rd = (f?.segments_in?.[0]?.depart_time || "").slice(0, 10).replaceAll("-", "");
    const route = rd ? `${o}/${d}/${dd}/${rd}` : `${o}/${d}/${dd}`;
    window.open(`https://www.skyscanner.com/transport/flights/${route}/`, "_blank", "noopener");
  }

  function openAirline() {
    const url = airlineHomepage(airline);
    if (url) window.open(url, "_blank", "noopener");
  }

  async function bookViaTripTrio() {
    // Use GET with query params to avoid POST edge issues in some hosts
    try {
      const params = new URLSearchParams({
        airline: airline,
        origin: f?.segments_out?.[0]?.from || pkg?.origin || "",
        destination: f?.segments_out?.slice(-1)?.[0]?.to || pkg?.destination || "",
        currency: pkg?.currency || currency || "USD",
        pax: String(pkg?.passengers ?? 1),
        price: String(price || 0),
      });
      const res = await fetch(`/api/book?${params.toString()}`, { method: "GET", cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j?.ok || !j?.bookingUrl) {
        throw new Error(j?.error || "Could not start booking");
      }
      window.open(j.bookingUrl, "_blank", "noopener");
    } catch (e: any) {
      alert(e?.message || "Booking failed");
    }
  }

  const outSegs = useMemo(() => segsFromFlight(f, "out"), [f]);
  const inSegs = useMemo(() => segsFromFlight(f, "ret"), [f]);

  /* styles — single-row, broad card */
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 14,
    boxShadow:
      "0 1px 0 rgba(2,6,23,.04), 0 10px 24px -12px rgba(2,6,23,.18), inset 0 -1px 0 rgba(2,6,23,.02)",
  };
  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  };
  const sectionTitle: React.CSSProperties = { fontWeight: 900, color: "#334155", marginTop: 2 };
  const box: React.CSSProperties = {
    border: "1px solid #f1f5f9",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  };
  const twoCol: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 12,
  };
  const tag: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontWeight: 800,
    fontSize: 12,
    color: "#0f172a",
  };
  const tagGood: React.CSSProperties = {
    ...tag,
    background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
    color: "#fff",
    border: "none",
  };
  const tagRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
  const btnRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
  const btn: React.CSSProperties = {
    height: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    fontWeight: 800,
  };
  const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
    border: "none",
    color: "#fff",
  };
  const saveBtn: React.CSSProperties = {
    ...btn,
    border: isSaved ? "2px solid #0ea5e9" : "1px solid #e2e8f0",
    background: isSaved ? "rgba(14,165,233,.08)" : "#fff",
  };
  const priceBox: React.CSSProperties = { fontWeight: 900, fontSize: 22, color: "#0f172a" };
  const gridSegments: React.CSSProperties = { display: "grid", gap: 10 };
  const seg: React.CSSProperties = {
    display: "grid",
    gap: 6,
    gridTemplateColumns: "1fr auto",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
  };
  const layover: React.CSSProperties = {
    textAlign: "center",
    fontWeight: 800,
    color: "#64748b",
  };

  return (
    <div style={card}>
      {/* HEADER */}
      <div style={headerRow}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>{airline}</div>
          <div style={tagRow}>
            <span style={tag}>{stops === 0 ? "Nonstop" : `${stops} stop(s)`}</span>
            {f?.cabin && <span style={tag}>{f.cabin}</span>}
            {f?.refundable ? <span style={tagGood}>Refundable</span> : null}
            {f?.greener ? <span style={tagGood}>Greener</span> : null}
          </div>
        </div>
        <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
          <div style={priceBox}>{fmtCurrency(price, pkg?.currency || currency)}</div>
          {onToggleCompare && (
            <label style={{ fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!!compared}
                onChange={() => onToggleCompare(id)}
              />
              Compare
            </label>
          )}
        </div>
      </div>

      {/* CONTENT: two columns – left flight/hotel details; right booking sections */}
      <div style={twoCol}>
        {/* LEFT: FLIGHT + HOTEL DETAILS */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* FLIGHT SECTION */}
          <div style={box}>
            <div style={sectionTitle}>Flight</div>
            <div style={{ height: 8 }} />
            {/* Outbound */}
            {outSegs?.length > 0 && (
              <div style={gridSegments} aria-label="Outbound">
                <div style={{ fontWeight: 800, color: "#334155" }}>Outbound</div>
                {outSegs.map((s: any, i: number) => {
                  const from = s?.from || s?.departure?.iataCode || "—";
                  const to = s?.to || s?.arrival?.iataCode || "—";
                  const dt = s?.depart_time || s?.departure?.at || "";
                  const at = s?.arrive_time || s?.arrival?.at || "";
                  const dur = minutesToText(s?.duration_minutes);
                  const prev = outSegs[i - 1];
                  const lay =
                    i > 0
                      ? layoverMinutes(prev?.arrive_time || prev?.arrival?.at, dt)
                      : undefined;

                  return (
                    <React.Fragment key={`out-${i}`}>
                      {i > 0 && <div style={layover}>Layover • {minutesToText(lay)}</div>}
                      <div style={seg}>
                        <div>
                          <div style={{ fontWeight: 800 }}>
                            {from} → {to}
                          </div>
                          <div style={{ color: "#64748b", fontWeight: 700 }}>
                            {String(dt).slice(0, 16).replace("T", " ")} →{" "}
                            {String(at).slice(0, 16).replace("T", " ")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 800 }}>{dur}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
            {/* Return */}
            {inSegs?.length > 0 && (
              <>
                <div style={{ height: 10 }} />
                <div style={gridSegments} aria-label="Return">
                  <div style={{ fontWeight: 800, color: "#334155" }}>Return</div>
                  {inSegs.map((s: any, i: number) => {
                    const from = s?.from || s?.departure?.iataCode || "—";
                    const to = s?.to || s?.arrival?.iataCode || "—";
                    const dt = s?.depart_time || s?.departure?.at || "";
                    const at = s?.arrive_time || s?.arrival?.at || "";
                    const dur = minutesToText(s?.duration_minutes);
                    const prev = inSegs[i - 1];
                    const lay =
                      i > 0
                        ? layoverMinutes(prev?.arrive_time || prev?.arrival?.at, dt)
                        : undefined;

                    return (
                      <React.Fragment key={`ret-${i}`}>
                        {i > 0 && <div style={layover}>Layover • {minutesToText(lay)}</div>}
                        <div style={seg}>
                          <div>
                            <div style={{ fontWeight: 800 }}>
                              {from} → {to}
                            </div>
                            <div style={{ color: "#64748b", fontWeight: 700 }}>
                              {String(dt).slice(0, 16).replace("T", " ")} →{" "}
                              {String(at).slice(0, 16).replace("T", " ")}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontWeight: 800 }}>{dur}</div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* HOTEL SECTION (if present) */}
          {pkg?.hotel && (
            <div style={box}>
              <div style={sectionTitle}>Hotel</div>
              <div style={{ height: 8 }} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {pkg.hotel.name} {pkg.hotel.star ? `(${Math.round(pkg.hotel.star)}★)` : ""}
                </div>
                <div style={{ fontWeight: 900 }}>
                  {fmtCurrency(
                    pkg.hotel.price_converted ?? pkg.hotel.total_usd,
                    pkg.hotel.currency || pkg.currency || "USD"
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: BOOKING BOXES (flight vs hotel kept separate) */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* FLIGHT BOOKING */}
          <div style={box}>
            <div style={sectionTitle}>Book Flight</div>
            <div style={{ height: 8 }} />
            <div style={btnRow}>
              <button style={btnPrimary} type="button" onClick={bookViaTripTrio}>
                Book via TripTrio
              </button>
              <button style={btn} type="button" onClick={openAirline}>
                Airline site
              </button>
              <button style={btn} type="button" onClick={openGoogleFlights}>
                Google Flights
              </button>
              <button style={btn} type="button" onClick={openSkyscanner}>
                Skyscanner
              </button>
              <button
                style={saveBtn}
                onClick={toggleSave}
                type="button"
                title={isSaved ? "Remove from saved" : "Save this option"}
              >
                {isSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
          </div>

          {/* HOTEL BOOKING (only if a hotel exists) */}
          {pkg?.hotel && (
            <div style={box}>
              <div style={sectionTitle}>Book Hotel</div>
              <div style={{ height: 8 }} />
              <div style={btnRow}>
                {pkg.hotel.deeplinks?.booking && (
                  <a style={btn} href={pkg.hotel.deeplinks.booking} target="_blank" rel="noopener">
                    Booking.com
                  </a>
                )}
                {pkg.hotel.deeplinks?.hotels && (
                  <a style={btn} href={pkg.hotel.deeplinks.hotels} target="_blank" rel="noopener">
                    Hotels.com
                  </a>
                )}
                {pkg.hotel.deeplinks?.expedia && (
                  <a style={btn} href={pkg.hotel.deeplinks.expedia} target="_blank" rel="noopener">
                    Expedia
                  </a>
                )}
                {!pkg.hotel.deeplinks && <span style={{ fontWeight: 700, color: "#64748b" }}>No hotel links</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
