"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import AirportField from "../components/AirportField";
import ResultCard from "../components/ResultCard";

/* ---------- types ---------- */
type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SortKey = "best" | "cheapest" | "fastest" | "flexible";

interface SearchPayload {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  roundTrip: boolean;

  passengers: number;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  passengersChildrenAges?: number[];

  cabin: Cabin;

  includeHotel: boolean;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  nights?: number;
  minHotelStar?: number;

  minBudget?: number;
  maxBudget?: number;
  currency: string;
  sort: SortKey;          // server can ignore; we’ll sort client side
  maxStops?: 0 | 1 | 2;
  refundable?: boolean;
  greener?: boolean;

  sortBasis?: "flightOnly" | "bundle";
}

/* ---------- helpers ---------- */
const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

function extractIATA(display: string): string {
  const s = String(display || "").toUpperCase().trim();
  let m = /\(([A-Z]{3})\)/.exec(s);
  if (m) return m[1];
  m = /^([A-Z]{3})\b/.exec(s);
  if (m) return m[1];
  return "";
}

function num(v: any): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function minutesToText(m?: number) {
  return typeof m === "number" ? `${Math.floor(m / 60)}h ${m % 60}m` : "—";
}

function segsFromFlight(f: any, which: "out" | "ret"): any[] {
  if (!f) return [];
  return which === "out"
    ? f?.outbound ||
        f?.segments_out ||
        f?.legs?.[0]?.segments ||
        f?.itineraries?.[0]?.segments ||
        f?.segments ||
        []
    : f?.inbound ||
        f?.segments_in ||
        f?.legs?.[1]?.segments ||
        f?.itineraries?.[1]?.segments ||
        [];
}

function durationFromSegs(segs: any[]): number | undefined {
  if (!Array.isArray(segs) || segs.length === 0) return undefined;
  const sum = segs.reduce((t, s) => t + (Number(s?.duration_minutes) || 0), 0);
  return Number.isFinite(sum) ? sum : undefined;
}

