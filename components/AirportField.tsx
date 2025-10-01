"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { searchPlaces } from "@/lib/api";

type Place = {
  code?: string;
  name: string;
  city?: string;
  country?: string;
  label: string;
};

export default function AirportField(props: {
  id?: string;
  label: string;
  placeholder?: string;
  /** legacy props used by app/page.tsx */
  code?: string;
  initialDisplay?: string;
  onTextChange?: (display: string) => void;
  onChangeCode?: (code: string, display: string) => void;
  autoFocus?: boolean;
}) {
  const {
    id,
    label,
    placeholder = "Type city or airport",
    code,
    initialDisplay = "",
    onTextChange,
    onChangeCode,
    autoFocus,
  } = props;

  const [term, setTerm] = useState(initialDisplay);
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [everLoaded, setEverLoaded] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);
  const cache = useMemo(() => new Map<string, Place[]>(), []);

  useEffect(() => setTerm(initialDisplay), [initialDisplay]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // debounced search
  useEffect(() => {
    const q = term.trim();
    setActive(-1);

    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (cache.has(q)) {
      setItems(cache.get(q)!);
      setOpen(true);
      setLoading(false);
      setEverLoaded(true);
      return;
    }

    const timer = setTimeout(async () => {
      ctrlRef.current?.abort();
      const ac = new AbortController();
      ctrlRef.current = ac;

      setLoading(true);
      const my = ++reqId.current;

      try {
        console.log("[AirportField] searching:", q);
        const json = await searchPlaces(q); // always same-origin
        const list: Place[] = Array.isArray(json?.data) ? json.data : [];
        cache.set(q, list);
        if (my === reqId.current) {
          console.log("[AirportField] results:", { count: list.length, sample: list.slice(0, 5) });
          setItems(list);
          setOpen(true);
          setEverLoaded(true);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.warn("[AirportField] search failed:", e?.message || String(e));
          if (my === reqId.current) {
            setItems([]);
            setOpen(true);
            setEverLoaded(true);
          }
        }
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [term, cache]);

  function choose(it: Place) {
    const display = it.label || (it.code ? `${it.code} — ${it.name}` : it.name);
    setTerm(display);
    onTextChange?.(display);
    if (it.code) onChangeCode?.(it.code, display);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showNo = everLoaded && !loading && term.trim().length >= 2 && items.length === 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <input
        id={id}
        value={term}
        onChange={(e) => {
          const v = e.target.value;
          setTerm(v);
          onTextChange?.(v);
        }}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                   focus:border-blue-500 focus:ring-blue-500"
        autoComplete="off"
        autoFocus={props.autoFocus}
      />

      {open && (
        <div className="absolute left-0 right-0 mt-1 max-h-80 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg z-50">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>}

          {!loading && items.length > 0 && (
            <ul className="py-1">
              {items.slice(0, 12).map((it, idx) => (
                <li
                  key={`${it.code ?? it.label}-${idx}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(it)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${active === idx ? "bg-blue-50" : ""}`}
                >
                  <div className="font-medium">
                    {it.code ? `${it.code} — ` : ""}
                    {it.name}
                  </div>
                  {(it.city || it.country) && (
                    <div className="text-gray-600">{[it.city, it.country].filter(Boolean).join(", ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {showNo && <div className="px-3 py-2 text-sm text-gray-500">No matches</div>}
        </div>
      )}
    </div>
  );
}
