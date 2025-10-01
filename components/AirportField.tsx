// components/AirportField.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { code: string; name: string; city?: string; country?: string; label: string };

export default function AirportField(props: {
  id: string;
  label: string;
  value?: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const { id, label, value = "", onChange, autoFocus } = props;
  const [term, setTerm] = useState(value);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const acRef = useRef<AbortController | null>(null);

  // debounced search
  useEffect(() => {
    if (!term || term.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    setOpen(true);

    // cancel previous
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    const t = setTimeout(async () => {
      try {
        const url = `/api/places?q=${encodeURIComponent(term.trim())}`;
        // helpful log in case we need to debug on prod
        console.log("[AirportField] /api/places -> %s", url);
        const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const arr: Item[] = Array.isArray(j?.data) ? j.data : [];
        setItems(arr);
        setOpen(true);
        setLoading(false);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("[AirportField] search failed:", err);
        }
        setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [term]);

  // pick one
  const pick = (it: Item) => {
    onChange(it.code);
    setTerm(`${it.code} — ${it.name}${it.city ? ` — ${it.city}` : ""}`);
    setOpen(false);
  };

  // Render
  return (
    <div className="flex-1 min-w-[260px]">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => term.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Type city or airport"
          autoFocus={autoFocus}
          className="w-full rounded-md border px-3 py-2 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white shadow-lg">
            {loading && (
              <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            )}
            {items.map((it) => (
              <button
                key={`${it.code}-${it.name}`}
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it)}
                aria-label={it.label}
              >
                <div className="shrink-0 font-mono text-sm font-semibold">{it.code}</div>
                <div className="grow">
                  <div className="text-sm">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    {it.city || "-"}{it.country ? `, ${it.country}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
