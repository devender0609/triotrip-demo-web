// app/api/book/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // Expecting { offer: {...}, meta?: {...} }
    const offer = body?.offer ?? {};
    const meta = body?.meta ?? {};

    // Minimal validation so we don't 404
    if (!offer) {
      return NextResponse.json({ ok: false, error: "Missing offer" }, { status: 400 });
    }

    // Build a stable demo booking URL that your frontend can open
    // In a real system, this would be a shortlink or a payment session URL.
    const params = new URLSearchParams();
    const airline =
      offer?.flight?.carrier_name || offer?.flight?.carrier || "TripTrio";
    const total =
      offer?.total_cost ??
      offer?.flight?.price_usd ??
      offer?.price ??
      offer?.price_total ??
      0;

    params.set("airline", String(airline));
    params.set("price", String(total));
    params.set("currency", String(offer?.currency || "USD"));
    params.set("origin", String(offer?.flight?.origin || offer?.origin || ""));
    params.set("destination", String(offer?.flight?.destination || offer?.destination || ""));
    params.set("pax", String(meta?.passengers ?? 1));
    params.set("ts", String(Date.now()));

    // You can later change this to your real booking domain
    const bookingUrl = `https://triptrio.example/checkout?${params.toString()}`;

    // Return JSON; frontend will window.open(bookingUrl)
    return NextResponse.json({ ok: true, bookingUrl });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Booking failed" },
      { status: 500 }
    );
  }
}