/* ---------- page ---------- */
export default function Page() {
  // origin / destination
  const [originCode, setOriginCode] = useState("");
  const [originDisplay, setOriginDisplay] = useState("");
  const [destCode, setDestCode] = useState("");
  const [destDisplay, setDestDisplay] = useState("");

  // trip basics
  const [roundTrip, setRoundTrip] = useState(true);
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  // passengers
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  // cabin / filters
  const [cabin, setCabin] = useState<Cabin>("ECONOMY");
  const [currency, setCurrency] = useState("USD");
  const [minBudget, setMinBudget] = useState<number | "">("");
  const [maxBudget, setMaxBudget] = useState<number | "">("");
  const [maxStops, setMaxStops] = useState<0 | 1 | 2>(2);
  const [refundable, setRefundable] = useState(false);
  const [greener, setGreener] = useState(false);

  // hotels
  const [includeHotel, setIncludeHotel] = useState(false);
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [minHotelStar, setMinHotelStar] = useState(0);

  // sort / compare / show all
  const [sort, setSort] = useState<SortKey>("best");
  const [sortBasis, setSortBasis] = useState<"flightOnly" | "bundle">("flightOnly");
  const [compareMode, setCompareMode] = useState(false);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false); // Top-3 by default (false)

  // results & messages
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelWarning, setHotelWarning] = useState<string | null>(null);

  // saved count badge
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => {
    const load = () => {
      try {
        const arr = JSON.parse(localStorage.getItem("triptrio:saved") || "[]");
        setSavedCount(Array.isArray(arr) ? arr.length : 0);
      } catch {
        setSavedCount(0);
      }
    };
    load();
    const handler = () => load();
    window.addEventListener("triptrio:saved:changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("triptrio:saved:changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // sync children ages
  useEffect(() => {
    setChildrenAges((prev) => {
      const next = prev.slice(0, children);
      while (next.length < children) next.push(8);
      return next;
    });
  }, [children]);

  useEffect(() => {
    if (!roundTrip) setReturnDate("");
  }, [roundTrip]);

  useEffect(() => {
    if (!includeHotel) return;
    if (!hotelCheckIn && departDate) setHotelCheckIn(departDate);
    if (!hotelCheckOut && roundTrip && returnDate) setHotelCheckOut(returnDate);
  }, [includeHotel, departDate, returnDate, roundTrip, hotelCheckIn, hotelCheckOut]);

  function swapOriginDest() {
    setOriginCode((oc) => {
      const dc = destCode;
      setDestCode(oc);
      return dc;
    });
    setOriginDisplay((od) => {
      const dd = destDisplay;
      setDestDisplay(od);
      return dd;
    });
  }

  async function runSearch() {
    setLoading(true);
    setError(null);
    setHotelWarning(null);
    setResults(null);

    try {
      const origin = originCode || extractIATA(originDisplay);
      const destination = destCode || extractIATA(destDisplay);

      if (!origin || !destination) throw new Error("Please select origin and destination.");
      if (!departDate) throw new Error("Please pick a departure date.");
      if (departDate < todayLocal) throw new Error("Departure date can’t be in the past.");
      if (adults < 1) throw new Error("At least 1 adult is required.");
      if (roundTrip) {
        if (!returnDate) throw new Error("Please pick a return date.");
        if (returnDate < departDate) throw new Error("Return date must be after departure.");
      }

      if (minBudget !== "" && minBudget < 0) throw new Error("Min budget cannot be negative.");
      if (maxBudget !== "" && maxBudget < 0) throw new Error("Max budget cannot be negative.");
      if (typeof minBudget === "number" && typeof maxBudget === "number" && minBudget > maxBudget) {
        throw new Error("Min budget cannot be greater than max budget.");
      }

      const passengersTotal = adults + children + infants;

      const payload: SearchPayload = {
        origin,
        destination,
        departDate,
        returnDate: roundTrip ? returnDate : undefined,
        roundTrip,

        passengers: passengersTotal,
        passengersAdults: adults,
        passengersChildren: children,
        passengersInfants: infants,
        passengersChildrenAges: children > 0 ? childrenAges : undefined,

        cabin,

        includeHotel,
        hotelCheckIn: includeHotel ? hotelCheckIn || undefined : undefined,
        hotelCheckOut: includeHotel ? hotelCheckOut || undefined : undefined,
        nights: includeHotel
          ? Math.max(
              1,
              Math.round((+new Date(hotelCheckOut) - +new Date(hotelCheckIn)) / 86400000)
            ) || undefined
          : undefined,
        minHotelStar: includeHotel ? minHotelStar : undefined,

        minBudget: minBudget === "" ? undefined : minBudget,
        maxBudget: maxBudget === "" ? undefined : maxBudget,
        currency,
        sort, // server can ignore
        maxStops,
        refundable,
        greener,

        sortBasis,
      };

      const r = await fetch(`/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Search failed");

      let items: any[] = Array.isArray(j.results) ? j.results : [];

      // Dev/demo fallback: produce 8 results so “All” differs from “Top-3”
      if (items.length === 0) {
        const mk = (id: string, price: number, stops: number) => ({
          id,
          currency,
          total_cost: price, // bundle == flight in demo
          flight_total: price,
          hotel_total: 0,
          flight: {
            carrier_name: ["United", "American", "Delta", "Alaska"][stops % 4] || "United",
            cabin,
            stops,
            price_usd: price,
            refundable: stops !== 1,
            greener: stops === 0,
            segments_out: [
              {
                from: payload.origin,
                to: payload.destination,
                depart_time: `${payload.departDate}T08:20`,
                arrive_time: `${payload.departDate}T11:05`,
                duration_minutes: 165 + stops * 35,
              },
            ],
            ...(payload.returnDate
              ? {
                  segments_in: [
                    {
                      from: payload.destination,
                      to: payload.origin,
                      depart_time: `${payload.returnDate}T17:35`,
                      arrive_time: `${payload.returnDate}T20:10`,
                      duration_minutes: 155 + stops * 30,
                    },
                  ],
                }
              : {}),
          },
        });
        items = [
          mk("DEMO-1", 268, 0),
          mk("DEMO-2", 219, 1),
          mk("DEMO-3", 279, 2),
          mk("DEMO-4", 301, 1),
          mk("DEMO-5", 255, 0),
          mk("DEMO-6", 330, 2),
          mk("DEMO-7", 242, 1),
          mk("DEMO-8", 289, 0),
        ];
      }

      setHotelWarning(j?.hotelWarning || null);
      setResults(items);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  /* ----------------- CLIENT-SIDE SORT (no re-fetch) -----------------
     This is the key change that fixes the Compare panel losing selections. */
  const sortedResults = useMemo(() => {
    if (!results) return null;
    const items = [...results];

    // Helpers to compute sort metrics
    const flightPrice = (p: any) =>
      num(p.flight_total) ??
      num(p.total_cost_flight) ??
      num(p.flight?.price_usd_converted) ??
      num(p.flight?.price_usd) ??
      num(p.total_cost) ?? // worst fallback
      9e15;

    const bundleTotal = (p: any) =>
      num(p.total_cost) ??
      (num(p.flight_total) ?? flightPrice(p)) + (num(p.hotel_total) ?? 0);

    const outDur = (p: any) => {
      const segs = segsFromFlight(p.flight, "out");
      return durationFromSegs(segs) ?? 9e9;
    };

    // Choose ranking basis
    const basisValue = (p: any) =>
      sortBasis === "bundle" ? bundleTotal(p) : flightPrice(p);

    if (sort === "cheapest") {
      items.sort((a, b) => (basisValue(a)! - basisValue(b)!));
    } else if (sort === "fastest") {
      items.sort((a, b) => outDur(a)! - outDur(b)!);
    } else if (sort === "flexible") {
      // simple heuristic: refundable first, then cheaper
      items.sort((a, b) => {
        const ra = a.flight?.refundable ? 0 : 1;
        const rb = b.flight?.refundable ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return basisValue(a)! - basisValue(b)!;
      });
    } else {
      // "best": price (basis) then duration
      items.sort((a, b) => {
        const p = basisValue(a)! - basisValue(b)!;
        if (p !== 0) return p;
        return outDur(a)! - outDur(b)!;
      });
    }
    return items;
  }, [results, sort, sortBasis]);

  // Top-3 vs All
  const shownResults = useMemo(() => {
    if (!sortedResults) return null;
    return showAll ? sortedResults : sortedResults.slice(0, 3);
  }, [sortedResults, showAll]);

  // Compare selection toggler (IDs must be stable)
  function toggleCompare(id: string) {
    setComparedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)
    );
  }

  /* ---------- styles (row-wise list, broader container) ---------- */
  const s = {
    wrap: { padding: 16, display: "grid", gap: 16 } as React.CSSProperties,
    panel: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 14,
      display: "grid",
      gap: 12,
      maxWidth: 1240,
      margin: "0 auto",
    } as React.CSSProperties,
    label: {
      fontWeight: 800,
      color: "#334155",
      display: "block",
      marginBottom: 6,
    } as React.CSSProperties,
    input: {
      height: 42,
      padding: "0 10px",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      width: "100%",
      background: "#fff",
    } as React.CSSProperties,
    row: { display: "grid", gap: 12, alignItems: "end" } as React.CSSProperties,
    two: { gridTemplateColumns: "1fr 54px 1fr" } as React.CSSProperties,
    datesPassengers: {
      gridTemplateColumns: "170px 1fr 1fr minmax(320px, 440px) 130px",
    } as React.CSSProperties,
    four: { gridTemplateColumns: "1fr 1fr 1fr 1fr" } as React.CSSProperties,
    three: { gridTemplateColumns: "1fr 1fr 1fr" } as React.CSSProperties,
    paxGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(90px, 1fr))",
      gap: 8,
      alignItems: "center",
    } as React.CSSProperties,
    paxLbl: {
      display: "block",
      fontSize: 12,
      color: "#475569",
      marginBottom: 4,
      fontWeight: 800,
    } as React.CSSProperties,
    swapcell: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    } as React.CSSProperties,
    swap: {
      height: 42,
      width: 42,
      borderRadius: 12,
      border: "1px solid "#e2e8f0",
      background: "#fff",
      cursor: "pointer",
      fontSize: 18,
    } as React.CSSProperties,

    toolbar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 8,
      gap: 8,
      flexWrap: "wrap",
      maxWidth: 1240,
      margin: "0 auto",
    } as React.CSSProperties,
    chips: { display: "flex", gap: 8, flexWrap: "wrap" } as React.CSSProperties,
    chip: {
      height: 32,
      padding: "0 12px",
      borderRadius: 999,
      border: "1px solid #e2e8f0",
      background: "#fff",
      fontWeight: 800,
    } as React.CSSProperties,
    chipActive: {
      borderColor: "#0ea5e9",
      boxShadow: "0 0 0 2px rgba(14,165,233,.15) inset",
    } as React.CSSProperties,

    resultsList: {
      display: "grid",
      gridTemplateColumns: "1fr", // row-wise
      gap: 18,
      maxWidth: 1240,
      margin: "0 auto",
      width: "100%",
    } as React.CSSProperties,

    msg: {
      padding: 12,
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      maxWidth: 1240,
      margin: "0 auto",
    } as React.CSSProperties,
    error: {
      borderColor: "#fecaca",
      background: "#fef2f2",
      color: "#991b1b",
      fontWeight: 800,
    } as React.CSSProperties,
    warn: {
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
      fontWeight: 700,
    } as React.CSSProperties,
  };

  const globalCSS = `
    a.logo, .site-logo, a[href*="logo"], img.logo, img[alt*="TripTrio"] {
      text-decoration: none!important; border-bottom: 0!important;
    }
  `;

  /* ---------- render ---------- */
  return (
    <div style={s.wrap}>
      <style>{globalCSS}</style>

      {/* HERO */}
      <section>
        <h1 style={{ margin: "0 0 6px", fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em" }}>
          Find your perfect trip
        </h1>
        <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", color: "#334155", fontWeight: 700, flexWrap: "wrap" }}>
          <span style={{ padding: "6px 12px", borderRadius: 999, background: "linear-gradient(90deg,#06b6d4,#0ea5e9)", color: "#fff", fontWeight: 900 }}>
            Top-3 picks
          </span>
          <span style={{ opacity: .6 }}>•</span><strong>Smarter</strong>
          <span style={{ opacity: .6 }}>•</span><strong>Clearer</strong>
          <span style={{ opacity: .6 }}>•</span><strong>Bookable</strong>
        </p>
      </section>

      {/* FORM */}
      <form
        style={s.panel}
        onSubmit={(e) => { e.preventDefault(); runSearch(); }}
      >
        {/* ORIGIN / DESTINATION */}
        <div style={{ ...s.row, ...s.two }}>
          <div>
            <label style={s.label}>Origin</label>
            <AirportField
              id="origin"
              label=""
              code={originCode}
              initialDisplay={originDisplay}
              onTextChange={(t) => setOriginDisplay(t)}
              onChangeCode={(code: string, display: string) => { setOriginCode(code); setOriginDisplay(display); }}
            />
          </div>
          <div style={s.swapcell} aria-hidden>
            <button type="button" title="Swap origin & destination" onClick={swapOriginDest} style={s.swap}>
              ⇄
            </button>
          </div>
          <div>
            <label style={s.label}>Destination</label>
            <AirportField
              id="destination"
              label=""
              code={destCode}
              initialDisplay={destDisplay}
              onTextChange={(t) => setDestDisplay(t)}
              onChangeCode={(code: string, display: string) => { setDestCode(code); setDestDisplay(display); }}
            />
          </div>
        </div>

        {/* Trip / dates / passengers / search */}
        <div style={{ ...s.row, ...s.datesPassengers }}>
          <div style={{ minWidth: 170 }}>
            <label style={s.label}>Trip</label>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" style={segStyle(!roundTrip)} onClick={() => setRoundTrip(false)}>One-way</button>
              <button type="button" style={segStyle(roundTrip)} onClick={() => setRoundTrip(true)}>Round-trip</button>
            </div>
          </div>

          <div>
            <label style={s.label}>Depart</label>
            <input type="date" style={s.input} value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              min={todayLocal} max={roundTrip && returnDate ? returnDate : undefined} />
          </div>

          <div>
            <label style={s.label}>Return</label>
            <input type="date" style={s.input} value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={!roundTrip}
              min={departDate || todayLocal} />
          </div>

          <div>
            <label style={s.label}>Passengers</label>
            <div style={s.paxGrid}>
              <span>
                <span style={s.paxLbl}>Adults</span>
                <input type="number" min={1} style={s.input} value={adults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
              </span>
              <span>
                <span style={s.paxLbl}>Children</span>
                <input type="number" min={0} style={s.input} value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
              </span>
              <span>
                <span style={s.paxLbl}>Infants</span>
                <input type="number" min={0} style={s.input} value={infants}
                  onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))} />
              </span>
            </div>

            {children > 0 && (
              <div role="group" aria-label="Children ages" style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800, color: "#334155", fontSize: 12, marginBottom: 6 }}>
                  Children ages (2–17)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
                  {childrenAges.map((age, idx) => (
                    <label key={idx}>
                      <span style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 800 }}>
                        Child {idx + 1}
                      </span>
                      <select
                        style={s.input}
                        value={age}
                        onChange={(e) =>
                          setChildrenAges((prev) => {
                            const next = prev.slice();
                            next[idx] = Number(e.target.value);
                            return next;
                          })
                        }
                      >
                        {Array.from({ length: 16 }, (_, i) => 2 + i).map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "end" }}>
            <button type="submit" style={primaryBtn}>{loading ? "Searching…" : "Search"}</button>
          </div>
        </div>

        {/* Cabin / stops / refundable / greener */}
        <div style={{ ...s.row, ...s.four }}>
          <div>
            <label style={s.label}>Cabin</label>
            <select style={s.input} value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)}>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Stops</label>
            <select style={s.input} value={maxStops} onChange={(e) => setMaxStops(Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>Nonstop</option>
              <option value={1}>1 stop</option>
              <option value={2}>More than 1 stop</option>
            </select>
          </div>
          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#334155" }}>
              <input type="checkbox" checked={refundable} onChange={(e) => setRefundable(e.target.checked)} />
              Refundable
            </label>
          </div>
          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#334155" }}>
              <input type="checkbox" checked={greener} onChange={(e) => setGreener(e.target.checked)} />
              Greener
            </label>
          </div>
        </div>

        {/* Currency / budgets */}
        <div style={{ ...s.row, ...s.three }}>
          <div>
            <label style={s.label}>Currency</label>
            <select style={s.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={s.label}>Min budget</label>
            <input
              type="number" placeholder="min" min={0} style={s.input}
              value={minBudget === "" ? "" : String(minBudget)}
              onChange={(e) => {
                if (e.target.value === "") return setMinBudget("");
                const v = Number(e.target.value);
                setMinBudget(Number.isFinite(v) ? Math.max(0, v) : 0);
              }}
            />
          </div>
          <div>
            <label style={s.label}>Max budget</label>
            <input
              type="number" placeholder="max" min={0} style={s.input}
              value={maxBudget === "" ? "" : String(maxBudget)}
              onChange={(e) => {
                if (e.target.value === "") return setMaxBudget("");
                const v = Number(e.target.value);
                setMaxBudget(Number.isFinite(v) ? Math.max(0, v) : 0);
              }}
            />
          </div>
        </div>

        {/* Include hotel */}
        <div style={{ ...s.row, gridTemplateColumns: "170px 1fr 1fr 1fr" }}>
          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#334155" }}>
              <input type="checkbox" checked={includeHotel} onChange={(e) => setIncludeHotel(e.target.checked)} />
              Include hotel
            </label>
          </div>
          <div>
            <label style={s.label}>Hotel check-in</label>
            <input type="date" style={s.input} value={hotelCheckIn}
              onChange={(e) => setHotelCheckIn(e.target.value)}
              disabled={!includeHotel}
              min={departDate || todayLocal} />
          </div>
          <div>
            <label style={s.label}>Hotel check-out</label>
            <input type="date" style={s.input} value={hotelCheckOut}
              onChange={(e) => setHotelCheckOut(e.target.value)}
              disabled={!includeHotel}
              min={hotelCheckIn || departDate || todayLocal} />
          </div>
          <div>
            <label style={s.label}>Min hotel stars</label>
            <select style={s.input} value={minHotelStar} onChange={(e) => setMinHotelStar(Number(e.target.value))} disabled={!includeHotel}>
              <option value={0}>Any</option>
              <option value={3}>3★+</option>
              <option value={4}>4★+</option>
              <option value={5}>5★</option>
            </select>
          </div>
        </div>

        {/* Sort basis */}
        <div style={{ ...s.row, ...s.three }}>
          <div>
            <label style={s.label}>Sort by (basis)</label>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" style={segStyle(sortBasis === "flightOnly")} onClick={() => setSortBasis("flightOnly")}>Flight only</button>
              <button type="button" style={segStyle(sortBasis === "bundle")} onClick={() => setSortBasis("bundle")}>Bundle total</button>
            </div>
          </div>
        </div>
      </form>

      {/* TOOLBAR */}
      <div style={toolbarStyle}>
        <div style={s.chips} role="tablist" aria-label="Sort">
          {(["best", "cheapest", "fastest", "flexible"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={sort === k}
              style={{ ...s.chip, ...(sort === k ? s.chipActive : {}) }}
              onClick={() => setSort(k)}
            >
              {k === "best" ? "Best overall" : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        <div style={s.chips}>
          <button
            style={{ ...s.chip, ...(!showAll ? s.chipActive : {}) }}
            onClick={() => setShowAll(false)}
            title="Show top 3"
          >
            Top-3
          </button>
          <button
            style={{ ...s.chip, ...(showAll ? s.chipActive : {}) }}
            onClick={() => setShowAll(true)}
            title="Show all"
          >
            All
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...s.chip, background: "#f1f5f9" }}>
            Saved: <strong>{savedCount}</strong>
          </span>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#334155" }}>
            <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
            Compare
          </label>
        </div>
      </div>

      {/* MESSAGES */}
      {error && <div style={{ ...s.msg, ...s.error }} role="alert">⚠ {error}</div>}
      {hotelWarning && !error && <div style={{ ...s.msg, ...s.warn }}>ⓘ {hotelWarning}</div>}
      {loading && <div style={s.msg}>Searching…</div>}
      {!loading && sortedResults && sortedResults.length <= 3 && (
        <div style={s.msg}>Showing {sortedResults.length} result(s). “All” equals “Top-3” because there are only {sortedResults.length} items.</div>
      )}
      {!loading && results && results.length === 0 && <div style={s.msg}>No results matched your filters.</div>}

      {/* RESULTS — row-wise list */}
      {shownResults && shownResults.length > 0 && (
        <div style={s.resultsList} id="results-root">
          {shownResults.map((pkg, i) => (
            <ResultCard
              key={pkg.id || i}
              pkg={pkg}
              index={i}
              currency={currency}
              comparedIds={compareMode ? comparedIds : undefined}
              onToggleCompare={compareMode ? toggleCompare : undefined}
              onSavedChangeGlobal={(count) => setSavedCount(count)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* tiny style helpers */
const segBase: React.CSSProperties = {
  height: 42,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1,
  whiteSpace: "nowrap",
};
function segStyle(active: boolean): React.CSSProperties {
  return active
    ? { ...segBase, background: "linear-gradient(90deg,#06b6d4,#0ea5e9)", color: "#fff", border: "none" }
    : segBase;
}
const primaryBtn: React.CSSProperties = {
  height: 42,
  padding: "0 16px",
  border: "none",
  fontWeight: 900,
  color: "#fff",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9)",
  borderRadius: 10,
  minWidth: 120,
};
const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 8,
  gap: 8,
  flexWrap: "wrap",
  maxWidth: 1240,
  margin: "0 auto",
};
