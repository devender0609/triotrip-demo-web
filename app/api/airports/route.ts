// app/api/airports/route.ts
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    if (q.length < 2) return NextResponse.json([]);

    const r = await fetch(
      "https://api.duffel.com/air/places/suggestions?" +
        new URLSearchParams({ query: q, types: "airport" }),
      {
        headers: {
          Authorization: `Bearer ${process.env.DUFFEL_KEY!}`,
          "Duffel-Version": process.env.DUFFEL_VERSION || "v2",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!r.ok) return NextResponse.json([]);

    const j = await r.json();
    const list =
      j?.data?.map((p: any) => ({
        code: p.iata_code ?? "",
        name: p.name ?? "",
        city: p.city?.name ?? "",
        country: p.city?.country_name ?? "",
        label: [p.iata_code, p.name, p.city?.name].filter(Boolean).join(" · "),
      })) ?? [];

    return NextResponse.json(list);
  } catch {
    return NextResponse.json([]);
  }
}
