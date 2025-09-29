"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getSupa } from "../lib/auth/supabase";
import { addFavorite, removeFavorite } from "../lib/api";

type Props = {
  pkg: any;
  index: number;
  onSaved?: () => void;
  currency?: string;
  comparedIds?: string[];
  onToggleCompare?: (id: string) => void;
};

const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines",  UA: "United Airlines",   DL: "Delta Air Lines",
  WN: "Southwest Airlines", AS: "Alaska Airlines",   B6: "JetBlue",
  BA: "British Airways",    LH: "Lufthansa",         AF: "Air France",
  KL: "KLM",                QR: "Qatar Airways",     EK: "Emirates",
  SQ: "Singapore Airlines", QF: "Qantas",            IB: "Iberia",
  AZ: "ITA Airways",        AC: "Air Canada",        VS: "Virgin Atlantic",
  TK: "Turkish Airlines",   NH: "ANA",               JL: "JAL",
};

const AIRLINE_SITES: Record<string, string> = {
  AA: "https://www.aa.com", UA: "https://www.united.com", DL: "https://www.delta.com",
  WN: "https://www.southwest.com", AS: "https://www.alaskaair.com", B6: "https://www.jetblue.com",
  BA: "https://www.britishairways.com", LH: "https://www.lufthansa.com", AF: "https://wwws.airfrance.us",
  KL: "https://www.klm.com", QR: "https://www.qatarairways.com", EK: "https://www.emirates.com",
  SQ: "https://www.singaporeair.com", QF: "https://www.qantas.com", IB: "https://www.iberia.com",
  AZ: "https://www.ita-airways.com", AC: "https://www.aircanada.com", VS: "https://www.virginatlantic.com",
  TK: "https://www.turkishairlines.com", NH: "https://www.ana.co.jp", JL: "https://www.jal.co.jp",
};

/* ---------------- helpers ---------------- */
const clean = (v: any): string => {
  const s = v == null ? "" : String(v).trim();
  if (!s) return "";
  const low = s.toLowerCase();
  return low === "undefined" || low === "null" ? "" : s;
};
const display = (v: any): string => (clean(v) ? String(v) : "—");
const first = (...vals: any[]) => { for (const v of vals) { const s = clean(v); if (s) return s; } return ""; };
const get = <T = any,>(obj: any, path: string): T | undefined =>
  path.split(".").reduce<any>((o, k) => (o == null ? o : (o as any)[k]), obj);
const firstArray = (obj: any, paths: string[]): any[] => { for (const p of paths) {
  const v = get<any[]>(obj, p); if (Array.isArray(v) && v.length) return v; } return []; };
