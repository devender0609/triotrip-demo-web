// web/components/ComparePanel.tsx
"use client";

import React, { useMemo } from "react";

/* ----- tiny helpers (kept local to avoid imports) ----- */
const clean = (v: any) => (v == null ? "" : String(v).trim());
const display = (v: any) => (clean(v) ? String(v) : "—");
const get = (obj: any, path: string) =>
  path.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), obj);
const firstArray = (obj: any, paths: string[]) => {
  for (const p of paths) {
    const v = get(obj, p);
    if (Array.isArray(v) && v.length) return v;
  }
  return [];
};
const sumMinutes = (arr: any[], key = "duration_minutes") =>
  arr.reduce((t, s) => t + (Number(s?.[key]) || 0), 0);
const stopsText = (n?: number) =>
  typeof n === "number" ? (n === 0 ? "Nonstop" : `${n} stop${n === 1 ? "" : "s"}`) : "—";

const isIata = (s: string) => /^[A-Z]{3}$/.test(s);
const iataFromString = (s?: string): string => {
  const t = (clean(s) || "").toUpperCase();
  if (!t) return "";
  const m = /\(([A-Z]{3})\)/.exec(t);
  if (m) return m[1];
  if (isIata(t)) return t;
  const hit = t.split(/[\s,/-]+/).find(isIata);
  return hit || "";
};
const iataFromNode = (seg: any, node: "departure" | "arrival"): string => {
  const n = seg?.[node];
  const obj = iataFromString(
    n?.iataCode || n?.iata || n?.code || n?.airportCode || n?.airport || n?.id || n?.name
  );
  if (obj) return obj;
  const flat = iataFromString(
    node === "departure"
      ? seg?.from || seg?.origin || seg?.fromCode || seg?.originCode || seg?.departureAirportCode || seg?.dep
      : seg?.to || seg?.destination || seg?.toCode || seg?.destinationCode || seg?.arrivalAirportCode || seg?.arr
  );
  if (flat) return flat;
  for (const [k, v] of Object.entries(seg || {})) {
    if (!/iata|code|airport|from|to|origin|dest|dep|arr/i.test(k)) continue;
    const hit = iataFromString(String(v || ""));
    if (hit) return hit;
  }
  return "";
};
const timeFrom = (seg: any, node: "departure" | "arrival") => {
  const raw =
    seg?.[node]?.at ||
    seg?.[node]?.time ||
    (node === "departure" ? seg?.depart_time : seg?.arrive_time) ||
    (node === "departure" ? seg?.departureTime : seg?.arrivalTime);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isFinite(+d)) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return clean(raw);
};

function formatLeg(segs: any[]) {
  if (!segs?.length) return "—";
  const parts: string[] = [];
  segs.forEach((s: any, i: number) => {
    const from = iataFromNode(s, "departure") || "—";
    const to = iataFromNode(s, "arrival") || "—";
    const dt = timeFrom(s, "departure") || "—";
    const at = timeFrom(s, "arrival") || "—";
    if (i > 0 && Number.isFinite(Number(segs[i - 1]?.layover_minutes))) {
      const lay = Number(segs[i - 1]?.layover_minutes);
      parts.push(`(Layover ${Math.floor(lay / 60)}h ${lay % 60}m)`);
    }
    parts.push(`${from} ${dt} → ${to} ${at}`);
  });
  return parts.join("  •  ");
}

/* ----- component ----- */
type ComparePanelProps = {
  items: any[];                 // the packages you’re comparing (max 3)
  currency: string;
  onClose: () => void;
  onRemove?: (id: string) => void;
};

