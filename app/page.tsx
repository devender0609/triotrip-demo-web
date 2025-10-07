"use client";
export const dynamic = "force-dynamic";

import React, { useMemo, useState } from "react";
import AirportField from "../components/AirportField";
import ResultCard from "../components/ResultCard";

/* ---------- UI helpers ---------- */
const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  background: "#ffffff",
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const chipActive: React.CSSProperties = {
  background: "#0ea5e9",
  borderColor: "#0ea5e9",
  color: "#fff",
};
const inputCls =
  "w-full border rounded-lg px-3 py-2 font-semibold text-slate-900 border-slate-200 focus:border-sky-300 focus:outline-none";

/* ---------- types & helpers ---------- */
type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

function iataOnly(s: string) {
  if (!s) return "";
  const m1 = /\(([A-Z]{3})\)/.exec(s);
  if (m1) return m1[1];
  const m2 = /^([A-Z]{3})\b/.exec(s);
  if (m2) return m2[1];
  return s.slice(0, 3).toUpperCase();
}

export default function Page() {
  // core search state
  const [originCode, setOriginCode] = useState("");
  const [destCode, setDestCode] = useState("");
  const [originDisplay, setOriginDisplay] = useState("");
  const [destDisplay, setDestDisplay] = useState("");

  const [roundTrip, setRoundTrip] = useState(true);
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [cabin, setCabin] = useState<Cabin>("ECONOMY");
  const [stops, setStops] = useState<0 | 1 | 2 | 3>(3);
  const [refundable, setRefundable] = useState(false);
  const [greener, setGreener] = useState(false);

  const [currency, setCurrency] = useState("USD");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  const [includeHotel, setIncludeHotel] = useState(false);
  const [hotelIn, setHotelIn] = useState("");
  const [hotelOut, setHotelOut] = useState("");
  const [minStars, setMinStars] = useState("");

  const [mode, setMode] = useState<"top3" | "all">("top3");
  const [compare, setCompare] = useState(false); // master compare toggle
  const [saved, setSaved] = useState<string[]>(["demo1", "demo2"]);

  const passengersTotal = adults + children + infants;

  // demo results (kept simple and stable)
  const results = useMemo(() => {
    const mkSeg = (from: string, to: string, dur: number, iso: string) => ({
      from,
      to,
      duration_minutes: dur,
      depart_time: iso,
    });

    const outSegs = [
      mkSeg(originCode || "AUS", "ORD", 160, (depart || "2025-10-15") + "T08:20:00Z"),
      mkSeg("ORD", destCode || "DEL", 520, (depart || "2025-10-15") + "T12:40:00Z"),
    ];

    const inSegs = roundTrip
      ? [
          mkSeg(destCode || "DEL", "FRA", 460, (ret || "2025-12-04") + "T13:00:00Z"),
          mkSeg("FRA", originCode || "AUS", 600, (ret || "2025-12-04") + "T21:15:00Z"),
        ]
      : [];

    return Array.from({ length: 3 }).map((_, i) => ({
      id: `pkg_${i + 1}`,
      airline_name: i % 2 ? "United" : "Delta",
      airline_code: i % 2 ? "UA" : "DL",
      origin: (originCode || "AUS").toUpperCase(),
      destination: (destCode || "DEL").toUpperCase(),
      departDate: depart || "2025-10-15",
      returnDate: roundTrip ? ret || "2025-12-04" : "",
      roundTrip,
      passengersAdults: adults,
      currency,
      greener: i % 2 === 0,
      refundable: i % 3 === 0,
      flight: {
        segments_out: outSegs,
        segments_in: inSegs,
        price_usd: 900 + i * 30,
        stops: outSegs.length - 1,
      },
      hotels: includeHotel
        ? [
            { name: "Grand Plaza", stars: 4, price: 160 + i * 5, currency },
            { name: "Oberoi", stars: 5, price: 300 + i * 5, currency },
            { name: "City Inn", stars: 3, price: 110 + i * 5, currency },
          ]
        : [],
    }));
  }, [originCode, destCode, depart, ret, roundTrip, adults, currency, includeHotel]);

  const visible = mode === "top3" ? results.slice(0, 3) : results;

  function swapAirports() {
    const oCode = originCode;
    const oDisp = originDisplay;
    setOriginCode(destCode);
    setOriginDisplay(destDisplay);
    setDestCode(oCode);
    setDestDisplay(oDisp);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-3xl font-extrabold mb-3">Find your perfect trip</h1>

      {/* badges */}
      <div className="mb-3 flex gap-2">
        <span style={{ ...chipBase, background: "#e0f2fe", borderColor: "#7dd3fc", color: "#0369a1" }}>Top-3 picks</span>
        <span style={chipBase}>Smarter</span>
        <span style={chipBase}>Clearer</span>
        <span style={chipBase}>Bookable</span>
      </div>

      {/* search card */}
      <section className="rounded-2xl border bg-white p-4 mb-4">
        {/* Origin / Destination */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3">
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Origin</div>
            <AirportField
              id="origin"
              label="Origin"
              code={originCode}
              initialDisplay={originDisplay}
              onTextChange={setOriginDisplay}
              onChangeCode={(code: string, display: string) => {
                setOriginCode(iataOnly(code));
                setOriginDisplay(display || code);
              }}
            />
          </div>

          <div className="flex items-end justify-center md:pb-0 pb-2">
            <button className="btn small" title="Swap" onClick={swapAirports}>↔</button>
          </div>

          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Destination</div>
            <AirportField
              id="destination"
              label="Destination"
              code={destCode}
              initialDisplay={destDisplay}
              onTextChange={setDestDisplay}
              onChangeCode={(code: string, display: string) => {
                setDestCode(iataOnly(code));
                setDestDisplay(display || code);
              }}
            />
          </div>
        </div>

        {/* Trip + dates + pax + search (one row on md+) */}
        <div className="mt-4 grid md:grid-cols-[auto_1fr_1fr_auto] gap-3">
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Trip</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
              <button style={{ ...chipBase, ...(!roundTrip ? chipActive : {}) }} onClick={() => setRoundTrip(false)}>
                One-way
              </button>
              <button style={{ ...chipBase, ...(roundTrip ? chipActive : {}) }} onClick={() => setRoundTrip(true)}>
                Round-trip
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Depart</div>
              <input className={inputCls} type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
            </div>
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Return</div>
              <input
                className={`${inputCls} disabled:bg-slate-50`}
                type="date"
                disabled={!roundTrip}
                value={ret}
                onChange={(e) => setRet(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Adults</div>
              <input
                className={inputCls}
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Children</div>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Math.max(0, Number(e.target.value || 0)))}
              />
            </div>
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Infants</div>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={infants}
                onChange={(e) => setInfants(Math.max(0, Number(e.target.value || 0)))}
              />
            </div>
          </div>

          <div className="flex items-end">
            <button style={{ ...chipBase, ...chipActive, padding: "10px 18px", borderRadius: 12 }}>
              Search
            </button>
          </div>
        </div>

        {/* Cabin / Stops / Flags */}
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Cabin</div>
            <select className={inputCls} value={cabin} onChange={(e) => setCabin(e.target.value as Cabin)}>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <div className="font-semibold text-slate-700 text-sm mb-1">Stops</div>
              <select
                className={inputCls}
                value={String(stops)}
                onChange={(e) => setStops(Number(e.target.value) as 0 | 1 | 2 | 3)}
              >
                <option value="0">Non-stop</option>
                <option value="1">1 stop</option>
                <option value="2">2 stops</option>
                <option value="3">More than 1 stop</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={refundable}
                onChange={(e) => setRefundable(e.target.checked)}
              />
              Refundable
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={greener}
                onChange={(e) => setGreener(e.target.checked)}
              />
              Greener
            </label>
          </div>
        </div>

        {/* Currency / Budgets */}
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Currency</div>
            <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option>USD</option>
              <option>EUR</option>
              <option>INR</option>
            </select>
          </div>
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Min budget</div>
            <input
              className={inputCls}
              placeholder="min"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
            />
          </div>
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Max budget</div>
            <input
              className={inputCls}
              placeholder="max"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
            />
          </div>
        </div>

        {/* Hotels */}
        <div className="mt-4 grid md:grid-cols-[auto_1fr_1fr_1fr] gap-3 items-end">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includeHotel}
              onChange={(e) => setIncludeHotel(e.target.checked)}
            />
            Include hotel
          </label>
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Hotel check-in</div>
            <input
              className={inputCls}
              type="date"
              value={hotelIn}
              onChange={(e) => setHotelIn(e.target.value)}
            />
          </div>
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Hotel check-out</div>
            <input
              className={inputCls}
              type="date"
              value={hotelOut}
              onChange={(e) => setHotelOut(e.target.value)}
            />
          </div>
          <div>
            <div className="font-semibold text-slate-700 text-sm mb-1">Min hotel stars</div>
            <select
              className={inputCls}
              value={minStars}
              onChange={(e) => setMinStars(e.target.value)}
            >
              <option value="">Any</option>
              <option value="2">2★</option>
              <option value="3">3★</option>
              <option value="4">4★</option>
              <option value="5">5★</option>
            </select>
          </div>
        </div>

        {/* Sort row */}
        <div className="mt-4">
          <div className="font-semibold text-slate-700 text-sm mb-1">Sort by (basis)</div>
          <div className="flex gap-2 flex-wrap">
            <button style={{ ...chipBase, ...chipActive }}>Flight only</button>
            <button style={{ ...chipBase }}>Bundle total</button>
          </div>
        </div>
      </section>

      {/* bottom toolbar (chips row) */}
      <div className="mb-3 rounded-full border bg-white px-3 py-2 flex gap-2 flex-wrap items-center">
        <button style={{ ...chipBase, background: "#e0f2fe", borderColor: "#7dd3fc", color: "#0369a1" }}>
          Best overall
        </button>
        <button style={chipBase}>Cheapest</button>
        <button style={chipBase}>Fastest</button>
        <button style={chipBase}>Flexible</button>
        <button
          style={{ ...chipBase, ...(mode === "top3" ? chipActive : {}) }}
          onClick={() => setMode("top3")}
        >
          Top-3
        </button>
        <button
          style={{ ...chipBase, ...(mode === "all" ? chipActive : {}) }}
          onClick={() => setMode("all")}
        >
          All
        </button>
        <span style={{ ...chipBase, background: "#f1f5f9" }}>Saved: {saved.length}</span>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Compare
        </label>
      </div>

      {/* results */}
      <div className="grid gap-3">
        {visible.map((pkg) => (
          <ResultCard
            key={pkg.id}
            pkg={pkg}
            currency={currency}
            compareMode={compare} // master toggle drives card chip visibility
            passengersCount={passengersTotal}
            onSave={(id: string) =>
              setSaved((arr) => (arr.includes(id) ? arr : arr.concat(id)))
            }
          />
        ))}
      </div>
    </main>
  );
}
