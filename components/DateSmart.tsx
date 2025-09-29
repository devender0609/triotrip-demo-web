"use client";
import React, { useEffect, useMemo, useState } from "react";
type Props = { depart: string; returnDate?: string | null; onChange: (d: { depart: string; returnDate: string | null }) => void; };
function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function nextDow(start: Date, dow: number) { const c = new Date(start); const diff = (dow + 7 - c.getDay()) % 7; c.setDate(c.getDate() + diff); return c; }
export default function DateSmart({ depart, returnDate, onChange }: Props) {
  const [roundTrip, setRoundTrip] = useState<boolean>(!!returnDate);
  const [d1, setD1] = useState<string>(depart || fmt(addDays(new Date(), 21)));
  const [d2, setD2] = useState<string | null>(returnDate || null);
  useEffect(() => { onChange({ depart: d1, returnDate: roundTrip ? d2 : null }); }, [d1, d2, roundTrip]); // eslint-disable-line
  const grid = useMemo(() => { const base = new Date(d1); return [-3,-2,-1,0,1,2,3].map(off => fmt(addDays(base, off))); }, [d1]);
  function presetWeekend(){ const now=new Date(); const sat=nextDow(now,6), sun=addDays(sat,1); setRoundTrip(true); setD1(fmt(sat)); setD2(fmt(sun)); }
  function presetNextWeekend(){ const now=addDays(new Date(),7); const sat=nextDow(now,6), sun=addDays(sat,1); setRoundTrip(true); setD1(fmt(sat)); setD2(fmt(sun)); }
  function presetWeek(n=1){ const a=addDays(new Date(),7*n); setRoundTrip(true); setD1(fmt(a)); setD2(fmt(addDays(a,7))); }
  return (<div>
    <div className="label">Trip type</div>
    <div className="row" style={{ gap: 8, marginBottom: 8 }}>
      <button type="button" className={`button ${!roundTrip ? "primary" : ""}`} onClick={()=>setRoundTrip(false)}>One-way</button>
      <button type="button" className={`button ${roundTrip ? "primary" : ""}`} onClick={()=>setRoundTrip(true)}>Round-trip</button>
    </div>
    <div className="row" style={{ gap: 12 }}>
      <div><div className="label">Depart</div>
        <input type="date" className="input" value={d1} onChange={(e)=>setD1(e.target.value)} /></div>
      {roundTrip && (<div><div className="label">Return</div>
        <input type="date" className="input" min={d1} value={d2 || ""} onChange={(e)=>setD2(e.target.value || null)} /></div>)}
    </div>
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <button type="button" className="button" onClick={presetWeekend}>This weekend</button>
      <button type="button" className="button" onClick={presetNextWeekend}>Next weekend</button>
      <button type="button" className="button" onClick={()=>presetWeek(2)}>In 2 weeks</button>
      <button type="button" className="button" onClick={()=>presetWeek(4)}>In a month</button>
    </div>
    <div style={{ marginTop: 10 }}>
      <div className="label">Flexible ±3 days</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
        {grid.map(d => (<button key={d} type="button" className={`button ${d===d1 ? "primary": ""}`} onClick={()=>setD1(d)}>{d}</button>))}
      </div>
    </div>
  </div>);
}
