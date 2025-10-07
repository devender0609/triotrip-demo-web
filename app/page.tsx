"use client";

import React, { useCallback, useMemo, useState } from "react";
import ResultCard from "../components/ResultCard";
import AirportField from "../components/AirportField";

type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SortKey = "best" | "cheapest" | "fastest" | "flexible";

type SearchPayload = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  roundTrip: boolean;

  adults: number;
  children: number;
  infants: number;

  cabin: Cabin;
  stops: "nonstop" | "1" | "2plus" | "any";
  refundable: boolean;
  greener: boolean;

  currency: string;
  minBudget?: number | "";
  maxBudget?: number | "";

  includeHotel: boolean;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  minHotelStar?: number | "Any";
};

export default function Page() {
  // ---------- form state (EMPTY BY DEFAULT) ----------
  const [payload, setPayload] = useState<SearchPayload>({
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    roundTrip: true,
    adults: 1,
    children: 0,
    infants: 0,
    cabin: "ECONOMY",
    stops: "any",
    refundable: false,
    greener: false,
    currency: "USD",
    minBudget: "",
    maxBudget: "",
    includeHotel: false,
    hotelCheckIn: "",
    hotelCheckOut: "",
    minHotelStar: "Any",
  });

  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [sort, setSort] = useState<SortKey>("best");
  const [basis, setBasis] = useState<"flight" | "bundle">("flight");
  const [compareMode, setCompareMode] = useState(true);

  // ---------- handlers ----------
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setHasSearched(true);

    // TODO: replace with your real API call
    // const res = await fetch("/api/search", { method: "POST", body: JSON.stringify(payload) });
    // const data = await res.json();
    // setResults(data.items);

    // Temporary: no auto-demo data on first load
    setResults([]); // keep empty until your API returns
    setIsLoading(false);
  };

  const disabledSearch = useMemo(() => {
    if (!payload.origin || !payload.destination || !payload.departDate) return true;
    if (payload.roundTrip && !payload.returnDate) return true;
    return false;
  }, [payload]);

  // ---------- helpers ----------
  const setField = <K extends keyof SearchPayload>(k: K, v: SearchPayload[K]) =>
    setPayload((p) => ({ ...p, [k]: v }));

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <a className="text-2xl font-semibold hover:underline" href="/">
          TripTrio
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <a className="hover:underline" href="#">Saved</a>
          <a className="hover:underline" href="#">Login</a>
        </nav>
      </header>

      <h1 className="text-4xl font-semibold mb-6">Find your perfect trip</h1>

      {/* chips */}
      <div className="flex gap-2 mb-6">
        {["Top-3 picks", "Smarter", "Clearer", "Bookable"].map((t) => (
          <span key={t} className="px-3 py-1 rounded-full border text-sm">{t}</span>
        ))}
      </div>

      {/* ======= SEARCH FORM (Figure 2 layout) ======= */}
      <form onSubmit={onSubmit} className="rounded-2xl border p-4 md:p-6 space-y-4">
        {/* Row 1: Origin / Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Origin</label>
            <AirportField
              value={payload.origin}
              onChange={(v) => setField("origin", v)}
              placeholder="City, airport or code"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Destination</label>
            <AirportField
              value={payload.destination}
              onChange={(v) => setField("destination", v)}
              placeholder="City, airport or code"
            />
          </div>
        </div>

        {/* Row 2: Trip / Dates / Passengers / Search */}
        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr,1fr,auto,auto,auto] gap-4 items-end">
          {/* Trip */}
          <div>
            <label className="block text-sm font-semibold mb-1">Trip</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setField("roundTrip", false)}
                className={`px-3 py-2 rounded-lg border ${!payload.roundTrip ? "bg-cyan-500 text-white" : ""}`}
              >
                One-way
              </button>
              <button
                type="button"
                onClick={() => setField("roundTrip", true)}
                className={`px-3 py-2 rounded-lg border ${payload.roundTrip ? "bg-cyan-500 text-white" : ""}`}
              >
                Round-trip
              </button>
            </div>
          </div>

          {/* Depart / Return */}
          <div>
            <label className="block text-sm font-semibold mb-1">Depart</label>
            <input
              type="date"
              value={payload.departDate}
              onChange={(e) => setField("departDate", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Return</label>
            <input
              type="date"
              value={payload.returnDate}
              onChange={(e) => setField("returnDate", e.target.value)}
              disabled={!payload.roundTrip}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
            />
          </div>

          {/* Passengers */}
          <div>
            <label className="block text-sm font-semibold mb-1">Adults</label>
            <input
              type="number"
              min={1}
              value={payload.adults}
              onChange={(e) => setField("adults", Number(e.target.value || 0))}
              className="w-24 rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Children</label>
            <input
              type="number"
              min={0}
              value={payload.children}
              onChange={(e) => setField("children", Number(e.target.value || 0))}
              className="w-24 rounded-lg border px-3 py-2"
            />
          </div>
          <div className="md:justify-self-end">
            <button
              type="submit"
              disabled={disabledSearch || isLoading}
              className="px-5 py-2 rounded-lg bg-cyan-600 text-white disabled:opacity-50"
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        {/* Row 3: Cabin / Stops / Flags / Currency / Budgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Cabin</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={payload.cabin}
              onChange={(e) => setField("cabin", e.target.value as Cabin)}
            >
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Stops</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={payload.stops}
              onChange={(e) => setField("stops", e.target.value as SearchPayload["stops"])}
            >
              <option value="any">More than 1 stop</option>
              <option value="nonstop">Nonstop only</option>
              <option value="1">1 stop</option>
              <option value="2plus">2+ stops</option>
            </select>
          </div>

          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={payload.refundable}
                onChange={(e) => setField("refundable", e.target.checked)}
              />
              <span>Refundable</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={payload.greener}
                onChange={(e) => setField("greener", e.target.checked)}
              />
              <span>Greener</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Currency</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={payload.currency}
              onChange={(e) => setField("currency", e.target.value)}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>INR</option>
            </select>
          </div>
        </div>

        {/* Row 4: budgets + hotel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Min budget</label>
            <input
              placeholder="min"
              className="w-full rounded-lg border px-3 py-2"
              value={payload.minBudget ?? ""}
              onChange={(e) => setField("minBudget", e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Max budget</label>
            <input
              placeholder="max"
              className="w-full rounded-lg border px-3 py-2"
              value={payload.maxBudget ?? ""}
              onChange={(e) => setField("maxBudget", e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Hotel check-in</label>
            <input
              type="date"
              disabled={!payload.includeHotel}
              value={payload.hotelCheckIn}
              onChange={(e) => setField("hotelCheckIn", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Hotel check-out</label>
            <input
              type="date"
              disabled={!payload.includeHotel}
              value={payload.hotelCheckOut}
              onChange={(e) => setField("hotelCheckOut", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={payload.includeHotel}
              onChange={(e) => setField("includeHotel", e.target.checked)}
            />
            <span>Include hotel</span>
          </label>
          <div className="md:col-start-4">
            <label className="block text-sm font-semibold mb-1">Min hotel stars</label>
            <select
              disabled={!payload.includeHotel}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
              value={payload.minHotelStar ?? "Any"}
              onChange={(e) => setField("minHotelStar", (e.target.value as any) || "Any")}
            >
              <option>Any</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>

        {/* basis toggle */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="text-sm font-semibold mr-2">Sort by (basis)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBasis("flight")}
              className={`px-3 py-1 rounded-full border ${basis === "flight" ? "bg-cyan-100 border-cyan-400" : ""}`}
            >
              Flight only
            </button>
            <button
              type="button"
              onClick={() => setBasis("bundle")}
              className={`px-3 py-1 rounded-full border ${basis === "bundle" ? "bg-cyan-100 border-cyan-400" : ""}`}
            >
              Bundle total
            </button>
          </div>
        </div>
      </form>

      {/* pills row */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        {(["best", "cheapest", "fastest", "flexible"] as SortKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSort(k)}
            className={`px-4 py-2 rounded-full border ${sort === k ? "bg-cyan-100 border-cyan-400" : ""}`}
          >
            {k === "best" ? "Best overall" : k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
        <button className="px-4 py-2 rounded-full border" onClick={() => setSort("best")} type="button">
          Top-3
        </button>
        <button className="px-4 py-2 rounded-full border" onClick={() => setSort("best")} type="button">
          All
        </button>
        {hasSearched && (
          <>
            <span className="px-4 py-2 rounded-full border">Saved: 0</span>
            <label className="flex items-center gap-2 ml-2">
              <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
              <span>Compare</span>
            </label>
          </>
        )}
      </div>

      {/* ======= RESULTS (hidden until searched) ======= */}
      <section className="mt-6">
        {!hasSearched && (
          <p className="text-sm text-gray-600">
            Start by entering Origin, Destination, and dates, then click Search.
          </p>
        )}
        {hasSearched && isLoading && <p className="text-sm">Searching…</p>}
        {hasSearched && !isLoading && results.length === 0 && (
          <p className="text-sm">Showing 0 result(s). Run a search to see flights here.</p>
        )}
        {results.map((r, idx) => (
          <ResultCard
            key={idx}
            data={r}
            compareEnabled={compareMode}
            onBook={() => {
              const q = new URLSearchParams({
                adults: String(payload.adults),
                children: String(payload.children),
                infants: String(payload.infants),
              }).toString();
              window.location.href = `/checkout?${q}`;
            }}
          />
        ))}
      </section>
    </main>
  );
}
