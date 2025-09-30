"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  code?: string;   // IATA (may be missing for some city-only results)
  name: string;
  city?: string;
  country?: string;
  label: string;   // what we display
};

async function fetchPlaces(term: string): Promise<{ items: Suggestion[]; debug: string }> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(term)}`, { cache: "no-store" });
  const j = await res.json().catch(() => ({} as any));
  const items: Suggestion[] = Array.isArray(j?.data) ? j.data : [];

  // eslint-disable-next-line no-console
  console.log("[AirportField] term=%s res.ok=%s items=%o", term, res.ok, items.slice(0, 5));

  const debug = !res.ok
    ? `API ${res.status} ${res.statusText || ""} ${j?.error ? "- " + j.error : ""}`.trim()
    : items.length === 0
      ? `No results`
      : "";

  return { items, debug };
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
  const [debug, setDebug] = useState<string>("");
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

  // Debounced search (trigger on 1+ chars)
  useEffect(() => {
    onTextChange?.(text);

    if (!text || text.trim().length < 1) {
      setItems([]);
      setDebug("");
      setOpen(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { items, debug } = await fetchPlaces(text.trim());
        setItems(items);
        setDebug(debug);
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
        onFocus={() => (items.length || debug ? setOpen(true) : undefined)}
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
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Searching…</div>
          )}

          {!loading && debug && (
            <div style={{ padding: 10, color: "#b45309", fontWeight: 700 }}>
              {debug}
            </div>
          )}

          {!loading && !debug && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>
              No matches
            </div>
          )}

          {!loading && !debug &&
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
