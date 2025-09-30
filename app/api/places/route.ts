import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Suggestion = {
  code?: string;   // IATA
  name: string;
  city?: string;
  country?: string;
  label: string;
};

function toSuggestion(p: any): Suggestion | null {
  if (!p) return null;

  const code =
    p.iata_code ||
    p.code ||
    (typeof p.id === "string" && p.id.length === 3 ? p.id : "") ||
    "";

  const name =
    p.name ||
    p.airport_name ||
    p.city_name ||
    (p.city && (p.city.name || p.city.city_name)) ||
    "";

  const city =
    p.city_name ||
    (p.city && (p.city.name || p.city.city_name)) ||
    p.municipality ||
    "";

  const country =
    p.country_name ||
    (p.country && (p.country.name || p.country.country_name)) ||
    p.country ||
    "";

  if (!name) return null;

  const label =
    (code ? `${code} — ` : "") +
    name +
    (city || country ? ` (${[city, country].filter(Boolean).join(", ")})` : "");

  return {
    code: code || undefined,
    name,
    city: city || undefined,
    country: country || undefined,
    label,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 1) return NextResponse.json({ data: [] }, { status: 200 });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
    if (!token) {
      return NextResponse.json({ data: [], error: "Missing DUFFEL_KEY env var" }, { status: 500 });
    }

    const r = await fetch(
      `https://api.duffel.com/places/suggestions?name=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": "beta", // force beta for places
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* keep raw */ }

    const raw = Array.isArray(json?.data) ? json.data : [];
    const mapped = raw.map(toSuggestion).filter(Boolean) as Suggestion[];

    // Deduplicate by label
    const seen = new Set<string>();
    const data = mapped.filter(s => !seen.has(s.label) && seen.add(s.label));

    return NextResponse.json({ data, sourceStatus: r.status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { data: [], error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
