"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  code?: string;   // IATA (may be missing for some city-only results)
  name: string;
  city?: string;
  country?: string;
  label: string;   // what we display
};

function toSuggestion(p: any): Suggestion | null {
  // Duffel (beta) response commonly has: iata_code, name, city_name, country_name
  const code = p?.iata_code || "";
  const name = p?.name || p?.airport_name || p?.city_name || "";
  const city = p?.city_name || p?.city?.name || p?.municipality || "";
  const country = p?.country_name || p?.country?.name || p?.country || "";

  if (!name) return null;

  const label =
    (code ? `${code} — ` : "") +
    name +
    (city || country ? ` (${[city, country].filter(Boolean).join(", ")})` : "");

  return { code: code || undefined, name, city: city || undefined, country: country || undefined, label };
}

async function fetchPlaces(term: string): Promise<{ items: Suggestion[]; error?: string }> {
  try {
    const res = await fetch(`/api/places?q=${encodeURIComponent(term)}`, { cache: "no-store" });
    const text = await res.text(); // read raw for better diagnostics
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }

    // Duffel returns { data: [...] }
    const raw = Array.isArray(json?.data) ? json.data : [];
    const mapped = raw.map(toSuggestion).filter(Boolean) as Suggestion[];

    // Deduplicate by label
    const seen = new Set<string>();
    const items = mapped.filter(s => {
      const k = s.label;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Debug in the browser console so we can see what the API actually returns
    // (Remove these logs after you confirm it works)
    // eslint-disable-next-line no-console
    console.log("[AirportField] /api/places?q=%s -> %o items", term, items.length, { rawCount: raw.length, sample: items.slice(0, 5) });

    if (!res.ok) {
      return { items, error: `API ${res.status}: ${json?.error || res.statusText || "Unknown error"}` };
    }
    return { items };
  } catch (e: any) {
    return { items: [], error: e?.message || String(e) };
  }
}

export default function AirportField(props: {
  label?: string;
  code?: string;
  initialDisplay?: string;
  onChangeCode?: (code: string | undefined, display: string) => void;
  onTextChange?: (display: string) => void;
  placeholder?: string;
}) {
  const {
    initialDisplay,
    onChangeCode,
    onTextChange,
    placeholder = "Type city or airport",
  } = props;

  const [text, setText] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [apiError, setApiError] = useState<string | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close popover on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced search
  useEffect(() => {
    onTextChange?.(text);

    if (!text || text.trim().length < 2) {
      setItems([]);
      setApiError(undefined);
      setOpen(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      setApiError(undefined);
      try {
        const { items, error } = await fetchPlaces(text.trim());
        setItems(items);
        if (error) setApiError(error);
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
    const display = s.label;
    setText(display);
    setOpen(false);
    onChangeCode?.(s.code, display);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => (items.length || apiError ? setOpen(true) : undefined)}
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
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Searching…</div>
          )}

          {!loading && apiError && (
            <div style={{ padding: 10, color: "#b91c1c", fontWeight: 700 }}>
              API error: {apiError}
            </div>
          )}

          {!loading && !apiError && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>
              No matches
            </div>
          )}

          {!loading && !apiError &&
            items.map((s) => (
              <button
                key={s.label}
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
