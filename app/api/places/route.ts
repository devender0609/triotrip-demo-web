// app/api/places/route.ts
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

function toSuggestionFromDuffel(p: any): Suggestion | null {
  if (!p) return null;

  const code =
    p.iata_code || p.code ||
    (typeof p.id === "string" && p.id.length === 3 ? p.id : "") || "";

  const name =
    p.name || p.airport_name || p.city_name ||
    (p.city && (p.city.name || p.city.city_name)) || "";

  const city =
    p.city_name || (p.city && (p.city.name || p.city.city_name)) ||
    p.municipality || "";

  const country =
    p.country_name || (p.country && (p.country.name || p.country.country_name)) ||
    p.country || "";

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

async function queryDuffelV2(q: string, token?: string) {
  if (!token) return { items: [] as Suggestion[], status: 0, raw: "" };

  const url = `https://api.duffel.com/places/suggestions?query=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* keep text */ }

  const rawList = Array.isArray(json?.data) ? json.data : [];
  const mapped = rawList.map(toSuggestionFromDuffel).filter(Boolean) as Suggestion[];
  const seen = new Set<string>();
  const items = mapped.filter((s) => !seen.has(s.label) && seen.add(s.label));

  return { items, status: r.status, raw: text.slice(0, 2000) }; // truncate raw
}

async function queryTeleport(q: string) {
  const r = await fetch(
    `https://api.teleport.org/api/cities/?search=${encodeURIComponent(q)}&limit=10`,
    { cache: "no-store" }
  );
  if (!r.ok) return { items: [] as Suggestion[], status: r.status, raw: await r.text() };

  const j = await r.json().catch(() => ({} as any));
  const matches: any[] = j?._embedded?.["city:search-results"] || [];
  const mapped = matches.map(toSuggestionFromTeleport).filter(Boolean) as Suggestion[];
  const seen = new Set<string>();
  const items = mapped.filter((s) => !seen.has(s.label) && seen.add(s.label));
  return { items, status: r.status, raw: JSON.stringify({ count: items.length }) };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const debug = searchParams.get("debug") === "1";
    if (q.length < 1) return NextResponse.json({ data: [] }, { status: 200 });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;

    // 1) Try Duffel v2
    let duffel = await queryDuffelV2(q, token);
    let data = duffel.items;

    // 2) Fallback to Teleport if empty
    let teleport: { items: Suggestion[]; status: number; raw: string } | undefined;
    if (data.length === 0) {
      teleport = await queryTeleport(q);
      data = teleport.items;
    }

    // Normal response
    if (!debug) return NextResponse.json({ data }, { status: 200 });

    // Debug response adds upstream info (no secrets)
    return NextResponse.json(
      {
        data,
        debug: {
          duffelStatus: duffel.status,
          duffelRaw: duffel.raw,
          teleportStatus: teleport?.status,
          teleportRaw: teleport?.raw,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ data: [], error: String(e?.message || e) }, { status: 500 });
  }
}