const sumMinutes = (arr: any[], key = "duration_minutes") => arr.reduce((t, s) => t + (Number(s?.[key]) || 0), 0);
const stopsText = (n: any) => (typeof n === "number" ? (n === 0 ? "Nonstop" : `${n} stop${n === 1 ? "" : "s"}`) : "—");
const isIata = (s: string) => /^[A-Z]{3}$/.test(s);
const iataFromString = (s?: string): string => {
  const t = clean(s).toUpperCase(); if (!t) return "";
  const m = /\(([A-Z]{3})\)/.exec(t); if (m) return m[1];
  if (isIata(t)) return t;
  const hit = t.split(/[\s,/-]+/).find(isIata); return hit || "";
};
const iataFromNode = (seg: any, node: "departure" | "arrival"): string => {
  const n = seg?.[node];
  const tryObj = iataFromString(first(n?.iataCode, n?.iata, n?.code, n?.airportCode, n?.airport, n?.id, n?.name));
  if (tryObj) return tryObj;
  const flat = iataFromString(first(
    node === "departure" ? seg?.from : seg?.to,
    node === "departure" ? seg?.origin : seg?.destination,
    node === "departure" ? seg?.fromCode : seg?.toCode,
    node === "departure" ? seg?.originCode : seg?.destinationCode,
    node === "departure" ? seg?.departureAirportCode : seg?.arrivalAirportCode,
    node === "departure" ? seg?.dep : seg?.arr
  ));
  if (flat) return flat;
  for (const [k, v] of Object.entries(seg || {})) {
    if (!/iata|code|airport|from|to|origin|dest|dep|arr/.test(k.toLowerCase())) continue;
    const hit = iataFromString(String(v || "")); if (hit) return hit;
  }
  return "";
};
const timeFrom = (seg: any, node: "departure" | "arrival") => {
  const raw = first(seg?.[node]?.at, seg?.[node]?.time,
    node === "departure" ? seg?.depart_time : seg?.arrive_time,
    node === "departure" ? seg?.departureTime : seg?.arrivalTime);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isFinite(+d)) return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  return clean(raw);
};
const isoFrom = (seg: any, node: "departure" | "arrival"): string => {
  return first(seg?.[node]?.at,
               node === "departure" ? seg?.depart_time : seg?.arrive_time,
               node === "departure" ? seg?.departureTime : seg?.arrivalTime);
};
const minutesBetween = (aISO?: string, bISO?: string): number | null => {
  const a = aISO ? new Date(aISO) : null;
  const b = bISO ? new Date(bISO) : null;
  if (!a || !b || !Number.isFinite(+a) || !Number.isFinite(+b)) return null;
  const diff = (b.getTime() - a.getTime()) / 60000;
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff)) : null;
};
const carrierCodeFrom = (flight: any, segs: any[]) => {
  const s0 = segs?.[0] || {};
  return (first(s0.marketingCarrierCode, s0.marketingCarrier, s0.carrierCode,
                s0.operatingCarrier, s0.airline, flight?.carrier) || "").toUpperCase();
};
const carrierNameFrom = (flight: any, segs: any[]) => {
  const code = carrierCodeFrom(flight, segs);
  return first(AIRLINE_NAMES[code], flight?.carrier_name, segs?.[0]?.airlineName, code || "Airline");
};
const ymd = (raw?: string) => {
  const s = clean(raw);
  if (!s) return "";
  const d = new Date(s);
  return Number.isFinite(+d) ? d.toISOString().slice(0, 10) : s.slice(0, 10);
};

const buildGoogleFlights = (o: string, d: string, out: string, ret?: string) => {
  const base = `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(o)}%20to%20${encodeURIComponent(d)}%20on%20${encodeURIComponent(out)}`;
  return ret ? `${base}%20return%20${encodeURIComponent(ret)}` : base;
};
const buildSkyscanner = (o: string, d: string, out: string, ret?: string) => {
  const outS = out.replace(/-/g, "");
  const retS = ret ? `/${ret.replace(/-/g, "")}` : "/";
  return `https://www.skyscanner.com/transport/flights/${encodeURIComponent(o.toLowerCase())}/${encodeURIComponent(d.toLowerCase())}/${outS}${retS}`;
};
/** Build internal TripTrio link (always /book) */
const buildTripTrio = (params: {
  origin?: string; destination?: string; depart?: string; ret?: string | null;
  pax?: number; cabin?: string; flightId?: string; currency?: string; total?: number | string; hotel?: string;
}) => {
  const qs = new URLSearchParams();
  if (params.origin) qs.set("origin", params.origin);
  if (params.destination) qs.set("destination", params.destination);
  if (params.depart) qs.set("depart", params.depart);
  if (params.ret) qs.set("return", params.ret);
  if (params.pax) qs.set("pax", String(params.pax));
  if (params.cabin) qs.set("cabin", params.cabin);
  if (params.flightId) qs.set("flightId", params.flightId);
  if (params.currency) qs.set("currency", params.currency);
  if (params.total != null) qs.set("total", String(params.total));
  if (params.hotel) qs.set("hotel", params.hotel);
  return `/book?${qs.toString()}`;
};

