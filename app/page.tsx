"use client";
export const dynamic = 'force-dynamic';


import React, { useEffect, useMemo, useState } from "react";
import ResultCard from "../components/ResultCard";
import AirportField from "../components/AirportField";
import jsPDF from "jspdf";

/* ---------------- types ---------------- */
type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SortKey = "best" | "cheapest" | "fastest" | "flexible";

type SearchPayload = {
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

  minBudget?: number | "";
  maxBudget?: number | "";
  currency: string;
  sort: SortKey;
  maxStops?: 0 | 1 | 2;
  refundable?: boolean;
  greener?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

function extractIATA(display: string): string {
  const m = /\(([A-Z]{3})\)/.exec(display || "");
  return m ? m[1] : "";
}

/* small helpers used in compare + pdf */
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
  const [childrenAges, setChildrenAges] = useState<number[]>([]); // 2–17

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
  const [compareMode, setCompareMode] = useState(false);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  // results
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelWarning, setHotelWarning] = useState<string | null>(null);

  const passengersTotal = adults + children + infants;

  // keep childrenAges length in sync with children count
  useEffect(() => {
    setChildrenAges((prev) => {
      const next = prev.slice(0, children);
      while (next.length < children) next.push(8); // default
      return next;
    });
  }, [children]);

  // hotel nights
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
      if (roundTrip) {
        if (!returnDate) throw new Error("Please pick a return date.");
        if (returnDate < departDate) throw new Error("Return date must be after departure.");
      }
      if (adults < 1) throw new Error("At least 1 adult is required.");

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
      };

      const r = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Search failed");

      let items: any[] = Array.isArray(j.results) ? j.results : [];
      if (includeHotel && minHotelStar > 0) {
        items = items.filter((p) => !p.hotel || Number(p.hotel.star || 0) >= minHotelStar);
      }
      setHotelWarning(j?.hotelWarning || null);
      setResults(items);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (results) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  function toggleCompare(id: string) {
    setComparedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)
    );
  }

  /* ---------- PDF export (with logo + hotel info + children ages) ---------- */
  async function loadFirstLogo(): Promise<string | null> {
    const candidates = [
      "/triptrio-logo.png",
      "/logo.png",
      "/logo/triptrio.png",
      "/logo/triptrio-logo.png",
      "/triptrio.svg",
    ];
    for (const u of candidates) {
      try {
        const res = await fetch(u);
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        return dataUrl;
      } catch {}
    }
    return null;
  }

  async function exportPDF() {
    try {
      const doc = new jsPDF({ unit: "pt" });
      let y = 24;

      const logo = await loadFirstLogo();
      if (logo) {
        try {
          doc.addImage(logo, "PNG", 24, y - 8, 28, 28);
          doc.setFontSize(16);
          doc.text("TripTrio", 60, y + 12);
          y += 28;
        } catch {
          doc.setFontSize(18);
          doc.text("TripTrio", 24, y);
          y += 6;
        }
      } else {
        doc.setFontSize(18);
        doc.text("TripTrio", 24, y);
        y += 6;
      }

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Results", 24, (y += 18));
      doc.setFont(undefined, "normal");

      const routeBits = [
        originCode || extractIATA(originDisplay) || "—",
        destCode || extractIATA(destDisplay) || "—",
      ];
      const agesStr = childrenAges.length ? ` ages: [${childrenAges.join(", ")}]` : "";
      const hdr =
        `Route: ${routeBits.join(" → ")}   ` +
        `Depart: ${departDate || "—"}   ` +
        (roundTrip ? `Return: ${returnDate || "—"}   ` : "") +
        `Pax: ${adults + children + infants} (${adults}A/${children}C${agesStr}/${infants}I)   ` +
        `Cabin: ${cabin}`;

      doc
        .splitTextToSize(hdr, 560)
        .forEach((line) => ((y += 18), doc.text(line, 24, y)));

      if (!results || results.length === 0) {
        doc.text("No results.", 24, (y += 24));
        doc.save("triptrio-results.pdf");
        return;
      }

      const max = showAll ? results.length : Math.min(3, results.length);
      for (let i = 0; i < max; i++) {
        const p = results[i];
        const f = p.flight || {};

        y += 18;
        doc.setFont(undefined, "bold");
        doc.text(
          `#${i + 1} — ${(f.carrier_name || f.carrier || "Airline")} • ${(f.cabin || "—")} • ${
            f.stops === 0 ? "Nonstop" : `${f.stops} stop(s)`
          }`,
          24,
          y
        );
        doc.setFont(undefined, "normal");

        y += 16;
        const price =
          typeof p.total_cost === "number"
            ? p.total_cost
            : typeof f.price_usd === "number"
            ? f.price_usd
            : 0;
        doc.text(`${p.currency || "USD"} ${Math.round(price)}`, 24, y);

        const outSegs = segsFromFlight(f, "out");
        if (Array.isArray(outSegs) && outSegs.length > 0) {
          y += 18;
          doc.setFont(undefined, "bold");
          doc.text("Outbound:", 24, y);
          doc.setFont(undefined, "normal");
          outSegs.forEach((s: any, idx: number) => {
            const from = s?.from || s?.departure?.iataCode || "—";
            const to = s?.to || s?.arrival?.iataCode || "—";
            const dt = s?.depart_time || s?.departure?.at || "—";
            const at = s?.arrive_time || s?.arrival?.at || "—";
            const line = `${idx + 1}. ${from} → ${to}   ${String(dt).slice(11, 16)} → ${String(
              at
            ).slice(11, 16)}`;
            y += 14;
            doc.text(line, 36, y);
          });
        }

        const inSegs = segsFromFlight(f, "ret");
        if (Array.isArray(inSegs) && inSegs.length > 0) {
          y += 16;
          doc.setFont(undefined, "bold");
          doc.text("Return:", 24, y);
          doc.setFont(undefined, "normal");
          inSegs.forEach((s: any, idx: number) => {
            const from = s?.from || s?.departure?.iataCode || "—";
            const to = s?.to || s?.arrival?.iataCode || "—";
            const dt = s?.depart_time || s?.departure?.at || "—";
            const at = s?.arrive_time || s?.arrival?.at || "—";
            const line = `${idx + 1}. ${from} → ${to}   ${String(dt).slice(11, 16)} → ${String(
              at
            ).slice(11, 16)}`;
            y += 14;
            doc.text(line, 36, y);
          });
        }

        const h = p.hotel || null;
        if (h) {
          y += 18;
          doc.setFont(undefined, "bold");
          doc.text("Hotel:", 24, y);
          doc.setFont(undefined, "normal");
          y += 14;
          const hLine = `${h.name || "Hotel"}${
            h.star ? ` (${Math.round(h.star)}★)` : ""
          }${h.city ? ` — ${h.city}` : ""}`;
          doc.text(hLine, 36, y);
          if (typeof h.price_converted === "number" || typeof h.total_usd === "number") {
            const hp = typeof h.price_converted === "number" ? h.price_converted : h.total_usd;
            const hc = h.currency || p.currency || "USD";
            y += 14;
            doc.text(`Price: ${hc} ${Math.round(hp)}`, 36, y);
          }
          if (h.deeplinks?.booking || h.deeplinks?.hotels || h.deeplinks?.expedia) {
            y += 14;
            const links = [
              h.deeplinks?.booking ? "Booking.com" : "",
              h.deeplinks?.hotels ? "Hotels.com" : "",
              h.deeplinks?.expedia ? "Expedia" : "",
            ]
              .filter(Boolean)
              .join("  •  ");
            doc.text(`Links: ${links}`, 36, y);
          }
        }

        if (y > 740) {
          doc.addPage();
          y = 24;
        }
      }

      doc.save("triptrio-results.pdf");
    } catch {
      alert("Could not export PDF. Ensure 'jspdf' is installed.");
    }
  }

  function printPage() {
    window.print();
  }

  async function shareResults() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      const text = "My TripTrio search results";
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "TripTrio", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard.");
      }
    } catch {
      alert("Share failed.");
    }
  }

  const shownResults = useMemo(() => {
    if (!results) return null;
    return showAll ? results : results.slice(0, 3);
  }, [results, showAll]);

  /* ---------------- compare data & winners ---------------- */
  const compareCalc = useMemo(() => {
    if (!shownResults) return null;
    const idToPkg = new Map<string, any>(
      shownResults.map((p, i) => [p.id || `f-${i}`, p])
    );
    const selected = comparedIds
      .map((id) => idToPkg.get(id))
      .filter(Boolean) as any[];

    const rows: {
      key: string;
      label: string;
      values: (string | number | undefined)[];
      better: "min" | "max" | null; // how to pick winners
      fmt?: (v: any) => string;
    }[] = [];

    if (selected.length > 0) {
      // Always include the hotel metrics (even if some options lack a hotel)
      rows.push({
        key: "hotel",
        label: "Hotel",
        values: selected.map((p) => p.hotel?.name || "—"),
        better: null,
      });
      rows.push({
        key: "hotelStar",
        label: "Hotel stars",
        values: selected.map((p) => num(p.hotel?.star)),
        better: "max",
        fmt: (v) => (typeof v === "number" ? `${v}★` : "—"),
      });
      rows.push({
        key: "hotelPrice",
        label: "Hotel price",
        values: selected.map((p) => {
          const h = p.hotel || {};
          return num(h.price_converted) ?? num(h.total_usd) ?? undefined;
        }),
        better: "min",
        fmt: (v) => fmtCurrency(num(v), "USD"),
      });

      // Flight/total metrics
      const totals = selected.map((p) => {
        const f = p.flight || {};
        return (
          num(p.total_cost_converted) ??
          num(p.total_cost) ??
          num(f.price_usd_converted) ??
          num(f.price_usd)
        );
      });
      rows.push({
        key: "total",
        label: "Total price",
        values: totals,
        better: "min",
        fmt: (v) => fmtCurrency(num(v), "USD"),
      });

      const fprices = selected.map((p) => {
        const f = p.flight || {};
        return num(f.price_usd_converted) ?? num(f.price_usd) ?? undefined;
      });
      rows.push({
        key: "flightPrice",
        label: "Flight price",
        values: fprices,
        better: "min",
        fmt: (v) => fmtCurrency(num(v), "USD"),
      });

      const stops = selected.map((p) => {
        const f = p.flight || {};
        if (typeof f.stops === "number") return f.stops;
        const out = segsFromFlight(f, "out");
        return out.length ? out.length - 1 : undefined;
      });
      rows.push({ key: "stops", label: "Stops", values: stops, better: "min" });

      const outDur = selected.map((p) => {
        const f = p.flight || {};
        return (
          num(f.out_duration_minutes) ??
          (() => {
            const segs = segsFromFlight(f, "out");
            return segs.length ? sumSegMinutes(segs) : undefined;
          })()
        );
      });
      rows.push({
        key: "outDur",
        label: "Outbound duration",
        values: outDur,
        better: "min",
        fmt: (v) => minutesToText(num(v)),
      });

      const retDur = selected.map((p) => {
        const f = p.flight || {};
        return (
          num(f.return_duration_minutes) ??
          (() => {
            const segs = segsFromFlight(f, "ret");
            return segs.length ? sumSegMinutes(segs) : undefined;
          })()
        );
      });
      rows.push({
        key: "retDur",
        label: "Return duration",
        values: retDur,
        better: "min",
        fmt: (v) => minutesToText(num(v)),
      });

      const overallDur = selected.map((p, i) => {
        const f = p.flight || {};
        return (
          num(f.duration_minutes) ??
          (num(outDur[i]) && num(retDur[i]) ? (num(outDur[i]) as number) + (num(retDur[i]) as number) : undefined)
        );
      });
      rows.push({
        key: "overallDur",
        label: "Total duration",
        values: overallDur,
        better: "min",
        fmt: (v) => minutesToText(num(v)),
      });

      rows.push({
        key: "cabin",
        label: "Cabin",
        values: selected.map((p) => p.flight?.cabin || "—"),
        better: null,
      });

      rows.push({
        key: "airline",
        label: "Airline",
        values: selected.map((p) => p.flight?.carrier_name || p.flight?.carrier || "—"),
        better: null,
      });

      rows.push({
        key: "refundable",
        label: "Refundable",
        values: selected.map((p) => (p.flight?.refundable ? 1 : 0)),
        better: "max",
        fmt: (v) => (v ? "Yes" : "No"),
      });

      rows.push({
        key: "greener",
        label: "Greener option",
        values: selected.map((p) => (p.flight?.greener ? 1 : 0)),
        better: "max",
        fmt: (v) => (v ? "Yes" : "No"),
      });
    }

    // winners per metric
    const winners: Record<string, number[]> = {};
    rows.forEach((r) => {
      if (!r.better) return;
      const vals = r.values.map((v) => (typeof v === "number" ? v : undefined));
      const defined = vals.map((v, i) => ({ i, v })).filter((x) => x.v !== undefined);
      if (defined.length === 0) return;
      const best =
        r.better === "min"
          ? Math.min(...defined.map((x) => x.v as number))
          : Math.max(...defined.map((x) => x.v as number));
      winners[r.key] = defined.filter((x) => x.v === best).map((x) => x.i);
    });

    return { selected, rows, winners };
  }, [shownResults, comparedIds]);

  return (
    <div className="wrap">
      {/* HERO */}
      <section className="hero" role="region" aria-label="TripTrio tagline">
        <h1 className="hero-title">Find your perfect trip</h1>
        <p className="hero-sub">
          <span className="hero-badge">Top-3 picks</span>
          <span className="dot">•</span>
          <strong>Smarter</strong>
          <span className="dot">•</span>
          <strong>Clearer</strong>
          <span className="dot">•</span>
          <strong>Bookable</strong>
        </p>
      </section>

      {/* FORM */}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        {/* Row: origin + destination */}
        <div className="row two">
          <div>
            <label>Origin</label>
            <AirportField
              label=""
              code={originCode}
              initialDisplay={originDisplay}
              // @ts-ignore
              onTextChange={setOriginDisplay}
              // @ts-ignore
              onChangeCode={(code: string, display: string) => {
                setOriginCode(code);
                setOriginDisplay(display);
              }}
            />
          </div>

          <div className="swapcell" aria-hidden>
            <button
              type="button"
              className="swap"
              title="Swap origin & destination"
              onClick={swapOriginDest}
            >
              ⇄
            </button>
          </div>

          <div>
            <label>Destination</label>
            <AirportField
              label=""
              code={destCode}
              initialDisplay={destDisplay}
              // @ts-ignore
              onTextChange={setDestDisplay}
              // @ts-ignore
              onChangeCode={(code: string, display: string) => {
                setDestCode(code);
                setDestDisplay(display);
              }}
            />
          </div>
        </div>

        {/* Row: trip, dates (same line), passengers (+ ages), search button */}
        <div className="row dates-passengers">
          <div className="tripToggle">
            <label>Trip</label>
            <div className="segbtns">
              <button
                type="button"
                className={`seg ${!roundTrip ? "active" : ""}`}
                onClick={() => setRoundTrip(false)}
              >
                One-way
              </button>
              <button
                type="button"
                className={`seg ${roundTrip ? "active" : ""}`}
                onClick={() => setRoundTrip(true)}
              >
                Round-trip
              </button>
            </div>
          </div>

          <div>
            <label>Depart</label>
            <input
              type="date"
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              min={todayLocal}
              max={roundTrip && returnDate ? returnDate : undefined}
            />
          </div>

          <div>
            <label>Return</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={!roundTrip}
              min={departDate || todayLocal}
            />
          </div>

          <div className="passengerBlock">
            <label>Passengers</label>
            <div className="paxGrid">
              <span className="paxCell">
                <span className="paxLbl">Adults</span>
                <input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                />
              </span>
              <span className="paxCell">
                <span className="paxLbl">Children</span>
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                />
              </span>
              <span className="paxCell">
                <span className="paxLbl">Infants</span>
                <input
                  type="number"
                  min={0}
                  value={infants}
                  onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))}
                />
              </span>
            </div>

            {children > 0 && (
              <div className="agesWrap" role="group" aria-label="Children ages">
                <div className="agesTitle">Children ages (2–17)</div>
                <div className="agesGrid">
                  {childrenAges.map((age, idx) => (
                    <label key={idx} className="ageCell">
                      <span className="ageLbl">Child {idx + 1}</span>
                      <select
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
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="searchBtnCell">
            <button type="submit" className="primary">
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        {/* Row: cabin/stops/refundable/greener */}
        <div className="row four">
          <div>
            <label>Cabin</label>
            <select value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)}>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>

          <div>
            <label>Stops</label>
            <select
              value={maxStops}
              onChange={(e) => setMaxStops(Number(e.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>Nonstop</option>
              <option value={1}>1 stop</option>
              <option value={2}>More than 1 stop</option>
            </select>
          </div>

          <div className="chk">
            <label className="ck">
              <input
                type="checkbox"
                checked={refundable}
                onChange={(e) => setRefundable(e.target.checked)}
              />
              Refundable
            </label>
          </div>

          <div className="chk">
            <label className="ck">
              <input
                type="checkbox"
                checked={greener}
                onChange={(e) => setGreener(e.target.checked)}
              />
              Greener
            </label>
          </div>
        </div>

        {/* Row: currency + min/max budget */}
        <div className="row three">
          <div>
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Min budget</label>
            <input
              type="number"
              placeholder="min"
              value={minBudget === "" ? "" : String(minBudget)}
              onChange={(e) =>
                setMinBudget(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>

          <div>
            <label>Max budget</label>
            <input
              type="number"
              placeholder="max"
              value={maxBudget === "" ? "" : String(maxBudget)}
              onChange={(e) =>
                setMaxBudget(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
        </div>

        {/* Row: include hotel + check-in/out (same line) + stars */}
        <div className="row hotelRow">
          <div className="chk">
            <label className="ck">
              <input
                type="checkbox"
                checked={includeHotel}
                onChange={(e) => setIncludeHotel(e.target.checked)}
              />
              Include hotel
            </label>
          </div>

          <div>
            <label>Hotel check-in</label>
            <input
              type="date"
              value={hotelCheckIn}
              onChange={(e) => setHotelCheckIn(e.target.value)}
              disabled={!includeHotel}
              min={departDate || todayLocal}
            />
          </div>

          <div>
            <label>Hotel check-out</label>
            <input
              type="date"
              value={hotelCheckOut}
              onChange={(e) => setHotelCheckOut(e.target.value)}
              disabled={!includeHotel}
              min={hotelCheckIn || departDate || todayLocal}
            />
          </div>

          <div>
            <label>Min hotel stars</label>
            <select
              value={minHotelStar}
              onChange={(e) => setMinHotelStar(Number(e.target.value))}
              disabled={!includeHotel}
            >
              <option value={0}>Any</option>
              <option value={3}>3★+</option>
              <option value={4}>4★+</option>
              <option value={5}>5★</option>
            </select>
          </div>
        </div>
      </form>

      {/* SORT / VIEW / ACTIONS */}
      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Sort">
          {(["best", "cheapest", "fastest", "flexible"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={sort === k}
              className={`chip ${sort === k ? "active" : ""}`}
              onClick={() => setSort(k)}
            >
              {k === "best" ? "Best overall" : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        <div className="viewchips">
          <button
            className={`chip ${!showAll ? "active" : ""}`}
            onClick={() => setShowAll(false)}
            title="Show top 3"
          >
            Top-3
          </button>
          <button
            className={`chip ${showAll ? "active" : ""}`}
            onClick={() => setShowAll(true)}
            title="Show all"
          >
            All
          </button>
        </div>

        <div className="right">
          <button className="chip" onClick={exportPDF}>
            Export PDF
          </button>
          <button className="chip" onClick={printPage}>
            Print
          </button>
          <button className="chip" onClick={shareResults}>
            Share
          </button>
          <label className="ck" style={{ marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            Compare
          </label>
        </div>
      </div>

      {/* ======= COMPARISON (TOP) ======= */}
      {compareMode && (
        <section className="comparePanel top">
          <header className="cp-head">
            <div className="cp-title">Comparison</div>
            <div className="cp-sub">
              {comparedIds.length < 2
                ? "Pick at least two results to compare."
                : "🏆 marks the winner per metric"}
            </div>
          </header>

          {!includeHotel && (
            <div className="hint">
              Tip: turn on <b>Include hotel</b> and search to compare hotel name, stars and price.
            </div>
          )}

          {compareCalc && compareCalc.selected.length >= 1 && (
            <div className="cp-table" role="table" aria-label="Compare results">
              {/* header row */}
              <div className="cp-row head" role="row">
                <div className="cp-cell head sticky">Metric</div>
                {compareCalc.selected.map((p, i) => {
                  const f = p.flight || {};
                  const label =
                    (f.carrier_name || f.carrier || "Airline") +
                    (p.hotel?.name ? ` • ${p.hotel.name}` : "");
                  return (
                    <div key={i} className="cp-cell head">
                      <div className="cp-coltitle">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* body rows (already include hotel metrics first) */}
              {compareCalc &&
                compareCalc.rows.map((r) => (
                  <div className="cp-row" role="row" key={r.key}>
                    <div className="cp-cell sticky">{r.label}</div>
                    {compareCalc.selected.map((_p, i) => {
                      const v = r.values[i];
                      const isWin =
                        compareCalc.winners?.[r.key]?.includes(i) ?? false;
                      const display =
                        r.fmt ? r.fmt(v) : typeof v === "number" ? String(v) : String(v || "—");
                      return (
                        <div key={i} className={`cp-cell ${isWin ? "win" : ""}`}>
                          {isWin && "🏆 "}
                          {display}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* RESULTS & MESSAGES */}
      {error && <div className="error" role="alert">⚠ {error}</div>}
      {hotelWarning && !error && <div className="warn">ⓘ {hotelWarning}</div>}
      {loading && <div className="loading">Searching…</div>}
      {!loading && results && results.length === 0 && (
        <div className="empty">No results matched your filters.</div>
      )}

      {shownResults && shownResults.length > 0 && (
        <div className="results" id="results-root">
          {shownResults.map((pkg, i) => (
            <ResultCard
              key={pkg.id || i}
              pkg={pkg}
              index={i}
              currency={currency}
              comparedIds={compareMode ? comparedIds : undefined}
              onToggleCompare={compareMode ? toggleCompare : undefined}
            />
          ))}
        </div>
      )}

      {/* STICKY COMPARE BAR (kept for quick clear) */}
      {compareMode && comparedIds.length > 0 && (
        <div className="comparebar" role="region" aria-label="Compare selection">
          <div className="title">Compare ({comparedIds.length}/3 selected)</div>
          <div className="ids" title={comparedIds.join(" • ")}>
            {comparedIds.join("  •  ")}
          </div>
          <button className="btn" onClick={() => setComparedIds([])}>
            Clear
          </button>
        </div>
      )}

      {/* styles */}
      <style jsx>{`
        .wrap { padding: 16px; display: grid; gap: 16px; }

        .hero { padding-top: 4px; }
        .hero-title { margin: 0 0 6px; font-weight: 900; font-size: 30px; letter-spacing: -0.02em; }
        .hero-sub { margin: 0; display: flex; gap: 10px; align-items: center; color: #334155; font-weight: 700; flex-wrap: wrap; }
        .hero-badge { padding: 6px 12px; border-radius: 999px; background: linear-gradient(90deg,#06b6d4,#0ea5e9); color: #fff; font-weight: 900; }
        .dot { opacity: .6; }

        .panel { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px; display:grid; gap:12px;
                 max-width: 1200px; margin: 0 auto; }

        label { font-weight:800; color:#334155; display:block; margin-bottom:6px; }
        input[type="date"], input[type="number"], input[type="text"], select {
          height:42px; padding:0 10px; border:1px solid #e2e8f0; border-radius:10px; width:100%; background:#fff;
        }

        .row { display:grid; gap:12px; align-items:end; }
        .row.two { grid-template-columns: 1fr 54px 1fr; }
        .row.three { grid-template-columns: 1fr 1fr 1fr; }
        .row.four { grid-template-columns: 1fr 1fr 1fr 1fr; }
        .row.dates-passengers { grid-template-columns: 170px 1fr 1fr minmax(320px, 440px) 130px; align-items:end; }
        .row.hotelRow { grid-template-columns: 170px 1fr 1fr 1fr; }

        .segbtns { display: inline-flex; gap: 8px; align-items: center; }
        .seg { height:42px; padding:0 10px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; font-weight:800; font-size:13px; line-height:1; white-space:nowrap; }
        .seg.active { background:linear-gradient(90deg,#06b6d4,#0ea5e9); color:#fff; border:none; }
        .tripToggle { min-width:170px; }

        .swapcell { display:flex; align-items:flex-end; justify-content:center; }
        .swap { height:42px; width:42px; border-radius:12px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-size:18px;
                box-shadow: 0 1px 0 rgba(2,6,23,.04), inset 0 -2px 0 rgba(2,6,23,.02); }

        .paxGrid { display:grid; grid-template-columns: repeat(3, minmax(90px, 1fr)); gap:8px; align-items:center; }
        .paxCell input { width: 100%; }
        .paxLbl { display:block; font-size:12px; color:#475569; margin-bottom:4px; font-weight:800; }

        .agesWrap { margin-top: 8px; }
        .agesTitle { font-weight:800; color:#334155; font-size:12px; margin-bottom:6px; }
        .agesGrid { display:grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap:8px; }
        .ageLbl { display:block; font-size:11px; color:#64748b; margin-bottom:4px; font-weight:800; }

        .searchBtnCell { display:flex; justify-content:flex-end; align-items:end; }
        .primary { height:42px; padding:0 16px; border:none; font-weight:900; color:#fff; background:linear-gradient(90deg,#06b6d4,#0ea5e9); border-radius:10px; min-width:120px; }

        .chk .ck { display:flex; gap:8px; align-items:center; font-weight:800; color:#334155; }
        .ck input { transform: translateY(1px); }

        .toolbar { display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #e5e7eb;
                   border-radius:16px; padding:8px; gap:8px; flex-wrap:wrap; max-width:1200px; margin:0 auto; }
        .chips, .viewchips { display:flex; gap:8px; flex-wrap:wrap; }
        .chip { height:32px; padding:0 12px; border-radius:999px; border:1px solid #e2e8f0; background:#fff; font-weight:800; }
        .chip.active { border-color:#0ea5e9; box-shadow:0 0 0 2px rgba(14,165,233,.15) inset; }
        .right { display:flex; align-items:center; gap:8px; }

        /* Compare panel (TOP) */
        .comparePanel { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:12px; display:grid; gap:12px; max-width:1200px; margin:0 auto; }
        .comparePanel.top { order: 2; } /* sits after toolbar, before results */
        .cp-head { display:flex; align-items:baseline; gap:12px; justify-content:space-between; flex-wrap:wrap; }
        .cp-title { font-weight:900; font-size:18px; color:#0f172a; }
        .cp-sub { color:#475569; font-weight:700; }
        .hint { padding:8px 10px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; font-weight:700; }

        .cp-table { overflow-x:auto; }
        .cp-row { display:grid; grid-template-columns: 220px repeat(var(--cols, 3), minmax(200px, 1fr)); }
        .cp-row.head { border-bottom:1px solid #e5e7eb; padding-bottom:6px; }
        .cp-cell { padding:8px; border-bottom:1px dashed #e5e7eb; font-weight:700; color:#334155; }
        .cp-cell.head { font-weight:900; color:#0f172a; }
        .cp-cell.win { background:#ecfeff; border-bottom-color:#a5f3fc; }
        .cp-coltitle { font-weight:900; }
        .sticky { position: sticky; left: 0; background:#fff; z-index: 1; border-right:1px solid #e5e7eb; }

        .results { display:grid; gap:12px; max-width:1200px; margin:0 auto; }
        .loading, .empty, .error, .warn { padding:12px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; max-width:1200px; margin:0 auto; }
        .error { border-color:#fecaca; background:#fef2f2; color:#991b1b; font-weight:800; }
        .warn { border-color:#fde68a; background:#fffbeb; color:#92400e; font-weight:700; }

        .comparebar { position: sticky; bottom: 8px; display:flex; gap:12px; align-items:center; justify-content:space-between;
          background:#0ea5e9; color:#fff; padding:10px 12px; border-radius:12px; box-shadow:0 10px 28px rgba(2,6,23,.25);
          max-width:1200px; margin:0 auto; }
        .comparebar .title { font-weight:900; }
        .comparebar .ids { opacity:.9; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .comparebar .btn { height:32px; padding:0 10px; border-radius:10px; background:#fff; color:#0ea5e9; border:none; font-weight:900; }

        /* --- Responsive --- */
        @media (max-width: 1120px) {
          .row.dates-passengers { grid-template-columns: 160px 1fr 1fr minmax(300px, 1fr); }
          .searchBtnCell { grid-column: 1 / -1; justify-content: flex-end; }
        }
        @media (max-width: 820px) {
          .row.two { grid-template-columns: 1fr 44px 1fr; }
          .row.four { grid-template-columns: 1fr 1fr; }
          .row.three, .row.hotelRow { grid-template-columns: 1fr; }
          .row.dates-passengers { grid-template-columns: 1fr 1fr; }
          .tripToggle { grid-column: 1 / -1; }
          .passengerBlock { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}
