"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id: string;
  label: string;
  code: string;
  initialDisplay: string;
  onTextChange: (next: string) => void;
  onChangeCode: (code: string, display: string) => void;
  autoFocus?: boolean;
};

type Result = { code: string; label: string };

export default function AirportField({
  id,
  label,
  code,
  initialDisplay,
  onTextChange,
  onChangeCode,
  autoFocus,
}: Props) {
  const [value, setValue] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Sync when parent changes initialDisplay
  useEffect(() => {
    setValue(initialDisplay || "");
  }, [initialDisplay]);

  // Global click-out to close dropdown
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
      setActiveIdx(-1);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced query
  useEffect(() => {
    const q = value.trim();
    setLoading(true);

    if (controller.current) controller.current.abort();
    controller.current = new AbortController();

    const t = setTimeout(async () => {
      try {
        const url = `/api/airports?q=${encodeURIComponent(q)}&limit=12`;
        const r = await fetch(url, { signal: controller.current?.signal });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Airport search failed");
        setResults(Array.isArray(j.results) ? j.results : []);
      } catch (e) {
        if ((e as any)?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(t);
      controller.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function pick(item: Result) {
    setValue(item.label);
    onTextChange(item.label);
    onChangeCode(item.code, item.label);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min((i < 0 ? -1 : i) + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && activeIdx >= 0 && results[activeIdx]) {
        e.preventDefault();
        pick(results[activeIdx]);
      } else {
        // If user typed a 3-letter code, accept it directly
        const maybe = results.find(
          (r) => r.code.toUpperCase() === value.trim().toUpperCase()
        );
        if (maybe) pick(maybe);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div className="af-wrap" ref={wrapRef}>
      {label ? (
        <label htmlFor={id} className="af-label">
          {label}
        </label>
      ) : null}

      <input
        id={id}
        ref={inputRef}
        className="af-input"
        type="text"
        value={value}
        placeholder="City, airport or code"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setValue(e.target.value);
          onTextChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="af-list" role="listbox" aria-labelledby={id}>
          {loading && <div className="af-item af-empty">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="af-item af-empty">No matches</div>
          )}
          {!loading &&
            results.map((p, idx) => (
              <div
                key={p.code + idx}
                role="option"
                aria-selected={idx === activeIdx}
                className={`af-item ${idx === activeIdx ? "is-active" : ""}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(-1)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
              >
                <div className="af-code">{p.code}</div>
                <div className="af-info">{p.label.replace(`${p.code} — `, "")}</div>
              </div>
            ))}
        </div>
      )}

      <style jsx>{`
        .af-wrap { position: relative; }
        .af-label { font-weight: 800; color: #334155; display: block; margin-bottom: 6px; }

        /* Make it look exactly like your other inputs (box with border) */
        .af-input {
          height: 42px;
          padding: 0 10px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          width: 100%;
          outline: none;
        }
        .af-input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
        }

        .af-list {
          position: absolute;
          z-index: 50;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 8px 28px rgba(2, 6, 23, 0.15);
          max-height: 280px;
          overflow: auto;
        }
        .af-item {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 700;
          color: #334155;
        }
        .af-item + .af-item { border-top: 1px solid #f1f5f9; }
        .af-item.is-active { background: #f0f9ff; }
        .af-item.af-empty { grid-template-columns: 1fr; cursor: default; color: #64748b; }
        .af-code { font-weight: 900; color: #0f172a; }
      `}</style>
    </div>
  );
}
