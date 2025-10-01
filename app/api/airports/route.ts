// app/api/airports/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json([], { status: 200 });

  const target = `${origin}/api/places?q=${encodeURIComponent(q)}`;

  try {
    const r = await fetch(target, { cache: "no-store" });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    // minimal fallback to keep UI usable
    return NextResponse.json(
      [{ code: "AUS", name: "Austin-Bergstrom International", city: "Austin", label: "AUS — Austin-Bergstrom International (Austin, US)" }],
      { status: 200 }
    );
  }
}
