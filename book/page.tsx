"use client";
import React from "react";

export default function BookPage() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const offerId = params.get("offerId") || "";
  return (
    <div style={{padding:24}}>
      <h1>TripTrio Checkout (Demo)</h1>
      <p>Offer ID: <code>{offerId}</code></p>
      <p>This is where your booking form / payment flow would go.</p>
    </div>
  );
}
