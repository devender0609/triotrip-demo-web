// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Place = {
  code: string;
  name: string;
  city?: string;
  country?: string;
  label: string;
};

// very small local seed — only used as a fallback
const seed: Place[] = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US", label: "BOS – Logan International Airport – Boston – US" },
  { code: "AUS", name: "Austin–Bergstrom International", city: "Austin", country: "US", label: "AUS – Austin–Bergstrom International – Austin – US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US", label: "MIA – Miami International Airport – Miami – US" },
];

function ok(data: Place[], extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, source: extra.source ?? "duffel", data, meta: extra.meta }, { status: 200 });
}

function cors() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Duffel-Version",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function OPTIONS() {
  return cors();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("name") || "").trim();

  if (!q) {
    return ok([], { source: "empty" });
  }

  const DUFFEL_KEY = process.env.DUFFEL_KEY || process.env.DUFFEL_API_KEY || "";
  const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "v1";

  // If no key, return filtered seed immediately
  if (!DUFFEL_KEY) {
    const filtered = seed.filter((p) =>
      [p.code, p.name, p.city].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
    );
    return ok(filtered.slice(0, 12), { source: "local-seed", meta: { hasDuffelKey: false } });
  }

  try {
    // Build query with repeated keys using URLSearchParams.append
    const params = new URLSearchParams();
    params.set("name", q);
    params.set("limit", "12");
    params.append("types[]", "airport");
    params.append("types[]", "city");

    const url = `https://api.duffel.com/places/suggestions?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${DUFFEL_KEY}`,
        "Duffel-Version": DUFFEL_VERSION, // <-- ensure this is 'v1' in Vercel
        Accept: "application/json",
      },
      // don't cache suggestions in edge/network
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // fall back to local seed on error
      const filtered = seed.filter((p) =>
        [p.code, p.name, p.city].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
      );
      return ok(filtered.slice(0, 12), {
        source: "local-seed",
        meta: {
          hasDuffelKey: true,
          duffelTried: true,
          duffelStatus: res.status,
          duffelError: text || res.statusText,
        },
      });
    }

    const json = (await res.json()) as {
      data?: Array<{
        name?: string;
        iata_code?: string;
        city_name?: string;
        country_code?: string;
      }>;
    };

    const data: Place[] =
      (json.data || []).map((it) => ({
        code: it.iata_code || "",
        name: it.name || "",
        city: it.city_name || "",
        country: it.country_code || "",
        label: `${it.iata_code ?? ""} – ${it.name ?? ""}${it.city_name ? " – " + it.city_name : ""}${it.country_code ? " – " + it.country_code : ""}`,
      })).filter((p) => p.code && p.name) // keep only valid entries
       .slice(0, 12);

    return ok(data, {
      source: "duffel",
      meta: { hasDuffelKey: true, duffelTried: true, duffelCount: data.length },
    });
  } catch (err: any) {
    // network/JSON failover to seed
    const filtered = seed.filter((p) =>
      [p.code, p.name, p.city].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
    );
    return ok(filtered.slice(0, 12), {
      source: "local-seed",
      meta: { hasDuffelKey: !!process.env.DUFFEL_KEY, duffelTried: true, error: String(err?.message || err) },
    });
  }
}
