"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Place = { code: string; name: string; city?: string; country?: string; label: string };

export default function AirportField(props: {
  label: string;
  code: string;                         // controlled IATA code (BOS)
  initialDisplay: string;               // starting display text (eg "BOS — ...")
  onTextChange: (v: string) => void;    // update the display text in parent
  onChangeCode: (code: string, display: string) => void; // commit selection
  autoFocus?: boolean;
}) {
  const { label, code, initialDisplay, onTextChange, onChangeCode, autoFocus } = props;

  const [term, setTerm] = useState(initialDisplay || code || "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const lastIssued = useRef(0);

  // keep parent display text in sync when initialDisplay changes externally
  useEffect(() => {
    setTerm(initialDisplay || code || "");
  }, [initialDisplay, code]);

  // Notify parent on each keystroke so its state reflects what user sees
  useEffect(() => {
    onTextChange?.(term);
  }, [term, onTextChange]);

  // Debounced search to our own API
  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    const id = ++lastIssued.current;
    const handle = setTimeout(async () => {
      try {
        const url = `/api/places?q=${encodeURIComponent(t)}`;
        console.log("[AirportField] /api/places -> %s", url);

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const items: Place[] = Array.isArray(j?.data) ? j.data : [];
        if (id === lastIssued.current) {
          setOptions(items);
          setOpen(true);
          console.log("[AirportField] results:", { count: items.length, sample: items.slice(0, 1) });
        }
      } catch (e) {
        if (id === lastIssued.current) {
          setOptions([]);
          setOpen(true);
        }
      } finally {
        if (id === lastIssued.current) setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [term]);

  const hasOptions = options.length > 0;

  const onPick = (p: Place) => {
    onChangeCode?.(p.code, p.label);
    setTerm(p.label);
    setOpen(false);
  };

  const placeholder = useMemo(() => (label ? label : "Type city or airport"), [label]);

  return (
    <div className="relative">
      <input
        className="form-control"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded border bg-white shadow"
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
          )}

          {!loading && hasOptions && (
            <ul className="divide-y">
              {options.map((p) => (
                <li
                  key={`${p.code}-${p.label}`}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => onPick(p)}
                >
                  <div className="font-medium">{p.label}</div>
                </li>
              ))}
            </ul>
          )}

          {!loading && !hasOptions && (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
