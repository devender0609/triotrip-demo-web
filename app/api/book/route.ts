// app/api/book/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Demo booking endpoint:
 * - Accepts { offer }
 * - Returns a redirectUrl to the airline (if present) or a simple success
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const offer = body?.offer;

    if (!offer) {
      return NextResponse.json({ error: "Missing offer" }, { status: 400 });
    }

    // In a real app, you'd create a booking intent in your system here.

    // Prefer direct airline deep link if available:
    const airlineUrl =
      offer?.deeplinks?.airline?.url || offer?.flight?.deeplinks?.airline?.url || null;

    return NextResponse.json({
      ok: true,
      message: "TripTrio booking intent created.",
      redirectUrl: airlineUrl, // front-end will open this in a new tab
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Booking failed" },
      { status: 500 }
    );
  }
}
