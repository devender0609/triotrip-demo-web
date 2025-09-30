"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  code: string;   // IATA
  name: string;
  city: string;
  country: string;
  label: string;  // e.g. "AUS — Austin-Bergstrom International (Austin, US)"
};

async function fetchPlaces(term: string): Promise<Suggestion[]> {
  const r = await fetch(`/api/places?q=${encodeURIComponent(term)}`, {
    cache: "no-store",
  });
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
    return { code, name, city, country, label };
  });
}

export default function AirportField(props: {
  label?: string;
  code?: string;
  initialDisplay?: string;
  onChangeCode?: (code: string, display: string) => void;
  onTextChange?: (display: string) => void;
  placeholder?: string;
}) {
  const { initialDisplay, onChangeCode, onTextChange, placeholder = "Type city or airport" } =
    props;

  const [text, setText] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // fetch suggestions with debounce
  useEffect(() => {
    onTextChange?.(text);

    if (!text || text.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await fetchPlaces(text);
        setItems(list);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, onTextChange]);

  function pick(s: Suggestion) {
    const display =
      `${s.code ? `${s.code} — ` : ""}${s.name}` +
      (s.city || s.country ? ` (${[s.city, s.country].filter(Boolean).join(", ")})` : "");
    setText(display);
    setOpen(false);
    onChangeCode?.(s.code, s.label || display);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => (items.length ? setOpen(true) : undefined)}
        placeholder={placeholder}
        aria-autocomplete="list"
        autoComplete="off"
        style={{
          height: 42,
          padding: "0 10px",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          width: "100%",
        }}
      />
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: 44,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(2,6,23,.08)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>No matches</div>
          )}
          {!loading &&
            items.map((s) => (
              <button
                key={`${s.code}-${s.name}-${s.city}-${s.country}`}
                type="button"
                onClick={() => pick(s)}
                role="option"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "0",
                  borderBottom: "1px dashed #e2e8f0",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {s.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
