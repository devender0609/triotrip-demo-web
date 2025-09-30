// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";  // ensure this never prerenders
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
    if (!token) {
      // Explicit message to help debugging in Network tab
      return NextResponse.json(
        { data: [], error: "Missing DUFFEL_KEY env var" },
        { status: 500 },
      );
    }

    const r = await fetch(
      `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": process.env.DUFFEL_VERSION || "beta",
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    // Return Duffel’s error body too so you can read it in DevTools
    const text = await r.text();
    if (!r.ok) {
      return new NextResponse(text || JSON.stringify({ data: [] }), {
        status: r.status,
        headers: { "content-type": "application/json" },
      });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { data: [], error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
