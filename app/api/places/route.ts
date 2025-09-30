import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Suggestion = {
  code?: string;   // IATA (may be missing for city-only results)
  name: string;
  city?: string;
  country?: string;
  label: string;
};

function toSuggestionFromDuffel(p: any): Suggestion | null {
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

  return { code: code || undefined, name, city: city || undefined, country: country || undefined, label };
}

function toSuggestionFromTeleport(item: any): Suggestion | null {
  const full = item?.matching_full_name || "";
  if (!full) return null;
  const parts = String(full).split(",").map((s) => s.trim());
  const name = parts[0] || full;
  const city = parts[0] || undefined;
  const country = parts[parts.length - 1] || undefined;
  return { name, city, country, label: full };
}

async function queryDuffel(q: string, token?: string): Promise<Suggestion[]> {
  if (!token) return [];
  const url =
    `https://api.duffel.com/places/suggestions` +
    `?name=${encodeURIComponent(q)}` +
    `&types[]=airport&types[]=city&limit=10`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "beta",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const j = await r.json().catch(() => ({} as any));
  const raw = Array.isArray(j?.data) ? j.data : [];
  const mapped = raw.map(toSuggestionFromDuffel).filter(Boolean) as Suggestion[];

  const seen = new Set<string>();
  return mapped.filter((s) => !seen.has(s.label) && seen.add(s.label));
}

async function queryTeleport(q: string): Promise<Suggestion[]> {
  const r = await fetch(
    `https://api.teleport.org/api/cities/?search=${encodeURIComponent(q)}&limit=10`,
    { cache: "no-store" }
  );
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({} as any));
  const matches: any[] = j?._embedded?.["city:search-results"] || [];
  const mapped = matches.map(toSuggestionFromTeleport).filter(Boolean) as Suggestion[];
  const seen = new Set<string>();
  return mapped.filter((s) => !seen.has(s.label) && seen.add(s.label));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 1) return NextResponse.json({ data: [] }, { status: 200 });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;

    // 1) Try Duffel first
    let data: Suggestion[] = [];
    try { data = await queryDuffel(q, token); } catch {}

    // 2) Fallback to public city search if empty
    if (data.length === 0) {
      try { data = await queryTeleport(q); } catch {}
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: String(e?.message || e) }, { status: 500 });
  }
}
