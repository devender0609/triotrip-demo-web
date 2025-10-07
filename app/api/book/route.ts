// app/api/book/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function makeBookingUrl(base: string, offer: ReturnType<typeof normalizeOffer>) {
  const u = new URL(base);
  const params = u.searchParams;
  params.set("airline", String(offer.airline));
  params.set("origin", String(offer.origin));
  params.set("destination", String(offer.destination));
  params.set("currency", String(offer.currency));
  params.set("pax", String(offer.pax));
  params.set("price", String(offer.price));
  params.set("ts", String(Date.now()));
  return u.toString();
}

/** Compute the base URL for checkout
 * Priority:
 * 1) NEXT_PUBLIC_BOOKING_BASE (e.g., https://yourdomain.com/checkout)
 * 2) Same-origin /checkout
 */
function resolveBaseCheckoutUrl(req: Request) {
  const envBase = process.env.NEXT_PUBLIC_BOOKING_BASE?.trim();
  if (envBase) return envBase; // must include /checkout path or equivalent

  // fallback to in-app checkout page
  const origin = new URL(req.url).origin;
  return `${origin}/checkout`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const offer = normalizeOffer(body?.offer || body);
    const base = resolveBaseCheckoutUrl(req);
    const bookingUrl = makeBookingUrl(base, offer);
    return NextResponse.json({ ok: true, bookingUrl });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Booking failed" },
      { status: 500 }
    );
  }
}

// GET fallback (some hosts block POST in previews)
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

    const base = resolveBaseCheckoutUrl(req);
    const bookingUrl = makeBookingUrl(base, offer);
    return NextResponse.json({ ok: true, bookingUrl });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Booking failed" },
      { status: 500 }
    );
  }
}
