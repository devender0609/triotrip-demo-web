"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  // visible text in the input
  const [term, setTerm] = useState(value);
  // suggestions
  const [items, setItems] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<number>(-1);

  // debounce + cancel in-flight
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  // keep input in sync if parent changes value
  useEffect(() => setTerm(value), [value]);

  // search as user types (debounced)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = term.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      setActive(-1);
      inFlight.current?.abort();
      inFlight.current = null;
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      // cancel previous
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setLoading(true);
      const myReq = ++reqId.current;

      try {
        const url = `/api/places?q=${encodeURIComponent(q)}`;
        console.log("[AirportInput] searching:", q, "→", url);

        const res = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("[AirportInput] /api/places not ok:", res.status, t?.slice(0, 200));
          if (myReq === reqId.current) {
            setItems([]);
            setOpen(true);
            setActive(-1);
          }
          return;
        }

        const json = await res.json().catch(() => ({ data: [] }));
        const list: Airport[] = Array.isArray(json?.data) ? json.data : [];

        if (myReq === reqId.current) {
          setItems(list);
          setOpen(true);
          setActive(list.length ? 0 : -1);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error("[AirportInput] search failed:", e?.message || String(e));
        }
        if (myReq === reqId.current) {
          setItems([]);
          setOpen(true);
          setActive(-1);
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [term]);

  // commit a selection
  function pick(s: Airport) {
    const display = s.label || (s.code ? `${s.code} — ${s.name}` : s.name);
    setTerm(display);
    setOpen(false);
    setActive(-1);
    if (s.code) onChange(s.code);
  }

  // keyboard navigation
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || (!items.length && !loading)) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : -1));
    } else if (e.key === "Enter") {
      if (active >= 0 && items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const inputPlaceholder = useMemo(
    () => placeholder || "Type city or airport",
    [placeholder]
  );

  return (
    <div className="relative w-full">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => term.trim().length >= 2 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={inputPlaceholder}
        autoComplete="off"
        className={
          // bigger, cleaner input (works with Tailwind; falls back gracefully if not present)
          "w-full h-11 px-4 rounded-lg border border-gray-300 " +
          "focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-[15px]"
        }
        style={{
      /* fallback styles if Tailwind isn't available */
          borderRadius: 8,
        }}
      />

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{
            // fallback if Tailwind not present
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 300,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            marginTop: 4,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
          }}
          onMouseDown={(e) => e.preventDefault()} // keep focus on input
        >
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500" style={{ padding: 12, color: "#64748b" }}>
              Searching…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500" style={{ padding: 12, color: "#64748b" }}>
              No matches
            </div>
          )}

          {!loading &&
            items.map((s, i) => {
              const label = s.label || (s.code ? `${s.code} — ${s.name}` : s.name);
              const isActive = i === active;
              return (
                <button
                  key={`${s.code || "nocode"}-${s.name}-${i}`}
                  type="button"
                  className={
                    "flex w-full items-start gap-2 px-4 py-3 text-left " +
                    (isActive ? "bg-gray-100" : "hover:bg-gray-50")
                  }
                  style={{
                    display: "flex",
                    width: "100%",
                    textAlign: "left",
                    gap: 8,
                    padding: "10px 12px",
                    background: isActive ? "#f3f4f6" : undefined,
                    borderBottom: "1px dashed #e5e7eb",
                    cursor: "pointer",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  <div className="shrink-0 font-mono text-sm font-semibold" style={{ minWidth: 44 }}>
                    {s.code || "—"}
                  </div>
                  <div className="grow">
                    <div className="text-sm">{label}</div>
                    <div className="text-xs text-gray-500" style={{ color: "#6b7280" }}>
                      {s.city || "-"}{s.country ? `, ${s.country}` : ""}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
