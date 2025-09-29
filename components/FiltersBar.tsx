"use client";
import React from "react";

export type Filters = {
  nonstopOnly: boolean;
  refundableOnly: boolean;
  greenerOnly: boolean;
  minBagsIncluded: number;
};

export default function FiltersBar({
  value, onChange,
}: {
  value: Filters;
  onChange: (v: Filters) => void;
}) {
  function set<K extends keyof Filters>(k: K, v: Filters[K]) {
    onChange({ ...value, [k]: v });
  }
  return (
    <div className="filters">
      <label className={`chip ${value.nonstopOnly ? "on" : ""}`} onClick={() => set("nonstopOnly", !value.nonstopOnly)}>Nonstop</label>
      <label className={`chip ${value.refundableOnly ? "on" : ""}`} onClick={() => set("refundableOnly", !value.refundableOnly)}>Refundable</label>
      <label className={`chip ${value.greenerOnly ? "on" : ""}`} onClick={() => set("greenerOnly", !value.greenerOnly)}>Greener</label>
      <div className="bags">
        Bags ≥{" "}
        <select value={value.minBagsIncluded} onChange={(e)=>set("minBagsIncluded", Number(e.target.value))}>
          <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
        </select>
      </div>
      <style jsx>{`
        .filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 4px}
        .chip{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;font-weight:700;cursor:pointer}
        .chip.on{background:linear-gradient(90deg,#06b6d4,#0ea5e9);color:#fff;border:none}
        .bags{display:flex;gap:6px;align-items:center}
        select{height:34px;border-radius:10px;border:1px solid #e2e8f0;padding:0 8px}
      `}</style>
    </div>
  );
}
