// app/api/places/route.ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type DuffelPlace = {
  type: string;
  name: string;
  city_name?: string;
  iata_code?: string;
  iata_city_code?: string;
  id?: string;
};

function toSuggestion(p: DuffelPlace) {
  const code = p.iata_code || p.iata_city_code || "";
  const name = p.name || "";
  const city = p.city_name || "";
  return {
    code,
    name,
    city,
    label: code ? `${code} — ${name}${city ? ` (${city})` : ""}` : `${name}${city ? ` (${city})` : ""}`,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return NextResponse.json({ data: [] });

  const key = process.env.DUFFEL_KEY;
  const version = process.env.DUFFEL_VERSION || "beta";

  if (!key) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const url = `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}&types[]=airport&types[]=city&limit=15`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Duffel-Version": version,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!r.ok) {
      const msg = await r.text();
      return NextResponse.json({ error: msg || `Duffel error ${r.status}` }, { status: r.status });
    }

    const j = await r.json();
    const list = Array.isArray(j?.data) ? j.data.map(toSuggestion) : [];
    return NextResponse.json({ data: list }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "fetch failed", data: [] }, { status: 200 });
  }
}
