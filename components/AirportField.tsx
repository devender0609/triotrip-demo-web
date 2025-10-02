"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** Minimal in-memory list to ensure suggestions work without any API.
 *  Add more as you like; search matches code, city, airport name.
 */
const AIRPORTS = [
  { code: "AUS", name: "Austin–Bergstrom International", city: "Austin", country: "US" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas–Fort Worth", country: "US" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "US" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", country: "US" },
  { code: "MDW", name: "Chicago Midway International", city: "Chicago", country: "US" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "US" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "US" },
  { code: "JFK", name: "John F. Kennedy International", city: "New York", country: "US" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", country: "US" },
  { code: "BOS", name: "Logan International", city: "Boston", country: "US" },
  { code: "SEA", name: "Seattle–Tacoma International", city: "Seattle", country: "US" },
  { code: "MIA", name: "Miami International", city: "Miami", country: "US" },
  { code: "ATL", name: "Hartsfield–Jackson Atlanta", city: "Atlanta", country: "US" },
];

type Props = {
  id: string;
  label: string;
  /** current IATA code from parent */
  code: string;
  /** initial text the user sees (e.g. label for selected code) */
  initialDisplay: string;
  /** live typing back up to parent (used by your page state) */
  onTextChange: (next: string) => void;
  /** when a place is chosen, send back the IATA code & display label */
  onChangeCode: (code: string, display: string) => void;
  autoFocus?: boolean;
};

type Place = { code: string; name: string; city?: string; country?: string; label: string };

function norm(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toPlaceRows(list: typeof AIRPORTS): Place[] {
  return list.map((p) => ({
    code: p.code,
    name: p.name,
    city: p.city || "",
    country: p.country || "",
    label: `${p.code} — ${p.city ? p.city + " — " : ""}${p.name}`,
  }));
}

export default function AirportField({
  id,
  label,
  code,
  initialDisplay,
  onTextChange,
  onChangeCode,
  autoFocus,
}: Props) {
  const all = useMemo(() => toPlaceRows(AIRPORTS), []);
  const [value, setValue] = useState<string>(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep local display in sync if parent changes its initialDisplay
  useEffect(() => {
    if (initialDisplay && initialDisplay !== value) setValue(initialDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDisplay]);

  // Derived matches
  const matches = useMemo(() => {
    const q = norm(value.trim());
    if (!q) return all.slice(0, 8);
    const res = all
      .map((p) => ({ p, score: scoreMatch(p, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      .slice(0, 8);
    return res;
  }, [value, all]);

  // Click outside closes the list
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
      setActiveIdx(-1);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function scoreMatch(p: Place, q: string): number {
    const s1 = norm(p.code);
    const s2 = norm(p.city || "");
    const s3 = norm(p.name || "");
    let sc = 0;
    if (s1.startsWith(q)) sc += 6;
    if (s1.includes(q)) sc += 3;
    if (s2.startsWith(q)) sc += 4;
    if (s2.includes(q)) sc += 2;
    if (s3.startsWith(q)) sc += 3;
    if (s3.includes(q)) sc += 1;
    return sc;
  }

  function pick(place: Place) {
    setValue(place.label);
    onTextChange(place.label);
    onChangeCode(place.code, place.label);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min((i < 0 ? -1 : i) + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && activeIdx >= 0 && matches[activeIdx]) {
        e.preventDefault();
        pick(matches[activeIdx]);
      } else if (!open) {
        // Allow typing 3-letter code then Enter to commit
        const maybe = all.find((p) => p.code.toUpperCase() === value.trim().toUpperCase());
        if (maybe) pick(maybe);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div className="af-wrap" ref={wrapRef}>
      {label ? <label htmlFor={id} className="af-label">{label}</label> : null}

      <input
        id={id}
        ref={inputRef}
        className="af-input"
        type="text"
        value={value}
        placeholder="City, airport or code"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setValue(e.target.value);
          onTextChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="af-list" role="listbox" aria-labelledby={id}>
          {matches.length === 0 ? (
            <div className="af-item af-empty" role="option" aria-disabled="true">
              No matches
            </div>
          ) : (
            matches.map((p, idx) => (
              <div
                key={p.code + idx}
                role="option"
                aria-selected={idx === activeIdx}
                className={`af-item ${idx === activeIdx ? "is-active" : ""}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(-1)}
                onMouseDown={(e) => {
                  // prevent input blur before we handle click
                  e.preventDefault();
                  pick(p);
                }}
              >
                <div className="af-code">{p.code}</div>
                <div className="af-info">
                  <div className="af-line1">{p.city ? `${p.city} — ${p.name}` : p.name}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style jsx>{`
        /* Wrapper uses no border to satisfy 'remove the box lines' */
        .af-wrap { position: relative; }
        .af-label { font-weight: 800; color: #334155; display: block; margin-bottom: 6px; }

        /* Match height/padding of your other inputs, but NO border/outline box */
        .af-input {
          height: 42px;
          padding: 0 10px;
          border: none;               /* no box lines */
          outline: none;
          border-radius: 10px;        /* still matches rounded look */
          background: #fff;
          width: 100%;
          box-shadow: none;           /* fully borderless */
        }

        /* Suggestion list */
        .af-list {
          position: absolute;
          z-index: 50;                /* stay above form elements */
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 8px 28px rgba(2,6,23,.15);
          max-height: 280px;
          overflow: auto;
        }
        .af-item {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 700;
          color: #334155;
        }
        .af-item + .af-item { border-top: 1px solid #f1f5f9; }
        .af-item.is-active { background: #f0f9ff; }
        .af-item.af-empty {
          grid-template-columns: 1fr;
          cursor: default;
          color: #64748b;
        }
        .af-code { font-weight: 900; color: #0f172a; }
        .af-line1 { font-weight: 800; color: #334155; }
      `}</style>
    </div>
  );
}
