// app/api/places/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  // Short-circuit for very short queries
  if (q.length < 2) return NextResponse.json({ data: [] });

  const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
  if (!token) {
    return NextResponse.json(
      { data: [], error: "Missing DUFFEL_KEY" },
      { status: 500 }
    );
  }

  const r = await fetch(
    `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": process.env.DUFFEL_VERSION || "beta",
      },
      cache: "no-store",
    }
  );

  if (!r.ok) return NextResponse.json({ data: [] }, { status: r.status });
  const json = await r.json();
  return NextResponse.json(json);
}
