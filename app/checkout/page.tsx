"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PassengerBlock({ index }: { index: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-1 rounded-full border text-xs">#{index + 1}</span>
        <div className="font-semibold">Traveler</div>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-semibold mb-1">Title</label>
          <select className="w-full rounded-lg border px-3 py-2">
            <option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">First name</label>
          <input className="w-full rounded-lg border px-3 py-2" placeholder="First name" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Last name</label>
          <input className="w-full rounded-lg border px-3 py-2" placeholder="Last name" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Gender</label>
          <select className="w-full rounded-lg border px-3 py-2">
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Date of birth</label>
          <input type="date" className="w-full rounded-lg border px-3 py-2" />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const adults = Number(sp.get("adults") || 1);
  const children = Number(sp.get("children") || 0);
  const infants = Number(sp.get("infants") || 0);
  const total = adults + children + infants;

  const passengers = useMemo(() => Array.from({ length: total }), [total]);
  const [saveDetails, setSaveDetails] = useState(true);

  return (
    <main className="max-w-5xl mx-auto px-4 pb-16">
      <div className="flex items-center justify-between py-5">
        <button onClick={() => router.back()} className="hover:underline">&larr; Back</button>
        <a className="font-semibold" href="/">TripTrio</a>
        <div className="text-sm px-3 py-1 rounded-lg border flex items-center gap-2">
          <span role="img" aria-label="lock">🔒</span> Secure sandbox checkout
        </div>
      </div>

      <h1 className="text-3xl font-semibold mb-4">Passenger details</h1>
      <p className="text-gray-600 mb-6">Enter traveler information exactly as it appears on your ID.</p>

      <section className="rounded-2xl border p-4 md:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input className="w-full rounded-lg border px-3 py-2" placeholder="you@email.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input className="w-full rounded-lg border px-3 py-2" placeholder="+1 555-555-5555" />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3">
          <input type="checkbox" checked={saveDetails} onChange={(e) => setSaveDetails(e.target.checked)} />
          <span>Save my details for next time</span>
        </label>
      </section>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Passengers ({total})</h2>
        {passengers.map((_, i) => <PassengerBlock key={i} index={i} />)}
      </div>

      <div className="rounded-2xl border p-4 md:p-6 mt-6">
        <div className="flex items-center justify-between">
          <button className="px-4 py-2 rounded-lg bg-cyan-100 border">Pay &amp; Book (Sandbox)</button>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">United</div>
            <div className="text-xl font-semibold">$0.00 <span className="text-sm">USD</span></div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          🔒 Your details are used only for this sandbox checkout.
        </p>
      </div>
    </main>
  );
}
