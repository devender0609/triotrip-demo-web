// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- helpers ----------
type Place = { code: string; name: string; city: string; country?: string };
type Out = { ok: boolean; source: string; data: Array<Place & { label: string }>; meta?: any };

const DUFFEL_KEY = process.env.DUFFEL_KEY ?? "";
const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "v1"; // ← IMPORTANT: use "v1"

// Nice, small fallback so the UI never looks “dead”
const LOCAL_SEED: Place[] = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US" },
  { code: "AUS", name: "Austin–Bergstrom International Airport", city: "Austin", country: "US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US" },
  { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "US" },
  { code: "SFO", name: "San Francisco International Airport", city: "San Francisco", country: "US" },
  { code: "LHR", name: "Heathrow Airport", city: "London", country: "GB" }
];

function toLabel(p: Place) {
  return `${p.code} — ${p.name} — ${p.city}${p.country ? ` — ${p.country}` : ""}`;
}

function filterLocalSeed(term: string) {
  const t = term.toLowerCase();
  return LOCAL_SEED.filter(
    (p) =>
      p.code.toLowerCase().includes(t) ||
      p.city.toLowerCase().includes(t) ||
      p.name.toLowerCase().includes(t)
  )
    .slice(0, 12)
    .map((p) => ({ ...p, label: toLabel(p) }));
}

// ---------- GET /api/places?q=bos ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = searchParams.get("q") || "";
  const q = qRaw.trim();

  const meta: any = {
    hasDuffelKey: Boolean(DUFFEL_KEY),
    duffelTried: false,
    duffelStatus: undefined as number | undefined,
    duffelCount: 0,
    teleportTried: false,
    teleportCount: 0
  };

  // very short queries → cheap local seed
  if (q.length < 2) {
    return NextResponse.json<Out>({
      ok: true,
      source: "empty",
      data: []
    });
  }

  // 1) Duffel (primary)
  if (DUFFEL_KEY) {
    meta.duffelTried = true;
    try {
      const url =
        "https://api.duffel.com/places/suggestions?" +
        new URLSearchParams({
          name: q,
          limit: "12",
          "types[]": "airport",
          "types[]": "city"
        }).toString();

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${DUFFEL_KEY}`,
          Accept: "application/json",
          "Duffel-Version": DUFFEL_VERSION // ← must be "v1"
        },
        // ensure edge compatibility
        cache: "no-store"
      });

      meta.duffelStatus = res.status;

      if (res.ok) {
        const json: any = await res.json();
        const items = (json?.data || []).map((d: any) => {
          const code = d?.iata_code || d?.iata_city_code || d?.id || "";
          const name = d?.name || d?.municipality_name || d?.type || "";
          const city = d?.city?.name || d?.city_name || d?.iata_city_code || "";
          const country = d?.city?.country_code || d?.country_code || "";
          const p: Place = { code, name, city, country };
          return { ...p, label: toLabel(p) };
        }).filter((x: any) => x.code && x.name);

        meta.duffelCount = items.length;

        if (items.length > 0) {
          return NextResponse.json<Out>({
            ok: true,
            source: "duffel",
            data: items,
            meta
          });
        }
      } else {
        // keep the error string for debugging in /api/places
        meta.duffelError = await res.text().catch(() => "");
      }
    } catch (e: any) {
      meta.duffelError = String(e?.message || e);
    }
  }

  // 2) Teleport (secondary; coarse grain city list)
  try {
    meta.teleportTried = true;
    const resp = await fetch(
      "https://api.teleport.org/api/cities/?limit=10&search=" + encodeURIComponent(q),
      { cache: "no-store" }
    );
    if (resp.ok) {
      const j: any = await resp.json();
      const items = (j?._embedded?.["city:search-results"] || []).map((r: any) => {
        const match = r?.matching_full_name || "";
        // Try to synthesize a code from airport-like bits if present, otherwise use city name
        const city = match.split(",")[0] || match;
        const p: Place = { code: city.slice(0, 3).toUpperCase(), name: city, city };
        return { ...p, label: toLabel(p) };
      });
      meta.teleportCount = items.length;

      if (items.length > 0) {
        return NextResponse.json<Out>({ ok: true, source: "teleport", data: items, meta });
      }
    }
  } catch {
    // ignore teleport errors
  }

  // 3) Local seed fallback so UI is never empty
  const seeded = filterLocalSeed(q);
  return NextResponse.json<Out>({
    ok: true,
    source: "local-seed",
    data: seeded,
    meta
  });
}
