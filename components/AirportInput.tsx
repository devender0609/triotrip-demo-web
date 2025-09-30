"use client";

import { useEffect, useRef, useState } from "react";

type Airport = { code: string; name: string; city: string; country: string; label: string };

async function fetchPlaces(term: string): Promise<Airport[]> {
  const r = await fetch(`/api/places?q=${encodeURIComponent(term)}`, { cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json();
  const items = Array.isArray(j?.data) ? j.data : [];

  return items.map((p: any) => {
    const code = p.iata_code || "";
    const name = p.name || p.airport_name || p.city_name || "";
    const city = p.city_name || p.city?.name || p.municipality || "";
    const country = p.country_name || p.country?.name || p.country || "";
    const label =
      (code ? `${code} — ` : "") +
      name +
      (city || country ? ` (${[city, country].filter(Boolean).join(", ")})` : "");
    return { code, name, city, country, label } as Airport;
  });
}

async function getSuggestions(term: string): Promise<Airport[]> {
  // Keep your existing endpoint if present; otherwise the Duffel proxy handles it
  try {
    const r = await fetch(`/api/airports?q=${encodeURIComponent(term)}`, { cache: "no-store" });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch { /* ignore */ }
  return fetchPlaces(term);
}

export default function AirportInput({
  value,
  onChange,
  placeholder = "Type city or airport",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState(value);
  const [items, setItems] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep internal term in sync if parent changes value
  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!term || term.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await getSuggestions(term);
        setItems(results);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [term]);

  return (
    <div className="ai-wrap">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="ai-pop">
          {loading && <div className="ai-row muted">Searching…</div>}
          {!loading && items.length === 0 && <div className="ai-row muted">No matches</div>}
          {!loading &&
            items.map((a) => (
              <div
                key={`${a.code}-${a.label}`}
                className="ai-row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(a.label);
                  setTerm(a.label);
                  setOpen(false);
                }}
              >
                {a.label}
              </div>
            ))}
        </div>
      )}
      <style jsx>{`
        .ai-wrap { position: relative; }
        input { width: 100%; height: 40px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; }
        .ai-pop { position: absolute; left: 0; right: 0; top: 44px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.08); z-index: 20; max-height: 280px; overflow: auto; }
        .ai-row { padding: 10px 12px; cursor: pointer; }
        .ai-row:hover { background: #f8fafc; }
        .ai-row.muted { color: #64748b; cursor: default; }
      `}</style>
    </div>
  );
}
