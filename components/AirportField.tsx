"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  code: string;
  name: string;
  city: string;
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
  const { code, initialDisplay, onChangeCode, onTextChange, placeholder = "Type city or airport" } =
    props;

  const [text, setText] = useState(initialDisplay || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const timer = useRef<any>();

  // keep external -> internal in sync
  useEffect(() => {
    if (initialDisplay != null) setText(initialDisplay);
  }, [initialDisplay]);

  // load suggestions
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!text || text.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `/api/places?q=${encodeURIComponent(text)}`;
        // Debug so you can see it in the browser console
        console.log("[AirportField] requesting", url);
        const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const payload = await r.json();
        const list: Suggestion[] = Array.isArray(payload?.data) ? payload.data : payload;
        setItems(Array.isArray(list) ? list : []);
        console.log("[AirportField] got", list.length, "items");
        setOpen(true);
      } catch (e) {
        console.error("[AirportField] fetch failed:", e);
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer.current);
  }, [text]);

  function pick(s: Suggestion) {
    const display = s.label || `${s.code} — ${s.name}`;
    setText(display);
    setOpen(false);
    onChangeCode?.(s.code, display);
    onTextChange?.(display);
  }

  function onInputChange(v: string) {
    setText(v);
    onTextChange?.(v);
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".airport-field")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="airport-field" style={{ position: "relative" }}>
      {props.label ? (
        <label className="form-label" style={{ display: "block", marginBottom: 6 }}>
          {props.label}
        </label>
      ) : null}

      <input
        value={text}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => text.trim().length >= 2 && setOpen(true)}
        placeholder={placeholder}
        className="form-control"
      />

      {open && (loading || items.length > 0) && (
        <div
          className="dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            marginTop: 4,
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10, color: "#64748b" }}>Searching…</div>
          )}
          {!loading &&
            items.map((s) => (
              <button
                key={`${s.code}-${s.name}`}
                type="button"
                onClick={() => pick(s)}
                className="dropdown-item"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderBottom: "1px dashed #e2e8f0",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {s.label || `${s.code} — ${s.name}`}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