export default function ResultCard({
  pkg, index, onSaved, currency, comparedIds, onToggleCompare,
}: Props) {
  const f = pkg?.flight || {};
  const h = pkg?.hotel || null;
  const groups: Record<"3" | "4" | "5", any[]> | null = pkg?.hotelGroups || null;

  const outbound = firstArray(f, [
    "outbound","segments_out","out","legs.0.segments","itineraries.0.segments",
    "segments_outbound","segmentsOut","segments",
  ]);
  const inbound = firstArray(f, [
    "inbound","segments_in","ret","return","return_segments",
    "legs.1.segments","itineraries.1.segments","segmentsInbound",
  ]);
  const twoCols = outbound.length > 0 && inbound.length > 0;

  // Route inference for deeplinks
  const oIata = outbound.length ? iataFromNode(outbound[0], "departure") : "";
  const dIata = outbound.length ? iataFromNode(outbound[outbound.length - 1], "arrival") : "";
  const outDate = outbound.length ? ymd(first(outbound[0]?.depart_time, outbound[0]?.departureTime, outbound[0]?.departure?.at)) : "";
  const retDate = inbound.length ? ymd(first(inbound[0]?.depart_time, inbound[0]?.departureTime, inbound[0]?.departure?.at)) : "";

  // currency
  const uiCurrency = (currency || pkg?.currency || "USD").toUpperCase();
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: uiCurrency }); }
    catch { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }); }
  }, [uiCurrency]);

  const totalRaw =
    typeof pkg?.total_cost_converted === "number" ? pkg.total_cost_converted :
    typeof pkg?.total_cost === "number" ? pkg.total_cost :
    typeof f?.price_usd_converted === "number" ? f.price_usd_converted :
    typeof f?.price_usd === "number" ? f.price_usd : 0;
  const total = Number.isFinite(totalRaw) ? totalRaw : 0;

  const flightSubRaw =
    typeof f?.price_usd_converted === "number" ? f.price_usd_converted :
    typeof f?.price_usd === "number" ? f.price_usd : 0;
  const flightSub = Number.isFinite(flightSubRaw) ? f.price_usd ?? 0 : 0;

  // auth
  const supa = getSupa();
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (!supa) return;
    supa.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = supa.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, [supa]);

  // badges / meta
  const overallStops = typeof f?.stops === "number" ? f.stops : (outbound.length ? outbound.length - 1 : undefined);
  const stopsDisplay = stopsText(overallStops);
  const badges: string[] = [];
  if (stopsDisplay === "Nonstop") badges.push("Nonstop");
  if (f?.refundable) badges.push("Refundable");
  if (f?.greener)    badges.push("Greener");

  const carrierCode = carrierCodeFrom(f, outbound.length ? outbound : inbound);
  const carrierName = carrierNameFrom(f, outbound.length ? outbound : inbound);

  // compare
  const id: string = pkg?.id || `f-${index}`;
  const isCompared = comparedIds?.includes(id) ?? false;
  const handleToggleCompare = () => onToggleCompare?.(id);

  // save
  async function handleSave() {
    if (!supa) { alert("Please configure Supabase to enable saving."); return; }
    const { data } = await supa.auth.getUser();
    if (!data?.user) { alert("Please log in to save trips."); return; }
    try {
      setSaving(true);
      const { item } = await addFavorite(pkg);
      setSavedId(item.id);
      onSaved?.();
    } catch (e: any) {
      alert(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  async function handleUnsave() {
    if (!savedId) return;
    try {
      setSaving(true);
      await removeFavorite(savedId);
      setSavedId(null);
      onSaved?.();
    } catch (e: any) {
      alert(e?.message || "Could not remove.");
    } finally {
      setSaving(false);
    }
  }

  // durations
  const outDur = Number(f?.out_duration_minutes) || sumMinutes(outbound, "duration_minutes") || undefined;
  const retDur = Number(f?.return_duration_minutes) || sumMinutes(inbound, "duration_minutes") || undefined;

  // ---- Booking URLs (prefer server-provided; else synthesize) ----
  const gf = f?.bookingLinks?.googleFlights || (oIata && dIata && outDate ? buildGoogleFlights(oIata, dIata, outDate, retDate || undefined) : null);
  const sky = f?.bookingLinks?.skyscanner   || (oIata && dIata && outDate ? buildSkyscanner(oIata, dIata, outDate, retDate || undefined) : null);

  // INTERNAL TripTrio link (now includes pax & cabin)
  const our =
    f?.bookingLinks?.triptrio ||
    buildTripTrio({
      origin: pkg?.origin || oIata,
      destination: pkg?.destination || dIata,
      depart: pkg?.departDate || outDate,
      ret: pkg?.returnDate || retDate || null,
      pax: pkg?.passengers,
      cabin: f?.cabin,
      flightId: f?.id,
      currency: pkg?.currency,
      total,
      hotel: h?.name,
    });

  const airlineSiteKnown = AIRLINE_SITES[carrierCode];
  const airline =
    f?.bookingLinks?.airlineSite ||
    airlineSiteKnown ||
    (carrierName ? `https://www.google.com/search?q=${encodeURIComponent(carrierName + " booking")}` : null);

  // ---- Layover fallback calc when layover_minutes is missing ----
  const renderLeg = (list: any[], keyPrefix: string) =>
    list.map((s: any, i: number) => {
      const from = iataFromNode(s, "departure") || "—";
      const to   = iataFromNode(s, "arrival")   || "—";
      const dt   = timeFrom(s, "departure") || "—";
      const at   = timeFrom(s, "arrival")   || "—";

      let layTxt = "";
      if (i > 0) {
        const lay = Number(s?.layover_minutes);
        if (Number.isFinite(lay)) {
          layTxt = `Layover ${Math.floor(lay / 60)}h ${lay % 60}m`;
        } else {
          const prev = list[i - 1];
          const prevArrISO = isoFrom(prev, "arrival");
          const thisDepISO = isoFrom(s, "departure");
          const mins = minutesBetween(prevArrISO, thisDepISO);
          if (mins != null) layTxt = `Layover ${Math.floor(mins / 60)}h ${mins % 60}m`;
        }
      }

      return (
        <div key={`${keyPrefix}-${i}`} className="seg">
          {i > 0 && layTxt && <div className="layover">{layTxt}</div>}
          <div className="route">
            <span className="pill">{display(from)}</span>
            <span className="time">{display(dt)}</span>
            <span className="arrow">→</span>
            <span className="pill">{display(to)}</span>
            <span className="time">{display(at)}</span>
          </div>
          <div className="fn">
            {clean(s?.flight_number) ? `Flight ${s.flight_number}` : ""}
            {Number.isFinite(Number(s?.duration_minutes)) ? ` • ${Math.floor(Number(s.duration_minutes) / 60)}h ${Number(s.duration_minutes) % 60}m` : ""}
            {clean(s?.aircraft) ? ` • ${s.aircraft}` : ""}
          </div>
        </div>
      );
    });

  return (
    <article className={`card ${isCompared ? "compared" : ""}`} role="group" aria-label={`Option ${index + 1}`}>
      <header className="head">
        <div className="rank">#{index + 1}</div>

        <div className="air">
          <div className="name">{display(carrierName)}</div>
          <div className="meta">
            {display(stopsDisplay)} •{" "}
            {typeof f?.duration_minutes === "number"
              ? `${Math.floor(f.duration_minutes / 60)}h ${f.duration_minutes % 60}m`
              : outDur ? `${Math.floor(outDur / 60)}h ${outDur % 60}m (out)` : "—"}{" "}
            • {display(f?.cabin)}
          </div>
          {badges.length > 0 && (
            <div className="badges">
              {badges.map((b, i) => (
                <span className={`badge ${b.toLowerCase()}`} key={i}>{b}</span>
              ))}
            </div>
          )}
        </div>

        <div className="price">
          <div className="total">{fmt.format(Math.round(total))}</div>
          <div className="sub">Flight: {fmt.format(Math.round(flightSub))}</div>
        </div>
      </header>

      {/* Flight legs */}
      <section className={`legs ${twoCols ? "two" : "one"}`}>
        {/* Outbound */}
        {outbound.length > 0 && (
          <div className="leg">
            <div className="legtitle">Outbound</div>
            {renderLeg(outbound, "out")}
            {outDur && <div className="retmeta">Outbound duration: {Math.floor(outDur / 60)}h {outDur % 60}m</div>}
          </div>
        )}

        {/* Return */}
        {inbound.length > 0 && (
          <div className="leg">
            <div className="legtitle">Return</div>
            {renderLeg(inbound, "in")}
            {retDur && <div className="retmeta">Return duration: {Math.floor(retDur / 60)}h {retDur % 60}m</div>}
          </div>
        )}
      </section>

      {/* Optional Hotel block if real-time name/price present */}
      {h && h.isReal && (
        <section className="hotel">
          <div className="hleft">
            <div className="hname">{display(h?.name)}</div>
            <div className="hmeta">
              {h.star ? "★".repeat(Math.min(5, Math.max(1, Math.round(h.star)))) : ""}
              {clean(h?.city) ? ` • ${h.city}` : ""}
            </div>
          </div>
          <div className="hright">
            {typeof h.price_converted === "number"
              ? <div className="hprice">{fmt.format(h.price_converted)}</div>
              : typeof h.total_usd === "number" ? <div className="hprice">{fmt.format(h.total_usd)}</div> : null}
            {h.deeplinks?.booking && (
              <a className="btn small" href={h.deeplinks.booking} target="_blank" rel="noopener noreferrer">Booking.com</a>
            )}
            {h.deeplinks?.hotels && (
              <a className="btn small" href={h.deeplinks.hotels} target="_blank" rel="noopener noreferrer">Hotels.com</a>
            )}
          </div>
        </section>
      )}

      {/* Curated star-banded hotel choices (if server provided) */}
      {groups && (
        <section className="hotelGroups">
          <div className="hg-title">Hotel options</div>
          {(["5","4","3"] as const).map((band) =>
            groups[band]?.length ? (
              <div className="hg-band" key={band}>
                <div className="hg-band-title">{band}★</div>
                <div className="hg-list">
                  {groups[band].map((opt: any, i: number) => (
                    <div className="hg-card" key={`${band}-${i}`}>
                      <div className="hg-name">{display(opt?.name)}</div>
                      <div className="hg-meta">{opt?.city ? opt.city : ""}</div>
                      <div className="hg-actions">
                        {opt?.deeplinks?.booking && (
                          <a className="btn tiny" href={opt.deeplinks.booking} target="_blank" rel="noopener noreferrer">
                            Booking.com
                          </a>
                        )}
                        {opt?.deeplinks?.hotels && (
                          <a className="btn tiny" href={opt.deeplinks.hotels} target="_blank" rel="noopener noreferrer">
                            Hotels.com
                          </a>
                        )}
                        {opt?.deeplinks?.expedia && (
                          <a className="btn tiny" href={opt.deeplinks.expedia} target="_blank" rel="noopener noreferrer">
                            Expedia
                          </a>
                        )}
                        {opt?.deeplinks?.agoda && (
                          <a className="btn tiny" href={opt.deeplinks.agoda} target="_blank" rel="noopener noreferrer">
                            Agoda
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </section>
      )}

      <footer className="cta">
        {/* Airline + our site */}
        {airline && (
          <a className="btn" href={airline} target="_blank" rel="noopener noreferrer">Airline site</a>
        )}
        {gf && (
          <a className="btn" href={gf} target="_blank" rel="noopener noreferrer">Google Flights</a>
        )}
        {sky && (
          <a className="btn" href={sky} target="_blank" rel="noopener noreferrer">Skyscanner</a>
        )}
        {our && (
          <a className="btn" href={our} target="_self" rel="noopener">Book via TripTrio</a>
        )}

        {onToggleCompare && (
          <button className={`btn ${isCompared ? "danger" : "primary"}`} onClick={handleToggleCompare}>
            {isCompared ? "Remove from compare" : "Add to compare"}
          </button>
        )}

        {user ? (
          savedId ? (
            <button className="btn danger" onClick={handleUnsave} disabled={saving}>Remove</button>
          ) : (
            <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          )
        ) : (
          <button className="btn" onClick={() => alert("Please log in to save trips.")}>Save</button>
        )}
      </footer>

      <style jsx>{`
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; }
        .card.compared { box-shadow:0 0 0 2px #0ea5e9 inset; }

        .head { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px;
                padding:12px 14px; border-bottom:1px solid #e5e7eb; background:linear-gradient(90deg,#f8fafc,#f1f5f9); }
        .rank { font-weight:900; font-size:18px; color:#0f172a; }
        .air .name { font-weight:800; }
        .air .meta { color:#64748b; font-size:12px; font-weight:700; }
        .badges { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
        .badge { font-size:11px; font-weight:800; border-radius:999px; padding:2px 8px; border:1px solid #e2e8f0; background:#fff; }
        .badge.nonstop { background:#dcfce7; border-color:#bbf7d0; color:#166534; }
        .badge.refundable { background:#dbeafe; border-color:#bfdbfe; color:#1e40af; }
        .badge.greener { background:#e0e7ff; border-color:#c7d2fe; color:#3730a3; }

        .price { text-align:right; }
        .price .total { font-weight:900; font-size:16px; }
        .price .sub { font-size:12px; color:#475569; }

        .legs { padding:12px 14px; display:grid; gap:12px; }
        .legs.two { grid-template-columns:1fr 1fr; }
        .legs.one { grid-template-columns:1fr; }
        .leg { display:grid; gap:8px; }
        .legtitle { font-weight:900; color:#0f172a; }
        .seg { display:grid; grid-template-columns:1fr; gap:6px; align-items:start;
               border:1px dashed #e5e7eb; border-radius:12px; padding:8px 10px; background:#fafafa; }
        .layover { font-size:12px; color:#6b7280; font-weight:800; }
        .route { display:grid; grid-template-columns:auto auto auto auto auto; gap:8px; align-items:baseline; font-weight:800; }
        .pill { background:#f1f5f9; border:1px solid #e2e8f0; padding:2px 8px; border-radius:999px; font-weight:800; }
        .time { color:#334155; font-weight:800; }
        .arrow { color:#0ea5e9; font-weight:900; }
        .fn { color:#64748b; font-size:12px; }
        .retmeta { color:#475569; font-weight:700; }

        .hotel { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center;
                 padding:12px 14px; border-top:1px dashed #e5e7eb; background:#fffdf7; }
        .hname { font-weight:900; }
        .hmeta { color:#6b7280; font-weight:800; }
        .hprice { font-weight:900; margin-right:8px; }

        .hotelGroups { padding:12px 14px; border-top:1px dashed #e2e8f0; background:#fffcf5; display:grid; gap:12px; }
        .hg-title { font-weight:900; color:#0f172a; }
        .hg-band { display:grid; gap:8px; }
        .hg-band-title { font-weight:800; color:#0f172a; }
        .hg-list { display:grid; gap:8px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .hg-card { border:1px solid #e2e8f0; border-radius:12px; background:#fff; padding:10px; display:grid; gap:6px; }
        .hg-name { font-weight:800; }
        .hg-meta { font-size:12px; color:#64748b; }
        .hg-actions { display:flex; gap:6px; flex-wrap:wrap; }

        .cta { display:flex; gap:8px; padding:12px 14px; border-top:1px solid #e2e8f0;
               justify-content:flex-end; flex-wrap:wrap; background:#f8fafc; }
        .btn { height:36px; padding:0 12px; border-radius:10px; border:1px solid #e2e8f0;
               background:#fff; font-weight:800; cursor:pointer; text-decoration:none; }
        .btn.primary { background:linear-gradient(90deg,#06b6d4,#0ea5e9); color:#fff; border:none; }
        .btn.danger  { background:#fee2e2; border-color:#fecaca; color:#991b1b; }
        .btn.small   { height:30px; font-size:12px; }
        .btn.tiny    { height:28px; font-size:12px; }
      `}</style>
    </article>
  );
}
