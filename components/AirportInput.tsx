"use client";

import { useEffect, useRef, useState } from "react";

type Airport = { code: string; name: string; city: string; country?: string; label: string };

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
  const timer = useRef<any>();

  // keep internal term in sync if parent changes value
  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!term || term.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `/api/places?q=${encodeURIComponent(term)}`;
        console.log("[AirportInput] requesting", url);
        const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const payload = await r.json();
        const list: Airport[] = Array.isArray(payload?.data) ? payload.data : payload;
        setItems(Array.isArray(list) ? list : []);
        console.log("[AirportInput] got", list.length, "items");
        setOpen(true);
      } catch (e) {
        console.error("[AirportInput] fetch failed", e);
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer.current);
  }, [term]);

  function pick(s: Airport) {
    setTerm(s.label || `${s.code} — ${s.name}`);
    setOpen(false);
    onChange(s.code);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="form-control"
      />
      {open && (loading || items.length > 0) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 280,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            marginTop: 4,
          }}
        >
          {loading && <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>}
          {!loading &&
            items.map((s) => (
              <div
                key={`${s.code}-${s.name}`}
                className="ai-row"
                onClick={() => pick(s)}
                style={{ padding: "10px 12px", cursor: "pointer" }}
              >
                <strong>{s.code}</strong> — {s.name}{" "}
                <span style={{ color: "#64748b" }}>
                  {s.city ? `(${s.city})` : ""}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
