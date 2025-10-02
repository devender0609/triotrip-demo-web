// app/api/book/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Demo booking endpoint:
 * Accepts { offer } and returns { redirectUrl } if we have an airline deeplink.
 * If you saw 404 before, it was because this route didn't exist in your app.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const offer = body?.offer;
    if (!offer) {
      return NextResponse.json({ error: "Missing offer" }, { status: 400 });
    }
    const airlineUrl =
      offer?.deeplinks?.airline?.url || offer?.flight?.deeplinks?.airline?.url || null;

    return NextResponse.json({
      ok: true,
      message: "TripTrio booking intent created.",
      redirectUrl: airlineUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Booking failed" }, { status: 500 });
  }
}
