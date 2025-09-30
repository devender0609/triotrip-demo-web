// components/AirportField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/api"; // relative import (no alias)

type Suggestion = {
  code?: string;
  name: string;
  city?: string;
  country?: string;
  label: string;
};

export default function AirportField(props: {
  label?: string;
  code?: string;
  initialDisplay?: string;
  onChangeCode?: (code: string | undefined, display: string) => void;
  onTextChange?: (display: string) => void;
  placeholder?: string;
}) {
  const { initialDisplay, onChangeCode, onTextChange, placeholder = "Type city or airport" } = props;

  const [text, setText] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [debug, setDebug] = useState<string>("");

  const boxRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // close popover on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // debounce fetch (>= 1 char)
  useEffect(() => {
    onTextChange?.(text);

    if (!text || text.trim().length < 1) {
      setItems([]);
      setDebug("");
      setOpen(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const json = await searchPlaces(text.trim()); // ALWAYS relative /api/places
        const list = Array.isArray(json?.data) ? (json.data as Suggestion[]) : [];
        setItems(list);
        setDebug(list.length === 0 ? "No results" : "");
        setOpen(true);
        // eslint-disable-next-line no-console
        console.log("[AirportField] suggestions:", list.slice(0, 5));
      } catch (err: any) {
        setItems([]);
        setDebug(err?.message || "API error");
        setOpen(true);
        // eslint-disable-next-line no-console
        console.error("[AirportField] fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => timer.current && clearTimeout(timer.current);
  }, [text, onTextChange]);

  function pick(s: Suggestion) {
    const display = s.label;
    setText(display);
    setOpen(false);
    onChangeCode?.(s.code, display);
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => (items.length || debug ? setOpen(true) : undefined)}
        placeholder={placeholder}
        aria-autocomplete="list"
        autoComplete="off"
        style={{ height: 42, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, width: "100%" }}
      />

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: 44,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(2,6,23,.08)",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {loading && <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>Searching…</div>}
          {!loading && debug && <div style={{ padding: 10, color: "#b45309", fontWeight: 700 }}>{debug}</div>}
          {!loading && !debug && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b", fontWeight: 700 }}>No matches</div>
          )}
          {!loading && !debug &&
            items.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s)}
                role="option"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px dashed #e2e8f0",
                  cursor: "pointer",
                  color: "#0f172a",
                }}
              >
                {s.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
