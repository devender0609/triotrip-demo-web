"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/api";

type Suggestion = { code?: string; name: string; city?: string; country?: string; label: string };

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
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<string>("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!term || term.trim().length < 1) {
      setItems([]);
      setDebug("");
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = term.trim();
        // eslint-disable-next-line no-console
        console.log("[AirportInput] searching", {
          origin: typeof window !== "undefined" ? window.location.origin : "(ssr)",
          q,
        });

        const json = await searchPlaces(q);
        const list = Array.isArray(json?.data) ? json.data : [];
        setItems(list);
        setDebug(list.length === 0 ? "No results" : "");
        setOpen(true);
        // eslint-disable-next-line no-console
        console.log("[AirportInput] results", { count: list.length, sample: list.slice(0, 5) });
      } catch (err: any) {
        setItems([]);
        setDebug(err?.message || "Network error");
        setOpen(true);
        // eslint-disable-next-line no-console
        console.error("[AirportInput] fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [term]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => (items.length || debug ? setOpen(true) : undefined)}
      />
      {open && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 44, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, zIndex: 20, maxHeight: 280, overflow: "auto" }}>
          {loading && <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>}
          {!loading && debug && <div style={{ padding: 10, color: "#b91c1c", fontWeight: 700 }}>{debug}</div>}
          {!loading && !debug && items.length === 0 && <div style={{ padding: 10, color: "#64748b" }}>No matches</div>}
          {!loading && !debug && items.map((a) => (
            <div
              key={a.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(a.label); setTerm(a.label); setOpen(false); }}
              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px dashed #e2e8f0" }}
            >
              {a.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
