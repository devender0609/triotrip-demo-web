"use client";

import React from "react";

type Item = {
  type: "CITY" | "AIRPORT" | string;
  iataCode?: string;
  name?: string;         // full airport or city display name
  cityName?: string;     // city display name (if AIRPORT, the city it's in)
  countryName?: string;
  cityCode?: string;     // <-- used as placeId for hotels (PAR, LON, NYC, etc.)
};

export default function AirportField({
  label,
  code,
  initialDisplay,
  onChangeCode,  // (code, display, placeId?)
  onTextChange,
  apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000",
}: {
  label: string;
  code?: string;
  initialDisplay?: string;
  onChangeCode?: (code: string, display: string, placeId?: string) => void;
  onTextChange?: (display: string) => void;
  apiBase?: string;
}) {
  const [text, setText] = React.useState<string>(initialDisplay || code || "");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<any>();

  React.useEffect(() => {
    setText(initialDisplay || code || "");
  }, [initialDisplay, code]);

  // close on outside click
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function sanitize(s: any): string {
    const t = s == null ? "" : String(s).trim();
    if (!t) return "";
    const low = t.toLowerCase();
    return low === "undefined" || low === "null" ? "" : t;
  }

  function coerceItems(raw: any): Item[] {
    const arr = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    return arr.map((r: any): Item => {
      // try a bunch of common shapes
      const type = sanitize(r.type || r.category || "");
      const iataCode =
        sanitize(r.iataCode || r.iata || r.code || r.airportCode || r.id) || "";
      const name = sanitize(
        r.name ||
          r.airportName ||
          r.presentation?.suggestionTitle ||
          r.detailedName
      );
      const cityName = sanitize(
        r.cityName ||
          r.city ||
          r.address?.cityName ||
          r.address?.city ||
          r.presentation?.title
      );
      const countryName = sanitize(
        r.countryName || r.address?.countryName || r.address?.countryCode
      );
      const cityCode = sanitize(r.cityCode || r.navigation?.relevantFlightParams?.city);
      return { type, iataCode, name, cityName, countryName, cityCode };
    });
  }

  function formatDisplay(it: Item): string {
    const main = sanitize(it.cityName) || sanitize(it.name) || sanitize(it.iataCode) || "Unknown";
    const code = sanitize(it.iataCode);
    const country = sanitize(it.countryName);
    const mid = code ? ` (${code})` : "";
    const tail = country ? `, ${country}` : "";
    return `${main}${mid}${tail}`;
  }

  function fetchItems(q: string) {
    const qq = sanitize(q);
    if (qq.length < 1) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetch(`${apiBase}/locations?q=${encodeURIComponent(qq)}`)
      .then((r) => r.json())
      .then((j) => {
        const next = coerceItems(j);
        setItems(next);
        setActive(0);
        setOpen(true);
      })
      .catch(() => {
        setItems([]);
        setOpen(true);
      })
      .finally(() => setLoading(false));
  }

  function onInputChange(v: string) {
    setText(v);
    onTextChange?.(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchItems(v), 160);
  }

  function onSelect(it: Item) {
    const display = formatDisplay(it);
    const code = sanitize(it.iataCode) || ""; // always safe string
    // Prefer cityCode for hotel searches if present (e.g., PAR), otherwise undefined
    const placeId = sanitize(it.cityCode) || undefined;

    setText(display);
    onTextChange?.(display);
    onChangeCode?.(code, display, placeId);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
      scrollActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
      scrollActive(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelect(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function scrollActive(dir: number) {
    const el = listRef.current?.querySelector<HTMLDivElement>(`[data-idx="${active + dir}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }

  const hasValue = Boolean(sanitize(code) || sanitize(text));

  return (
    <div className="af" ref={boxRef}>
      <label className="af-label">{label}</label>
      <div className={`af-inputwrap ${open ? "open" : ""}`}>
        <input
          className="af-input"
          placeholder="Type city or airport"
          value={text}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => text && setOpen(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="af-listbox"
        />
        {hasValue && (
          <button
            type="button"
            className="af-clear"
            aria-label="Clear"
            onClick={() => {
              setText("");
              onTextChange?.("");
              onChangeCode?.("", "", undefined);
              setItems([]);
              setOpen(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="af-pop" role="listbox" id="af-listbox" ref={listRef}>
          {loading && <div className="af-row muted">Searching…</div>}
          {!loading && items.length === 0 && <div className="af-row muted">No matches</div>}
          {!loading &&
            items.map((it, i) => (
              <div
                key={`${sanitize(it.iataCode) || it.name || i}-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                className={`af-row ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(it)}
              >
                <div className="af-row-main">
                  <span className="iata">{sanitize(it.iataCode) || "—"}</span>
                  <span className="city">{highlight(text, sanitize(it.cityName) || sanitize(it.name) || "Unknown")}</span>
                </div>
                <div className="af-row-sub">
                  {(it.type === "CITY" || it.type === "city") ? "City" : "Airport"}
                  {sanitize(it.name) ? ` • ${it.name}` : ""}
                  {sanitize(it.countryName) ? ` • ${it.countryName}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      <style jsx>{`
        .af { position: relative; min-width: 260px; }
        .af-label { display:block; font-weight:800; margin-bottom:6px; color:#0f172a; }
        .af-inputwrap { position: relative; }
        .af-input {
          width:100%; height:44px; border-radius:12px; padding:0 38px 0 12px;
          border:1px solid #e2e8f0; outline:none; background:#fff; color:#0f172a;
        }
        .af-input:focus { border-color:#38bdf8; box-shadow:0 0 0 3px rgba(56,189,248,.25); }
        .af-clear {
          position:absolute; right:6px; top:6px; width:32px; height:32px; border-radius:999px;
          border:none; background:#f1f5f9; color:#64748b; font-size:18px; cursor:pointer;
        }
        .af-clear:hover { background:#e2e8f0; }

        .af-pop {
          position:absolute; z-index:60; top:calc(100% + 6px); left:0; right:0;
          background:#fff; color:#0f172a; border:1px solid #e2e8f0; border-radius:12px;
          box-shadow:0 10px 24px rgba(15,23,42,.12); max-height:320px; overflow:auto;
        }
        .af-row { padding:10px 12px; cursor:pointer; display:grid; gap:2px; }
        .af-row:hover, .af-row.active { background:#f0f9ff; }
        .af-row-main { display:flex; gap:8px; align-items:baseline; font-weight:900; }
        .af-row-sub { font-size:12px; color:#475569; }
        .muted { color:#64748b; font-style:italic; }
        .iata {
          color:#0369a1; background:#e0f2fe; padding:2px 6px; border-radius:8px;
          font-size:12px; letter-spacing:.4px;
        }
        .city :global(mark) {
          background: linear-gradient(90deg,#fff7ed,#ffedd5);
          border-radius:3px; padding:0 2px;
        }
      `}</style>
    </div>
  );
}

/** Highlight helper (case-insensitive) */
function highlight(q: string, text: string) {
  if (!q) return <>{text}</>;
  const qi = q.toLowerCase();
  const ti = text.toLowerCase();
  const idx = ti.indexOf(qi);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
