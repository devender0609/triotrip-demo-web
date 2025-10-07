"use client";

import React, { useEffect, useRef, useState } from "react";

type Place = { code: string; name: string; city?: string; country?: string; label: string };

async function getPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal, cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  return (j?.data ?? []).map((p: any) => ({
    code: String(p.code || "").toUpperCase(),
    name: p.name || p.city || "",
    city: p.city || "",
    country: p.country || "",
    label: p.label || `${p.code} — ${p.name}`,
  }));
}

export default function AirportInput({
  id,
  label,
  value = "",
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const [input, setInput] = useState(value);
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setInput(value), [value]);

  useEffect(() => {
    onChange(input);

    const q = input.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(!!q);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const data = await getPlaces(q, ctrl.signal);
        setItems(data.slice(0, 20));
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 250);

    return () => {
      if (debRef.current) {
        clearTimeout(debRef.current);
        debRef.current = null;
      }
    };
  }, [input, onChange]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commit(p: Place) {
    const display = `${p.code} — ${p.name}${p.city && p.city !== p.name ? ` — ${p.city}` : ""}${p.country ? ` — ${p.country}` : ""}`;
    setInput(display);
    setOpen(false);
    onChange(display);
  }

  function clear() {
    setInput("");
    onChange("");
    setItems([]);
    setOpen(false);
  }

  return (
    <div className="w-full" ref={boxRef}>
      <label htmlFor={id} className="form-label mb-1">{label}</label>
      <div className="position-relative">
        <input
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(items.length > 0)}
          autoComplete="off"
          placeholder="Type city or airport"
          className="form-control"
          style={{ paddingRight: 34 }}
          {...(autoFocus ? { autoFocus: true } : {})}
        />
        {input && (
          <button
            type="button"
            aria-label="Clear"
            onClick={clear}
            className="btn btn-light border position-absolute"
            style={{ right: 4, top: 4, height: 30, width: 30, lineHeight: 1 }}
          >
            ×
          </button>
        )}

        {open && (
          <div
            className="border rounded shadow bg-white mt-1"
            style={{ position: "absolute", zIndex: 40, left: 0, right: 0, maxHeight: 280, overflowY: "auto" }}
          >
            {loading && <div className="px-3 py-2 text-muted small">Searching…</div>}
            {!loading && items.length === 0 && <div className="px-3 py-2 text-muted small">No matches</div>}
            {!loading &&
              items.map((p, idx) => (
                <div
                  key={p.code + idx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(p)}
                  className="px-3 py-2 border-top cursor-pointer bg-white text-dark hover:bg-light"
                >
                  <div className="fw-semibold">{p.label}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
