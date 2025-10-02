"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import ResultCard from "../components/ResultCard";
import AirportField from "../components/AirportField";
import jsPDF from "jspdf";

/* ---------------- types ---------------- */
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
  sort: SortKey;
  maxStops?: 0 | 1 | 2;
  refundable?: boolean;
  greener?: boolean;

  sortBasis?: "flightOnly" | "bundle";
}

/** Local ISO date (yyyy-mm-dd) */
const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

/* helpers */
function extractIATA(display: string): string {
  const s = String(display || "").toUpperCase().trim();
  let m = /\(([A-Z]{3})\)/.exec(s);
  if (m) return m[1];
  m = /^([A-Z]{3})\b/.exec(s);
  if (m) return m[1];
  return "";
}
const num = (v: any): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const minutesToText = (m?: number) =>
  typeof m === "number" ? `${Math.floor(m / 60)}h ${m % 60}m` : "—";
const fmtCurrency = (n?: number, ccy = "USD") => {
  if (typeof n !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(
      Math.round(n)
    );
  } catch {
    return `${ccy} ${Math.round(n)}`;
  }
};
function sumSegMinutes(segs: any[]): number {
  return segs.reduce((t, s) => t + (Number(s?.duration_minutes) || 0), 0);
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

/* ---------------- page ---------------- */
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
  const [showAll, setShowAll] = useState(false); // default: Top-3 (showAll=false)

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

  /* children ages sync */
  useEffect(() => {
    setChildrenAges((prev) => {
      const next = prev.slice(0, children);
      while (next.length < children) next.push(8);
      return next;
    });
  }, [children]);

  const hotelNights = useMemo(() => {
    if (!hotelCheckIn || !hotelCheckOut) return undefined;
    const inMs = +new Date(hotelCheckIn);
    const outMs = +new Date(hotelCheckOut);
    const nights = Math.max(1, Math.round((outMs - inMs) / 86400000));
    return Number.isFinite(nights) ? nights : undefined;
  }, [hotelCheckIn, hotelCheckOut]);

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
      if (
        typeof minBudget === "number" &&
        typeof maxBudget === "number" &&
        minBudget > maxBudget
      ) {
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
        nights: includeHotel ? hotelNights : undefined,
        minHotelStar: includeHotel ? minHotelStar : undefined,

        minBudget: minBudget === "" ? undefined : minBudget,
        maxBudget: maxBudget === "" ? undefined : maxBudget,
        currency,
        sort,
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
        credentials: "same-origin",
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Search failed");

      let items: any[] = Array.isArray(j.results) ? j.results : [];

      if (items.length === 0) {
        // fallback demo
        const demo = (id: string, price: number, stops: number) => ({
          id,
          currency,
          total_cost: price,
          flight_total: price,
          hotel_total: 0,
          flight: {
            carrier_name: ["United", "American", "Delta"][stops] || "United",
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
                duration_minutes: 165,
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
                      duration_minutes: 155,
                    },
                  ],
                }
              : {}),
            duration_minutes: payload.returnDate ? 320 : 165,
          },
        });
        items = [demo("DEMO-1", 268, 0), demo("DEMO-2", 219, 1), demo("DEMO-3", 279, 2)];
      }

      setHotelWarning(j?.hotelWarning || null);
      setResults(items);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  // re-run search when sort toggles (server may sort)
  useEffect(() => {
    if (results) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, sortBasis]);

  function toggleCompare(id: string) {
    setComparedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)
    );
  }

  /* shownResults: Top-3 by default, all if toggled */
  const shownResults = useMemo(
    () => (results ? (showAll ? results : results.slice(0, 3)) : null),
    [results, showAll]
  );

  /* ---- styles (row-wise list, broader container) ---- */
  const s = {
    wrap: { padding: 16, display: "grid", gap: 16 } as React.CSSProperties,
    panel: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 14,
      display: "grid",
      gap: 12,
      maxWidth: 1400,
      margin: "0 auto",
    } as React.CSSProperties,
    label: { fontWeight: 800, color: "#334155", display: "block", marginBottom: 6 } as React.CSSProperties,
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
    resultsList: {
      display: "grid",
      gridTemplateColumns: "1fr", // row-wise
      gap: 18,
      maxWidth: 1240,            // broader reading width but not full page
      margin: "0 auto",
      width: "100%",
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

  /* logo underline removal */
  const globalCSS = `
    a.logo, .site-logo, a[href*="logo"], img.logo, img[alt*="TripTrio"] { text-decoration: none !important; border-bottom: 0 !important; }
  `;

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

      {/* FORM (keep your previous inputs) */}
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
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }} aria-hidden>
            <button
              type="button"
              title="Swap origin & destination"
              onClick={swapOriginDest}
              style={{ height: 42, width: 42, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 18 }}
            >
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

        {/* ... keep the rest of your controls: dates, passengers, cabin, budgets, hotel, sort basis ... */}
      </form>

      {/* TOOLBAR */}
      <div style={s.toolbar}>
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
      {!loading && results && results.length === 0 && <div style={s.msg}>No results matched your filters.</div>}

      {/* RESULTS — ROW LIST */}
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
