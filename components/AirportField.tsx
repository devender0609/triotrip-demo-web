"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  code: string;   // IATA
  name: string;
  city: string;
  country: string;
  label: string;  // e.g. "AUS — Austin-Bergstrom International (Austin, US)"
};

export default function AirportField(props: {
  label?: string;
  code?: string;
  initialDisplay?: string;
  onChangeCode?: (code: string, display: string) => void;
  onTextChange?: (display: string) => void;
  placeholder?: string;
}) {
  const { code, initialDisplay, onChangeCode, onTextChange, placeholder = "Type city or airport" } =
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
    if (onTextChange) onTextChange(text);

    if (!text || text.trim().length < 2) {
      setItems([]);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/airports?q=${encodeURIComponent(text)}`, { cache: "no-store" });
        const list: Suggestion[] = await r.json();
        setItems(Array.isArray(list) ? list : []);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [text, onTextChange]);

  function pick(s: Suggestion) {
    setText(`${s.code} — ${s.name}${s.city ? ` (${s.city}` : ""}${s.country ? `, ${s.country}` : ""}${s.city ? ")" : ""}`);
    setOpen(false);
    if (onChangeCode) onChangeCode(s.code, s.label || s.code);
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
        style={{ height: 42, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, width: "100%" }}
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
          {loading && <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Loading…</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>No matches</div>
          )}
          {!loading &&
            items.map((s) => (
              <button
                key={`${s.code}-${s.name}`}
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
                {s.label || `${s.code} — ${s.name}`}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
