"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/api";

type Airport = { code?: string; name: string; city?: string; country?: string; label: string };

export default function AirportInput({
  value,
  onChange,
  placeholder = "Type city or airport",
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState(value);
  const [items, setItems] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        console.log("[AirportInput] searching:", q);
        const res = await searchPlaces(q);
        const list: Airport[] = Array.isArray(res?.data) ? res.data : [];
        console.log("[AirportInput] results:", { count: list.length, sample: list.slice(0, 3) });
        setItems(list);
        setOpen(true);
      } catch (e) {
        console.error("[AirportInput] search failed:", e);
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => timer.current && clearTimeout(timer.current);
  }, [term]);

  function pick(s: Airport) {
    const display = s.label || (s.code ? `${s.code} — ${s.name}` : s.name);
    setTerm(display);
    setOpen(false);
    if (s.code) onChange(s.code);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="form-control"
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 300,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            marginTop: 4,
          }}
        >
          {loading && <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>}
          {!loading && items.length === 0 && <div style={{ padding: 10, color: "#64748b" }}>No matches</div>}
          {!loading &&
            items.map((s, i) => (
              <div
                key={`${s.code || "nocode"}-${s.name}-${i}`}
                onClick={() => pick(s)}
                style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px dashed #e2e8f0" }}
              >
                <strong>{s.label || (s.code ? `${s.code} — ${s.name}` : s.name)}</strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
