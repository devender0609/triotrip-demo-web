"use client";

import { useEffect, useRef, useState } from "react";

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

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = term.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      inFlight.current?.abort();
      inFlight.current = null;
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setLoading(true);
      const myReq = ++reqId.current;

      try {
        console.log("[AirportInput] searching:", q);
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.error("[AirportInput] /api/places not ok:", res.status, t?.slice(0, 200));
          setItems([]);
          setOpen(true);
          return;
        }
        const json = await res.json().catch(() => ({ data: [] }));
        const list: Airport[] = Array.isArray(json?.data) ? json.data : [];
        if (myReq === reqId.current) {
          console.log("[AirportInput] results:", { count: list.length, sample: list.slice(0, 5) });
          setItems(list);
          setOpen(true);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          console.debug("[AirportInput] aborted (newer query)");
        } else {
          console.error("[AirportInput] search failed:", e?.message || String(e));
          setItems([]);
          setOpen(true);
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 250);

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
            top: "100%", left: 0, right: 0, zIndex: 30,
            maxHeight: 300, overflow: "auto", background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 6, marginTop: 4,
          }}
        >
          {loading && <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>}
          {!loading && items.length === 0 && <div style={{ padding: 10, color: "#64748b" }}>No matches</div>}
          {!loading && items.map((s, i) => (
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