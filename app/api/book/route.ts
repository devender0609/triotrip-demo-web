// app/api/book/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Minimal normalizer so we can accept GET or POST
function normalizeOffer(obj: any = {}) {
  const flight = obj.flight || {};
  const price =
    obj.total_cost ??
    obj.total_cost_converted ??
    obj.price ??
    flight.price_usd_converted ??
    flight.price_usd ??
    0;

  return {
    airline: flight.carrier_name || flight.carrier || "TripTrio",
    origin: flight.origin || obj.origin || "",
    destination: flight.destination || obj.destination || "",
    currency: obj.currency || "USD",
    pax: obj.pax || obj.passengers || 1,
    price,
  };
}

function makeBookingUrl(offer: ReturnType<typeof normalizeOffer>) {
  const params = new URLSearchParams();
  params.set("airline", String(offer.airline));
  params.set("origin", String(offer.origin));
  params.set("destination", String(offer.destination));
  params.set("currency", String(offer.currency));
  params.set("pax", String(offer.pax));
  params.set("price", String(offer.price));
  params.set("ts", String(Date.now()));

  // Replace with your real checkout later
  return `https://triptrio.example/checkout?${params.toString()}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const offer = normalizeOffer(body?.offer || body);
    const bookingUrl = makeBookingUrl(offer);
    return NextResponse.json({ ok: true, bookingUrl });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Booking failed" },
      { status: 500 }
    );
  }
}

// GET fallback (avoids some environments throwing on POST)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const offer = normalizeOffer({
      flight: {
        carrier_name: url.searchParams.get("airline") || undefined,
        origin: url.searchParams.get("origin") || undefined,
        destination: url.searchParams.get("destination") || undefined,
        price_usd: Number(url.searchParams.get("price")) || undefined,
      },
      currency: url.searchParams.get("currency") || undefined,
      pax: Number(url.searchParams.get("pax")) || undefined,
      price: Number(url.searchParams.get("price")) || undefined,
    });
    const bookingUrl = makeBookingUrl(offer);
    return NextResponse.json({ ok: true, bookingUrl });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Booking failed" },
      { status: 500 }
    );
  }
}
