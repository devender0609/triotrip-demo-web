"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/api";

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
  onChangeCode?: (code: string, display: string) => void;
  onTextChange?: (display: string) => void;
  placeholder?: string;
}) {
  const { label, initialDisplay, onChangeCode, onTextChange, placeholder = "Type city or airport" } = props;

  const [text, setText] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (initialDisplay != null) setText(initialDisplay);
  }, [initialDisplay]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const q = text.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      // also cancel any in-flight search
      inFlight.current?.abort();
      inFlight.current = null;
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      // cancel previous request (if any)
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setLoading(true);
      const myReq = ++reqId.current;

      try {
        console.log("[AirportField] searching:", q);
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.error("[AirportField] /api/places not ok:", res.status, t?.slice(0, 200));
          setItems([]);
          setOpen(true);
          return;
        }
        const json = await res.json().catch(() => ({ data: [] }));
        const list: Suggestion[] = Array.isArray(json?.data) ? json.data : [];

        // Only apply if this is the latest request
        if (myReq === reqId.current) {
          console.log("[AirportField] results:", { count: list.length, sample: list.slice(0, 5) });
          setItems(list);
          setOpen(true);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          // silently ignore—newer query took over
          console.debug("[AirportField] aborted (newer query)");
        } else {
          console.error("[AirportField] search failed:", e?.message || String(e));
          setItems([]);
          setOpen(true); // show "No matches"
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [text]);

  function pick(s: Suggestion) {
    const display = s.label || (s.code ? `${s.code} — ${s.name}` : s.name);
    setText(display);
    setOpen(false);
    if (s.code) onChangeCode?.(s.code, display);
    onTextChange?.(display);
  }

  return (
    <div className="airport-field" style={{ position: "relative" }}>
      {label ? <label style={{ display: "block", marginBottom: 6 }}>{label}</label> : null}

      <input
        value={text}
        onChange={(e) => { setText(e.target.value); onTextChange?.(e.target.value); }}
        onFocus={() => text.trim().length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="form-control"
        autoComplete="off"
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%", left: 0, right: 0, zIndex: 40,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
            marginTop: 4, maxHeight: 320, overflow: "auto",
          }}
        >
          {loading && <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding: 10, color: "#64748b" }}>No matches</div>
          )}
          {!loading && items.map((s, i) => (
            <button
              key={`${s.code || "nocode"}-${s.name}-${i}`}
              type="button"
              onClick={() => pick(s)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 12px", borderBottom: "1px dashed #e2e8f0", cursor: "pointer",
              }}
            >
              <strong>{s.label || (s.code ? `${s.code} — ${s.name}` : s.name)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}