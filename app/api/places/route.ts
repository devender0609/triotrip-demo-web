// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** very small “always works” seed so the UI never feels empty while we debug */
const LOCAL_SEED = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US" },
  { code: "AUS", name: "Austin–Bergstrom International Airport", city: "Austin", country: "US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US" },
];

type DuffelPlace =
  | { iata_code?: string; name?: string; city_name?: string; country?: string; type?: string }
  | { code?: string; name?: string; city?: string; country?: string; type?: string };

function normalize(items: DuffelPlace[]) {
  return items
    .map((p) => {
      const code = (p as any).iata_code ?? (p as any).code ?? "";
      const name = p.name ?? "";
      const city = (p as any).city_name ?? (p as any).city ?? "";
      const country = p.country ?? "";
      if (!code || !name) return null;
      return {
        code,
        name,
        city,
        country,
        label: `${code} — ${name}${city ? ` — ${city}` : ""}${country ? ` — ${country}` : ""}`,
      };
    })
    .filter(Boolean) as Array<{ code: string; name: string; city: string; country: string; label: string }>;
}

async function tryDuffel(query: string, version: string, url: URL, extraHeaders?: HeadersInit) {
  const headers: HeadersInit = {
    Authorization: `Bearer ${process.env.DUFFEL_KEY ?? ""}`,
    "Duffel-Version": version,
    Accept: "application/json",
    ...(extraHeaders || {}),
  };

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  const status = res.status;
  const text = await res.text().catch(() => "");
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  // Duffel commonly returns 200 with {data:[...]} (v1) or {data:[...]} (v2).
  let data: any[] = [];
  if (json?.data && Array.isArray(json.data)) data = json.data;

  return { status, json, data, sentVersion: version, sentUrl: url.toString() };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || u.searchParams.get("name") || "").trim();
  if (!q) {
    return NextResponse.json({ ok: true, source: "empty", data: [] });
  }

  const hasDuffelKey = !!process.env.DUFFEL_KEY;

  // Build several candidates that cover v2 & v1 shapes and param names
  const candidates: Array<{ version: string; url: URL }> = [];
  const qEnc = encodeURIComponent(q);

  // v2 (documented) – endpoint usually lives under /air/
  candidates.push({
    version: process.env.DUFFEL_VERSION || "v2",
    url: new URL(`https://api.duffel.com/air/places/suggestions?query=${qEnc}&types[]=airport&types[]=city&limit=12`),
  });

  // v2 alternate: some accounts accept ?name=
  candidates.push({
    version: process.env.DUFFEL_VERSION || "v2",
    url: new URL(`https://api.duffel.com/air/places/suggestions?name=${qEnc}&types[]=airport&types[]=city&limit=12`),
  });

  // v1 legacy (no /air prefix)
  candidates.push({
    version: "v1",
    url: new URL(`https://api.duffel.com/places/suggestions?name=${qEnc}&types[]=airport&types[]=city&limit=12`),
  });

  // last resort – old beta (only if someone still has env=beta)
  candidates.push({
    version: "beta",
    url: new URL(`https://api.duffel.com/places/suggestions?name=${qEnc}&types[]=airport&types[]=city&limit=12`),
  });

  let firstGood: { status: number; json: any; data: any[]; sentVersion: string; sentUrl: string } | null = null;
  let lastError: any = null;
  let tries: any[] = [];

  if (hasDuffelKey) {
    for (const cand of candidates) {
      try {
        const r = await tryDuffel(q, cand.version, cand.url);
        tries.push({ status: r.status, sentVersion: r.sentVersion, url: r.sentUrl, count: r.data?.length ?? 0 });
        if (r.status >= 200 && r.status < 300 && Array.isArray(r.data)) {
          firstGood = r;
          break;
        }
        lastError = r.json || r.status;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }
  }

  // Prefer Duffel if it worked
  if (firstGood && Array.isArray(firstGood.data) && firstGood.data.length > 0) {
    return NextResponse.json({
      ok: true,
      source: "duffel",
      data: normalize(firstGood.data),
      meta: {
        hasDuffelKey,
        tries,
        duffelVersionPicked: firstGood.sentVersion,
      },
    });
  }

  // Fallback: a filtered local seed so the UI remains responsive
  const lc = q.toLowerCase();
  const seeded = LOCAL_SEED.filter(
    (p) =>
      p.code.toLowerCase().includes(lc) ||
      p.city.toLowerCase().includes(lc) ||
      p.name.toLowerCase().includes(lc),
  );

  return NextResponse.json({
    ok: true,
    source: "local-seed",
    data: normalize(seeded),
    meta: {
      hasDuffelKey,
      duffelTried: hasDuffelKey,
      duffelStatus: firstGood?.status ?? (lastError ? 400 : 0),
      duffelError: lastError ? JSON.stringify(lastError) : undefined,
      tries,
    },
  });
}
