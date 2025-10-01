// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* ---------- CORS helper ---------- */
function withCORS(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Duffel-Version");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}
export async function OPTIONS() {
  return withCORS(new Response(null, { status: 204 }));
}

/* ---------- Types & mapping ---------- */
type Suggestion = {
  code?: string;
  name: string;
  city?: string;
  country?: string;
  label: string;
};

function toSuggestion(p: any): Suggestion | null {
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

/* ---------- Handler ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const debug = searchParams.get("debug") === "1";
    if (!q) return withCORS(NextResponse.json({ data: [] }, { status: 200 }));

    const token = process.env.DUFFEL_KEY || process.env.DUFFEL_TOKEN;
    if (!token) {
      return withCORS(
        NextResponse.json({ data: [], error: "Missing DUFFEL_KEY env var" }, { status: 500 })
      );
    }

    // Duffel v2 (query=)
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
    try { json = text ? JSON.parse(text) : {}; } catch {}

    const raw = Array.isArray(json?.data) ? json.data : [];
    const seen = new Set<string>();
    const data = raw.map(toSuggestion).filter(Boolean)
      .filter((s: any) => !seen.has(s!.label) && seen.add(s!.label));

    if (!debug) return withCORS(NextResponse.json({ data }, { status: 200 }));
    return withCORS(
      NextResponse.json(
        { data, debug: { duffelStatus: r.status, duffelRaw: text.slice(0, 2000) } },
        { status: 200 }
      )
    );
  } catch (e: any) {
    return withCORS(
      NextResponse.json({ data: [], error: String(e?.message || e) }, { status: 500 })
    );
  }
}
