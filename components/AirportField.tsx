"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Place = { code: string; name: string; city?: string; country?: string; label: string };

export default function AirportField(props: {
  label: string;
  code: string;
  initialDisplay: string;
  onTextChange: (v: string) => void;
  onChangeCode: (code: string, display: string) => void;
  autoFocus?: boolean;
}) {
  const { label, code, initialDisplay, onTextChange, onChangeCode, autoFocus } = props;

  const [term, setTerm] = useState(initialDisplay || code || "");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const lastIssued = useRef(0);

  useEffect(() => setTerm(initialDisplay || code || ""), [initialDisplay, code]);
  useEffect(() => onTextChange?.(term), [term, onTextChange]);

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
        const res = await fetch(url, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        const items: Place[] = Array.isArray(j?.data) ? j.data : [];
        if (id === lastIssued.current) {
          setOptions(items);
          setOpen(true);
        }
      } catch {
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

  const onPick = (p: Place) => {
    onChangeCode?.(p.code, p.label);
    setTerm(p.label);
    setOpen(false);
  };

  const placeholder = useMemo(() => (label ? label : "Type city or airport"), [label]);

  return (
    <div className="relative w-full">
      <input
        className="w-full h-11 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-[15px]"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading && <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>}

          {!loading && options.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {options.map((p) => (
                <li
                  key={`${p.code}-${p.label}`}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => onPick(p)}
                >
                  <div className="font-medium">{p.label}</div>
                </li>
              ))}
            </ul>
          )}

          {!loading && options.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
