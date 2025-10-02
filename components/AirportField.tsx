"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Place = { code: string; name: string; city?: string; country?: string; label: string };

type LegacyProps = {
  label: string;
  code: string;                               // IATA code, e.g., "BOS"
  initialDisplay: string;                     // visible text like "BOS — Logan …"
  onTextChange: (v: string) => void;          // called on each keystroke
  onChangeCode: (code: string, display: string) => void; // called when user picks an option
  autoFocus?: boolean;
  id?: string;
};

type SimpleProps = {
  id: string;
  label: string;
  value?: string;                             // optional visible text
  onChange: (nextCode: string) => void;       // called when user picks an option
  autoFocus?: boolean;
};

type Props = LegacyProps | SimpleProps;

function isLegacy(p: Props): p is LegacyProps {
  return (p as LegacyProps).onChangeCode !== undefined;
}

export default function AirportField(props: Props) {
  const label = props.label;
  const autoFocus = props.autoFocus;

  // Determine initial visible text
  const initialTerm = isLegacy(props)
    ? (props.initialDisplay || props.code || "")
    : (props.value || "");

  const [term, setTerm] = useState(initialTerm);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const lastIssued = useRef(0);

  // Keep input text in sync with upstream changes (either prop style)
  useEffect(() => {
    if (isLegacy(props)) {
      setTerm(props.initialDisplay || props.code || "");
    } else {
      setTerm(props.value || "");
    }
  }, [isLegacy(props) ? props.initialDisplay : (props as SimpleProps).value,
      isLegacy(props) ? props.code : undefined]);

  // For legacy usage: bubble keystrokes back up
  useEffect(() => {
    if (isLegacy(props) && props.onTextChange) {
      props.onTextChange(term);
    }
  }, [term, props]);

  // Debounced search to same-origin /api/places
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
    const display = p.label;
    // Legacy: inform parent of both code + display
    if (isLegacy(props)) {
      props.onChangeCode?.(p.code, display);
    } else {
      // Simple: send chosen code only
      (props as SimpleProps).onChange?.(p.code);
    }
    setTerm(display);
    setOpen(false);
  };

  const placeholder = useMemo(
    () => (label ? label : "Type city or airport"),
    [label]
  );

  return (
    <div className="relative w-full">
      <input
        id={("id" in props && props.id) ? props.id : undefined}
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
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          )}

          {!loading && hasOptions && (
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

          {!loading && !hasOptions && (
            <div className="px-4 py-3 text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
