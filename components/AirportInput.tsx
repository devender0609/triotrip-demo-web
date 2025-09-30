// components/AirportInput.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Airport = { code: string; name: string; city: string; country: string; label: string };

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
  const [items, setItems] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>();

  // keep internal term in sync if parent changes value
  useEffect(() => setTerm(value), [value]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!term || term.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/airports?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const list = await r.json();
        setItems(Array.isArray(list) ? list : []);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [term]);

  return (
    <div className="ai-wrap">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="ai-pop">
          {loading && <div className="ai-row muted">Searching…</div>}
          {!loading && items.length === 0 && <div className="ai-row muted">No matches</div>}
          {!loading &&
            items.map((a) => (
              <div
                key={`${a.code}-${a.label}`}
                className="ai-row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(a.label);
                  setTerm(a.label);
                  setOpen(false);
                }}
              >
                {a.label}
              </div>
            ))}
        </div>
      )}
      <style jsx>{`
        .ai-wrap { position: relative; }
        input {
          width: 100%;
          height: 40px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
        }
        .ai-pop {
          position: absolute;
          left: 0; right: 0; top: 44px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.08);
          z-index: 20;
          max-height: 280px;
          overflow: auto;
        }
        .ai-row {
          padding: 10px 12px;
          cursor: pointer;
        }
        .ai-row:hover { background: #f8fafc; }
        .ai-row.muted { color: #64748b; cursor: default; }
      `}</style>
    </div>
  );
}
