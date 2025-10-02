"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";

type Place = {
  code: string;        // IATA
  name: string;        // Airport/City name
  city?: string;
  country?: string;
  label: string;       // "BOS — Logan … — US"
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

async function fetchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `/api/places?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  const arr: any[] = Array.isArray(j?.data) ? j.data : [];
  return arr.map((p) => ({
    code: String(p.code || "").toUpperCase(),
    name: p.name || p.city || "",
    city: p.city || "",
    country: p.country || "",
    label: p.label || `${p.code} — ${p.name}`,
  }));
}

export default function AirportField(props: {
  id: string;
  label: string;
  /** current IATA code from parent */
  code: string;
  /** initial text the user sees (e.g. label for selected code) */
  initialDisplay: string;
  /** live typing back up to parent (used by your page state) */
  onTextChange: (next: string) => void;
  /** commit a selection (code + pretty display) */
  onChangeCode: (code: string, display: string) => void;
  autoFocus?: boolean;
}) {
  const {
    id,
    label,
    code,
    initialDisplay,
    onTextChange,
    onChangeCode,
    autoFocus,
  } = props;

  /** What the user is typing in the box */
  const [input, setInput] = useState(initialDisplay || "");
  /** Results list */
  const [items, setItems] = useState<Place[]>([]);
  /** UI state */
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedRef = useRef<string>(""); // last committed display string

  // Sync when parent changes the selected code/display (e.g. on swap/clear)
  useEffect(() => {
    if (initialDisplay !== lastSelectedRef.current) {
      setInput(initialDisplay || "");
      onTextChange(initialDisplay || "");
      lastSelectedRef.current = initialDisplay || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDisplay, code]);

  // Debounced search while typing (only if user is actually typing; not after a commit)
  useEffect(() => {
    onTextChange(input);

    const q = input.trim();

    // If the box contains exactly the last committed display → don’t search
    if (q && q === lastSelectedRef.current) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    // If less than 2 chars, hide suggestions
    if (q.length < 2) {
      if (abortRef.current) abortRef.current.abort();
      setItems([]);
      setOpen(!!q); // small UX: open only when user started typing
      setLoading(false);
      return;
    }

    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      // cancel previous
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const data = await fetchPlaces(q, ctrl.signal);
        setItems(data.slice(0, 20));
        setOpen(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debRef.current) {
        clearTimeout(debRef.current);
        debRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commitSelection(p: Place) {
    const display = `${p.code} — ${p.name}${p.city && p.city !== p.name ? ` — ${p.city}` : ""}${p.country ? ` — ${p.country}` : ""}`;
    lastSelectedRef.current = display;
    setInput(display);
    setItems([]);
    setOpen(false);
    setActiveIdx(-1);
    onTextChange(display);
    onChangeCode(p.code, display);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && activeIdx < items.length) {
        e.preventDefault();
        commitSelection(items[activeIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function clearField() {
    lastSelectedRef.current = "";
    setInput("");
    onTextChange("");
    onChangeCode("", "");
    setItems([]);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  return (
    <div className="w-full" ref={boxRef}>
      <label htmlFor={id} className="form-label mb-1">{label || " "}</label>

      <div className="position-relative">
        <input
          id={id}
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(items.length > 0)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          placeholder="Type city or airport"
          className="form-control"
          style={{ paddingRight: 34 }}
          {...(autoFocus ? { autoFocus: true } : {})}
        />

        {/* Clear button */}
        {input && (
          <button
            type="button"
            aria-label="Clear"
            onClick={clearField}
            className="btn btn-light border position-absolute"
            style={{ right: 4, top: 4, height: 30, width: 30, lineHeight: 1 }}
          >
            ×
          </button>
        )}

        {/* Popover */}
        {open && (
          <div
            className="border rounded shadow bg-white mt-1"
            style={{ position: "absolute", zIndex: 40, left: 0, right: 0, maxHeight: 280, overflowY: "auto" }}
            role="listbox"
            aria-label="Airport suggestions"
          >
            {loading && (
              <div className="px-3 py-2 text-muted small">Searching…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-3 py-2 text-muted small">No matches</div>
            )}
            {!loading &&
              items.map((p, idx) => (
                <div
                  key={p.code + idx}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitSelection(p)}
                  className={classNames(
                    "px-3 py-2 cursor-pointer",
                    idx === activeIdx ? "bg-primary text-white" : "bg-white text-dark",
                    "border-top"
                  )}
                >
                  <div className="fw-semibold">{p.label}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