export default function ComparePanel({ items, currency, onClose, onRemove }: ComparePanelProps) {
  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "USD").toUpperCase() });
    } catch {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
    }
  }, [currency]);

  return (
    <div className="cmp-overlay" role="dialog" aria-modal="true" aria-label="Compare flights">
      <div className="cmp-card">
        <div className="cmp-head">
          <div className="cmp-title">Compare</div>
          <button className="cmp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="cmp-empty">No items selected.</div>
        ) : (
          <div className="cmp-tablewrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Airline</th>
                  <th>Price</th>
                  <th>Stops</th>
                  <th>Duration</th>
                  <th style={{ minWidth: 320 }}>Outbound</th>
                  <th style={{ minWidth: 320 }}>Return</th>
                  <th>Refundable</th>
                  <th>Book</th>
                </tr>
              </thead>
              <tbody>
                {items.map((pkg) => {
                  const f = pkg?.flight || {};
                  const outbound = firstArray(f, [
                    "outbound","segments_out","out","legs.0.segments","itineraries.0.segments",
                    "segments_outbound","segmentsOut","segments",
                  ]);
                  const inbound = firstArray(f, [
                    "inbound","segments_in","ret","return","return_segments",
                    "legs.1.segments","itineraries.1.segments","segmentsInbound",
                  ]);
                  const durationOut = sumMinutes(outbound) || f?.duration_minutes || undefined;
                  const durationRet = sumMinutes(inbound) || undefined;
                  const totalDur =
                    typeof f?.duration_minutes === "number"
                      ? f.duration_minutes
                      : (durationOut || 0) + (durationRet || 0) || undefined;
                  const stops =
                    typeof f?.stops === "number" ? f.stops : outbound.length ? outbound.length - 1 : undefined;

                  const price =
                    (typeof pkg?.total_cost_converted === "number" && pkg.total_cost_converted) ||
                    (typeof pkg?.total_cost === "number" && pkg.total_cost) ||
                    (typeof f?.price_usd_converted === "number" && f.price_usd_converted) ||
                    (typeof f?.price_usd === "number" && f.price_usd) ||
                    0;

                  const airline =
                    f?.carrier_name ||
                    outbound?.[0]?.airlineName ||
                    outbound?.[0]?.marketingCarrier ||
                    f?.carrier ||
                    "Airline";

                  const id = String(pkg?.id || "");
                  return (
                    <tr key={id || Math.random()}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{display(airline)}</div>
                        {onRemove && id && (
                          <button className="smalllink" onClick={() => onRemove(id)}>remove</button>
                        )}
                      </td>
                      <td>{fmt.format(Math.round(Number(price) || 0))}</td>
                      <td>{stopsText(typeof stops === "number" ? stops : undefined)}</td>
                      <td>
                        {typeof totalDur === "number"
                          ? `${Math.floor(totalDur / 60)}h ${totalDur % 60}m`
                          : "—"}
                      </td>
                      <td className="mono">{formatLeg(outbound)}</td>
                      <td className="mono">{inbound?.length ? formatLeg(inbound) : "—"}</td>
                      <td>{f?.refundable ? "Yes" : "No"}</td>
                      <td className="book">
                        {f?.bookingLinks?.airlineSite && (
                          <a href={f.bookingLinks.airlineSite} target="_blank" rel="noopener noreferrer">Airline</a>
                        )}
                        {f?.bookingLinks?.googleFlights && (
                          <a href={f.bookingLinks.googleFlights} target="_blank" rel="noopener noreferrer">Google</a>
                        )}
                        {f?.bookingLinks?.skyscanner && (
                          <a href={f.bookingLinks.skyscanner} target="_blank" rel="noopener noreferrer">Skyscanner</a>
                        )}
                        {f?.bookingLinks?.triptrio && (
                          <a href={f.bookingLinks.triptrio} target="_blank" rel="noopener noreferrer">TripTrio</a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .cmp-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,.45);
          display:flex; align-items:center; justify-content:center; padding: 16px;
          z-index: 1000;
        }
        .cmp-card {
          width: min(1100px, 100%);
          background: #fff; border-radius: 14px; border: 1px solid #e5e7eb;
          box-shadow: 0 20px 50px rgba(0,0,0,.25);
          display: grid; grid-template-rows: auto 1fr; max-height: 90vh;
        }
        .cmp-head {
          display:flex; align-items:center; justify-content:space-between;
          padding: 12px 14px; border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(90deg,#f8fafc,#f1f5f9);
        }
        .cmp-title { font-weight: 900; font-size: 16px; }
        .cmp-close {
          border: 1px solid #e2e8f0; background: #fff; border-radius: 10px;
          height: 32px; padding: 0 10px; font-weight: 900; cursor: pointer;
        }
        .cmp-empty { padding: 20px; }
        .cmp-tablewrap { overflow: auto; }
        .cmp-table {
          width: 100%; border-collapse: separate; border-spacing: 0;
        }
        .cmp-table th, .cmp-table td {
          text-align: left; padding: 10px 12px; vertical-align: top;
          border-bottom: 1px solid #eef2f7;
        }
        .cmp-table thead th {
          position: sticky; top: 0; background: #fff; z-index: 1; font-weight: 900; color: #0f172a;
        }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .book a {
          display:inline-block; margin: 2px 6px 2px 0; padding: 6px 8px; border-radius: 8px;
          border: 1px solid #e2e8f0; text-decoration: none; font-weight: 800; background: #fff;
        }
        .smalllink {
          margin-top: 4px; border: none; background: none; padding: 0;
          color: #0b6bb5; font-size: 12px; cursor: pointer; text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
