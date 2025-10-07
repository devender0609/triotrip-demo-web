"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function TravelerCard({ index }: { index: number }) {
  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="font-semibold mb-3">Traveler #{index + 1}</div>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="label">Title</label>
          <select className="input"><option>Mr</option><option>Ms</option><option>Mrs</option></select>
        </div>
        <div>
          <label className="label">Gender</label>
          <select className="input"><option>Male</option><option>Female</option><option>Other</option></select>
        </div>
        <div>
          <label className="label">First name</label>
          <input className="input" placeholder="First name" />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" placeholder="Last name" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Date of birth</label>
          <input className="input" type="date" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Known traveler / Redress (optional)</label>
          <input className="input" placeholder="KTN / Redress" />
        </div>
      </div>
    </div>
  );
}

function CheckoutInner() {
  const params = useSearchParams();
  const count = Math.max(1, Number(params.get("count")) || Number(params.get("pax")) || 1);
  const cards = useMemo(() => Array.from({ length: count }), [count]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* top bar */}
      <div className="flex items-center justify-between mb-4">
        <button className="btn-outline" onClick={() => (typeof window !== "undefined" ? window.history.back() : null)}>← Back</button>
        <div className="font-extrabold">Secure sandbox checkout</div>
      </div>

      <section className="rounded-2xl border p-4 bg-white shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Passenger details</h1>
        <p className="text-sm text-slate-600 mb-3">Enter traveler information exactly as it appears on your ID.</p>

        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="label">Email</label><input className="input" placeholder="you@email.com" /></div>
          <div><label className="label">Phone</label><input className="input" placeholder="+1 555-555-5555" /></div>
          <label className="flex items-center gap-2 mt-1 md:col-span-2 text-sm text-slate-600">
            <input type="checkbox" /> Save my details for next time
          </label>
        </div>

        <div className="mt-5 space-y-4">
          {cards.map((_, i) => <TravelerCard key={i} index={i} />)}
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button className="btn-primary">Pay &amp; Book (Sandbox)</button>
          <span className="text-sm text-slate-600">No real charges. This is a demo flow.</span>
          <button className="btn-outline ml-auto" onClick={() => window.print()}>Print</button>
        </div>
      </section>

      {/* Demo summary (optional footer card) */}
      <div className="rounded-2xl border p-4 bg-white shadow-sm mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">United</div>
            <div className="text-sm text-slate-600">AUS → BOS</div>
            <ul className="text-sm mt-2 list-disc ml-5">
              <li>Passengers: {count}</li>
              <li>Fare type: Economy (example)</li>
              <li>Rules: Changes may incur fees (demo)</li>
            </ul>
          </div>
          <div className="text-right">
            <div className="font-extrabold">$0.00 <span className="text-sm text-slate-500">USD</span></div>
          </div>
        </div>

        <button className="btn-primary w-full mt-4">Pay &amp; Book (Sandbox)</button>
        <p className="text-xs text-slate-600 mt-3">🔒 Your details are used only for this sandbox checkout.</p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-4xl px-4 py-6">Loading…</main>}>
      <CheckoutInner />
    </Suspense>
  );
}
