// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Suggestion = { code?: string; name: string; city?: string; country?: string; label: string };

function mapDuffel(p: any): Suggestion | null {
  if (!p) return null;
  const code =
    p.iata_code || p.code || (typeof p.id === "string" && p.id.length === 3 ? p.id : "") || "";
  const name =
    p.name || p.airport_name || p.city_name ||
    (p.city && (p.city.name || p.city.city_name)) || "";
  const city =
    p.city_name || (p.city && (p.city.name || p.city.city_name)) || p.municipality || "";
  const country =
    p.country_name || (p.country && (p.country.name || p.country.country_name)) || p.country || "";
  if (!name) return null;
  const label = (code ? `${code} — ` : "") + name +
    (city || country ? ` (${[city, country].filter(Boolean).join(", ")})` : "");
  return { code: code || undefined, name, city: city || undefined, country: country || undefined, label };
}
function mapTeleport(item: any): Suggestion | null {
  const full = item?.matching_full_name || "";
  if (!full) return null;
  const parts = full.split(",").map((s: string) => s.trim());
  return { name: parts[0] || full, city: parts[0], country: parts.at(-1), label: full };
}

async function duffel(q: string, token?: string) {
  if (!token) return { items: [] as Suggestion[], status: 0, raw: "" };
  const url = `https://api.duffel.com/places/suggestions?query=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Duffel-Version": "v2", Accept: "application/json" },
    cache: "no-store",
  });
  const text = await r.text();
  let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch {}
  const raw = Array.isArray(json?.data) ? json.data : [];
  const seen = new Set<string>();
  const items = raw.map(mapDuffel).filter(Boolean)
    .filter((s: any) => !seen.has(s!.label) && seen.add(s!.label)) as Suggestion[];
  return { items, status: r.status, raw: text.slice(0, 2000) };
}
async function teleport(q: string) {
  const r = await fetch(`https://api.teleport.org/api/cities/?search=${encodeURIComponent(q)}&limit=10`, { cache: "no-store" });
  const text = await r.text();
  if (!r.ok) return { items: [] as Suggestion[], status: r.status, raw: text.slice(0, 2000) };
  let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch {}
  const arr: any[] = json?._embedded?.["city:search-results"] || [];
  const seen = new Set<string>();
  const items = arr.map(mapTeleport).filter(Boolean)
    .filter((s: any) => !seen.has(s!.label) && seen.add(s!.label)) as Suggestion[];
  return { items, status: r.status, raw: `count=${items.length}` };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const debug = searchParams.get("debug") === "1";
    if (!q) return NextResponse.json({ data: [] }, { status: 200 });

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;

    let d = await duffel(q, token);
    let data = d.items;

    let t: { items: Suggestion[]; status: number; raw: string } | undefined;
    if (data.length === 0) {
      t = await teleport(q);
      data = t.items;
    }

    if (!debug) return NextResponse.json({ data }, { status: 200 });

    return NextResponse.json({
      data,
      debug: { duffelStatus: d.status, duffelRaw: d.raw, teleportTried: !!t, teleportStatus: t?.status, teleportRaw: t?.raw }
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: String(e?.message || e) }, { status: 500 });
  }
}
