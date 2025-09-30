import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
    if (!token) {
      return NextResponse.json({ data: [], error: "Missing DUFFEL_KEY env var" }, { status: 500 });
    }

    const r = await fetch(
      `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": "beta",          // <- force beta
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await r.text();
    return new NextResponse(text || JSON.stringify({ data: [] }), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: String(e?.message || e) }, { status: 500 });
  }
}
