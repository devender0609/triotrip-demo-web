"use client";
import React from "react";

export default function CompareTray({
  items, onUnpin,
}: { items: any[]; onUnpin: (id:string)=>void }) {
  if (!items.length) return null;
  return (
    <div className="tray">
      <div className="head">Compare ({items.length})</div>
      <div className="grid">
        {items.map((r:any)=>(
          <div className="card" key={r.id}>
            <div className="top">
              <div className="price">
                {r.currency && r.total_cost_converted != null
                  ? `${r.currency} ${r.total_cost_converted}`
                  : `$${r.total_cost}`}
              </div>
              <button className="x" onClick={()=>onUnpin(r.id)} aria-label="Remove">×</button>
            </div>
            <div className="line">{r.flight?.carrier} • {r.flight?.stops===0?"Nonstop":`${r.flight?.stops} stop(s)`}</div>
            <div className="line">{r.flight?.sustainability?.co2_kg ?? "—"} kg CO₂</div>
            <div className="line">{r.flight?.farePolicy?.refundable ? "Refundable" : "Non-refundable"}</div>
            <a className="btn" target="_blank" href={r.flight?.bookingLinks?.airlineSite || r.flight?.bookingLinks?.googleFlights || r.flight?.bookingLinks?.skyscanner || "#"}>Book</a>
          </div>
        ))}
      </div>
      <style jsx>{`
        .tray{position:sticky;bottom:12px;background:#ffffffeb;border:1px solid #e2e8f0;border-radius:16px;padding:10px;backdrop-filter:blur(6px)}
        .head{font-weight:900;margin-bottom:6px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
        .card{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff}
        .top{display:flex;justify-content:space-between;align-items:center}
        .price{font-weight:900}
        .x{border:none;background:#f1f5f9;border-radius:8px;width:28px;height:28px;cursor:pointer}
        .line{font-size:12px;color:#475569;margin-top:4px}
        .btn{display:inline-block;margin-top:8px;padding:8px 10px;border-radius:10px;background:linear-gradient(90deg,#06b6d4,#0ea5e9);color:#fff;text-align:center}
      `}</style>
    </div>
  );
}
