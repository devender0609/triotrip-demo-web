"use client";
export const dynamic = "force-dynamic";

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

  minBudget?: number;
  maxBudget?: number;
  currency: string;
  sort: SortKey;
  maxStops?: 0 | 1 | 2;
  refundable?: boolean;
  greener?: boolean;

  sortBasis?: "flightOnly" | "bundle";
};

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
  const [showAll, setShowAll] = useState(false);

  // results
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hotelWarning, setHotelWarning] = useState<string | null>(null);

  const passengersTotal = adults + children + infants;

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
            segments_out: [{ from: origin, to: destination, depart_time: `${departDate}T08:20`, arrive_time: `${departDate}T11:05`, duration_minutes: 165 }],
            ...(roundTrip
              ? {
                  segments_in: [
                    {
                      from: destination,
                      to: origin,
                      depart_time: `${returnDate || departDate}T17:35`,
                      arrive_time: `${returnDate || departDate}T20:10`,
                      duration_minutes: 155,
                    },
                  ],
                }
              : {}),
            duration_minutes: roundTrip ? 165 + 155 : 165,
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

  useEffect(() => {
    if (results) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, sortBasis]);

  function toggleCompare(id: string) {
    setComparedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)
    );
  }

  /* ---------- PDF export helpers ---------- */
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
      better: "min" | "max" | null;
      fmt?: (v: any) => string;
    }[] = [];

    if (selected.length > 0) {
      rows.push({ key: "Hotel", label: "Hotel", values: selected.map((p) => p.hotel?.name || "—"), better: null });
      rows.push({ key: "HotelStars", label: "Hotel stars", values: selected.map((p) => num(p.hotel?.star)), better: "max", fmt: (v) => (typeof v === "number" ? `${v}★` : "—") });
      rows.push({
        key: "HotelPrice", label: "Hotel price",
        values: selected.map((p) => num(p.hotel?.price_converted) ?? num(p.hotel?.total_usd) ?? undefined),
        better: "min", fmt: (v) => fmtCurrency(num(v), "USD"),
      });
      const totals = selected.map((p) => {
        const f = p.flight || {};
        return num(p.total_cost_converted) ?? num(p.total_cost) ?? num(f.price_usd_converted) ?? num(f.price_usd);
      });
      rows.push({ key: "Total", label: "Total price", values: totals, better: "min", fmt: (v) => fmtCurrency(num(v), "USD") });
      const fprices = selected.map((p) => {
        const f = p.flight || {};
        return num(f.price_usd_converted) ?? num(f.price_usd) ?? undefined;
      });
      rows.push({ key: "FlightPrice", label: "Flight price", values: fprices, better: "min", fmt: (v) => fmtCurrency(num(v), "USD") });
      const stops = selected.map((p) => {
        const f = p.flight || {};
        if (typeof f.stops === "number") return f.stops;
        const out = segsFromFlight(f, "out");
        return out.length ? out.length - 1 : undefined;
      });
      rows.push({ key: "Stops", label: "Stops", values: stops, better: "min" });
      const outDur = selected.map((p) => {
        const f = p.flight || {};
        return num(f.out_duration_minutes) ?? (() => {
          const segs = segsFromFlight(f, "out");
          return segs.length ? sumSegMinutes(segs) : undefined;
        })();
      });
      rows.push({ key: "OutDur", label: "Outbound duration", values: outDur, better: "min", fmt: (v) => minutesToText(num(v)) });
      const retDur = selected.map((p) => {
        const f = p.flight || {};
        return num(f.return_duration_minutes) ?? (() => {
          const segs = segsFromFlight(f, "ret");
          return segs.length ? sumSegMinutes(segs) : undefined;
        })();
      });
      rows.push({ key: "RetDur", label: "Return duration", values: retDur, better: "min", fmt: (v) => minutesToText(num(v)) });
      const overallDur = selected.map((p, i) => {
        const f = p.flight || {};
        return num(f.duration_minutes) ?? (num(outDur[i]) && num(retDur[i]) ? (num(outDur[i]) as number) + (num(retDur[i]) as number) : undefined);
      });
      rows.push({ key: "OverallDur", label: "Total duration", values: overallDur, better: "min", fmt: (v) => minutesToText(num(v)) });
      rows.push({ key: "Cabin", label: "Cabin", values: selected.map((p) => p.flight?.cabin || "—"), better: null });
      rows.push({ key: "Airline", label: "Airline", values: selected.map((p) => p.flight?.carrier_name || p.flight?.carrier || "—"), better: null });
      rows.push({ key: "Refundable", label: "Refundable", values: selected.map((p) => (p.flight?.refundable ? 1 : 0)), better: "max", fmt: (v) => (v ? "Yes" : "No") });
      rows.push({ key: "Greener", label: "Greener option", values: selected.map((p) => (p.flight?.greener ? 1 : 0)), better: "max", fmt: (v) => (v ? "Yes" : "No") });
    }

    const winners: Record<string, number[]> = {};
    rows.forEach((r) => {
      if (!r.better) return;
      const vals = r.values.map((v) => (typeof v === "number" ? v : undefined));
      const defined = vals.map((v, i) => ({ i, v })).filter((x) => x.v !== undefined);
      if (defined.length === 0) return;
      const best = r.better === "min"
        ? Math.min(...defined.map((x) => x.v as number))
        : Math.max(...defined.map((x) => x.v as number));
      winners[r.key] = defined.filter((x) => x.v === best).map((x) => x.i);
    });

    return { selected, rows, winners };
  }, [shownResults, comparedIds]);

  /* ---------------- inline styles (to avoid styled-jsx parsing) ---------------- */
  const s = {
    wrap: { padding: 16, display: "grid", gap: 16 } as React.CSSProperties,
    panel: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, display: "grid", gap: 12, maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
    label: { fontWeight: 800 as any, color: "#334155", display: "block", marginBottom: 6 },
    input: { height: 42, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, width: "100%", background: "#fff" } as React.CSSProperties,
    row: { display: "grid", gap: 12, alignItems: "end" } as React.CSSProperties,
    two: { gridTemplateColumns: "1fr 54px 1fr" } as React.CSSProperties,
    three: { gridTemplateColumns: "1fr 1fr 1fr" } as React.CSSProperties,
    four: { gridTemplateColumns: "1fr 1fr 1fr 1fr" } as React.CSSProperties,
    datesPassengers: { gridTemplateColumns: "170px 1fr 1fr minmax(320px, 440px) 130px" } as React.CSSProperties,
    hotelRow: { gridTemplateColumns: "170px 1fr 1fr 1fr" } as React.CSSProperties,
    seg: { height: 42, padding: "0 10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 800, fontSize: 13, lineHeight: 1, whiteSpace: "nowrap" } as React.CSSProperties,
    segActive: { background: "linear-gradient(90deg,#06b6d4,#0ea5e9)", color: "#fff", border: "none" } as React.CSSProperties,
    swapcell: { display: "flex", alignItems: "flex-end", justifyContent: "center" } as React.CSSProperties,
    swap: { height: 42, width: 42, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 18, boxShadow: "0 1px 0 rgba(2,6,23,.04), inset 0 -2px 0 rgba(2,6,23,.02)" } as React.CSSProperties,
    paxGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(90px, 1fr))", gap: 8, alignItems: "center" } as React.CSSProperties,
    paxLbl: { display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 800 } as React.CSSProperties,
    agesTitle: { fontWeight: 800, color: "#334155", fontSize: 12, marginBottom: 6 } as React.CSSProperties,
    agesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 } as React.CSSProperties,
    primary: { height: 42, padding: "0 16px", border: "none", fontWeight: 900, color: "#fff", background: "linear-gradient(90deg,#06b6d4,#0ea5e9)", borderRadius: 10, minWidth: 120 } as React.CSSProperties,
    ck: { display: "flex", gap: 8, alignItems: "center", fontWeight: 800, color: "#334155" } as React.CSSProperties,
    toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 8, gap: 8, flexWrap: "wrap", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
    chips: { display: "flex", gap: 8, flexWrap: "wrap" } as React.CSSProperties,
    chip: { height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 800 } as React.CSSProperties,
    chipActive: { borderColor: "#0ea5e9", boxShadow: "0 0 0 2px rgba(14,165,233,.15) inset" } as React.CSSProperties,
    results: { display: "grid", gap: 14, maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
    msg: { padding: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
    error: { borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 800 } as React.CSSProperties,
    warn: { borderColor: "#fde68a", background: "#fffbeb", color: "#92400e", fontWeight: 700 } as React.CSSProperties,
    compareBar: { position: "sticky" as const, bottom: 8, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", background: "#0ea5e9", color: "#fff", padding: "10px 12px", borderRadius: 12, boxShadow: "0 10px 28px rgba(2,6,23,.25)", maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
    cmpCell: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, fontWeight: 800, color: "#0f172a" } as React.CSSProperties,
    cmpKey: { fontWeight: 900, color: "#334155" } as React.CSSProperties,
    cmpHeadCell: { fontWeight: 900, textAlign: "center" as const } as React.CSSProperties,
    win: { borderColor: "#0ea5e9", boxShadow: "0 0 0 2px rgba(14,165,233,.12) inset" } as React.CSSProperties,
  };

  return (
    <div style={s.wrap}>
      {/* HERO */}
      <section role="region" aria-label="TripTrio tagline">
        <h1 style={{ margin: "0 0 6px", fontWeight: 900, fontSize: 30, letterSpacing: "-0.02em" }}>
          Find your perfect trip
        </h1>
        <p style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", color: "#334155", fontWeight: 700, flexWrap: "wrap" }}>
          <span style={{ padding: "6px 12px", borderRadius: 999, background: "linear-gradient(90deg,#06b6d4,#0ea5e9)", color: "#fff", fontWeight: 900 }}>
            Top-3 picks
          </span>
          <span style={{ opacity: .6 }}>•</span>
          <strong>Smarter</strong>
          <span style={{ opacity: .6 }}>•</span>
          <strong>Clearer</strong>
          <span style={{ opacity: .6 }}>•</span>
          <strong>Bookable</strong>
        </p>
      </section>

      {/* FORM */}
      <form
        style={s.panel}
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        {/* Row: origin + destination */}
        <div style={{ ...s.row, ...s.two }}>
          <div>
            <label style={s.label}>Origin</label>
            <AirportField
              id="origin"
              label=""
              code={originCode}
              initialDisplay={originDisplay}
              onTextChange={(t) => setOriginDisplay(t)}
              onChangeCode={(code: string, display: string) => {
                setOriginCode(code);
                setOriginDisplay(display);
              }}
            />
          </div>

          <div style={s.swapcell} aria-hidden>
            <button
              type="button"
              style={s.swap}
              title="Swap origin & destination"
              onClick={swapOriginDest}
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
              onChangeCode={(code: string, display: string) => {
                setDestCode(code);
                setDestDisplay(display);
              }}
            />
          </div>
        </div>

        {/* Row: trip, dates, passengers, search */}
        <div style={{ ...s.row, ...s.datesPassengers }}>
          <div style={{ minWidth: 170 }}>
            <label style={s.label}>Trip</label>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...s.seg, ...( !roundTrip ? s.segActive : {} ) }}
                onClick={() => setRoundTrip(false)}
              >
                One-way
              </button>
              <button
                type="button"
                style={{ ...s.seg, ...( roundTrip ? s.segActive : {} ) }}
                onClick={() => setRoundTrip(true)}
              >
                Round-trip
              </button>
            </div>
          </div>

          <div>
            <label style={s.label}>Depart</label>
            <input
              type="date"
              style={s.input}
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              min={todayLocal}
              max={roundTrip && returnDate ? returnDate : undefined}
            />
          </div>

          <div>
            <label style={s.label}>Return</label>
            <input
              type="date"
              style={s.input}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={!roundTrip}
              min={departDate || todayLocal}
            />
          </div>

          <div>
            <label style={s.label}>Passengers</label>
            <div style={s.paxGrid}>
              <span>
                <span style={s.paxLbl}>Adults</span>
                <input
                  type="number"
                  min={1}
                  style={s.input}
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                />
              </span>
              <span>
                <span style={s.paxLbl}>Children</span>
                <input
                  type="number"
                  min={0}
                  style={s.input}
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                />
              </span>
              <span>
                <span style={s.paxLbl}>Infants</span>
                <input
                  type="number"
                  min={0}
                  style={s.input}
                  value={infants}
                  onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))}
                />
              </span>
            </div>

            {children > 0 && (
              <div role="group" aria-label="Children ages" style={{ marginTop: 8 }}>
                <div style={s.agesTitle}>Children ages (2–17)</div>
                <div style={s.agesGrid}>
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

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "end" }}>
            <button type="submit" style={s.primary}>
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        {/* Row: cabin/stops/refundable/greener */}
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
            <select style={s.input}
              value={maxStops}
              onChange={(e) => setMaxStops(Number(e.target.value) as 0 | 1 | 2)}
            >
              <option value={0}>Nonstop</option>
              <option value={1}>1 stop</option>
              <option value={2}>More than 1 stop</option>
            </select>
          </div>

          <div>
            <label style={s.ck}>
              <input
                type="checkbox"
                checked={refundable}
                onChange={(e) => setRefundable(e.target.checked)}
              />
              Refundable
            </label>
          </div>

          <div>
            <label style={s.ck}>
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
        <div style={{ ...s.row, ...s.three }}>
          <div>
            <label style={s.label}>Currency</label>
            <select style={s.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={s.label}>Min budget</label>
            <input
              type="number"
              placeholder="min"
              min={0}
              style={s.input}
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
              type="number"
              placeholder="max"
              min={0}
              style={s.input}
              value={maxBudget === "" ? "" : String(maxBudget)}
              onChange={(e) => {
                if (e.target.value === "") return setMaxBudget("");
                const v = Number(e.target.value);
                setMaxBudget(Number.isFinite(v) ? Math.max(0, v) : 0);
              }}
            />
          </div>
        </div>

        {/* Row: include hotel + check-in/out + stars */}
        <div style={{ ...s.row, ...s.hotelRow }}>
          <div>
            <label style={s.ck}>
              <input
                type="checkbox"
                checked={includeHotel}
                onChange={(e) => setIncludeHotel(e.target.checked)}
              />
              Include hotel
            </label>
          </div>

          <div>
            <label style={s.label}>Hotel check-in</label>
            <input
              type="date"
              style={s.input}
              value={hotelCheckIn}
              onChange={(e) => setHotelCheckIn(e.target.value)}
              disabled={!includeHotel}
              min={departDate || todayLocal}
            />
          </div>

          <div>
            <label style={s.label}>Hotel check-out</label>
            <input
              type="date"
              style={s.input}
              value={hotelCheckOut}
              onChange={(e) => setHotelCheckOut(e.target.value)}
              disabled={!includeHotel}
              min={hotelCheckIn || departDate || todayLocal}
            />
          </div>

          <div>
            <label style={s.label}>Min hotel stars</label>
            <select
              style={s.input}
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

        {/* Row: sort basis */}
        <div style={{ ...s.row, ...s.three }}>
          <div>
            <label style={s.label}>Sort by</label>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...s.seg, ...(sortBasis === "flightOnly" ? s.segActive : {}) }}
                onClick={() => setSortBasis("flightOnly")}
                title="Sort using flight price/duration only"
              >
                Flight only
              </button>
              <button
                type="button"
                style={{ ...s.seg, ...(sortBasis === "bundle" ? s.segActive : {}) }}
                onClick={() => setSortBasis("bundle")}
                title="Sort using flight + hotel total"
              >
                Bundle total
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* SORT / VIEW / ACTIONS */}
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
          <button style={s.chip} onClick={exportPDF}>
            Export PDF
          </button>
          <button style={s.chip} onClick={printPage}>
            Print
          </button>
          <button style={s.chip} onClick={shareResults}>
            Share
          </button>
          <label style={{ ...s.ck, marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            Compare
          </label>
        </div>
      </div>

      {/* COMPARE TABLE */}
      {compareMode && compareCalc && compareCalc.selected.length >= 2 && (
        <div style={s.panel} role="region" aria-label="Comparison table">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Comparison</div>

          {/* Head row */}
          <div
            style={{
              display: "grid",
              gap: 6,
              gridTemplateColumns: `220px repeat(${compareCalc.selected.length}, 1fr)`,
            }}
          >
            <div style={{ ...s.cmpCell }} />
            {compareCalc.selected.map((p, i) => (
              <div key={i} style={{ ...s.cmpCell, ...s.cmpHeadCell }}>
                {p.flight?.carrier_name || p.flight?.carrier || p.id || `#${i + 1}`}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {compareCalc.rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gap: 6,
                gridTemplateColumns: `220px repeat(${compareCalc.selected.length}, 1fr)`,
                marginTop: 6,
              }}
            >
              <div style={{ ...s.cmpCell, ...s.cmpKey }}>{r.label}</div>
              {r.values.map((v, i) => {
                const winners = compareCalc.winners[r.key] || [];
                const isWin = winners.includes(i);
                const display = r.fmt ? r.fmt(v) : (v ?? "—");
                return (
                  <div
                    key={i}
                    style={{ ...s.cmpCell, ...(isWin ? s.win : {}) }}
                  >
                    {display as any}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* RESULTS & MESSAGES */}
      {error && <div style={{ ...s.msg, ...s.error }} role="alert">⚠ {error}</div>}
      {hotelWarning && !error && <div style={{ ...s.msg, ...s.warn }}>ⓘ {hotelWarning}</div>}
      {loading && <div style={s.msg}>Searching…</div>}
      {!loading && results && results.length === 0 && (
        <div style={s.msg}>No results matched your filters.</div>
      )}

      {shownResults && shownResults.length > 0 && (
        <div style={s.results} id="results-root">
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

      {/* STICKY COMPARE BAR */}
      {compareMode && comparedIds.length > 0 && (
        <div style={s.compareBar} role="region" aria-label="Compare selection">
          <div style={{ fontWeight: 900 }}>Compare ({comparedIds.length}/3 selected)</div>
          <div style={{ opacity: .9, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={comparedIds.join(" • ")}>
            {comparedIds.join("  •  ")}
          </div>
          <button style={{ height: 32, padding: "0 10px", borderRadius: 10, background: "#fff", color: "#0ea5e9", border: "none", fontWeight: 900 }} onClick={() => setComparedIds([])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
