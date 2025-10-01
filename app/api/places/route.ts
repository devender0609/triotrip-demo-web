import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Read YOUR var name first (you said it's DUFFEL_KEY)
const DUFFEL =
  process.env.DUFFEL_KEY ||
  process.env.DUFFEL_API_KEY ||
  process.env.DUFFEL_TOKEN ||
  "";

// Map Duffel suggestion -> UI shape
function mapDuffel(p: any) {
  const code = p?.iata_code || p?.iata || null;
  const city = p?.city?.name || p?.city_name || p?.city || "";
  const country = p?.country_name || p?.country || p?.country?.name || "";
  const name = p?.name || p?.airport_name || p?.full_name || "";
  const parts = [code, name, city, country].filter(Boolean);
  return {
    code: code || undefined,
    name: name || city || "",
    city: city || undefined,
    country: country || undefined,
    label: parts.length ? parts.join(" — ") : (code || name || city || "Unknown"),
  };
}

async function fallbackTeleport(q: string) {
  try {
    const u = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(q)}&limit=6`;
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json();
    const items = (j?._embedded?.["city:search-results"] || []).map((it: any) => {
      const name: string =
        it?.matching_full_name ||
        it?.matching_alternate_names?.[0]?.name ||
        it?.matching_city ||
        "";
      const label = name || "Unknown city";
      return { code: undefined, name: label, city: label, country: undefined, label };
    });
    return items;
  } catch {
    return [];
  }
}

// Absolute last-resort local seed so UI isn’t blank while configuring env
function fallbackLocal(q: string) {
  const seed = [
    { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US" },
    { code: "AUS", name: "Austin-Bergstrom International Airport", city: "Austin", country: "US" },
    { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US" },
    { code: "SFO", name: "San Francisco International Airport", city: "San Francisco", country: "US" },
    { code: "LHR", name: "Heathrow Airport", city: "London", country: "UK" },
  ];
  const term = q.toLowerCase();
  return seed
    .filter(
      (x) =>
        x.code.toLowerCase().includes(term) ||
        x.city.toLowerCase().includes(term) ||
        x.name.toLowerCase().includes(term)
    )
    .map((x) => ({
      ...x,
      label: [x.code, x.name, x.city, x.country].filter(Boolean).join(" — "),
    }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const diag = url.searchParams.get("diag"); // add &diag=1 to see meta in response

  if (!q) {
    return NextResponse.json({ ok: true, source: "empty", data: [] }, { status: 200 });
  }

  const meta: any = {
    hasDuffelKey: Boolean(DUFFEL),
    duffelTried: false,
    duffelStatus: null as null | number,
    duffelCount: 0,
    duffelError: null as null | string,
    teleportTried: false,
    teleportCount: 0,
  };

  // 1) Duffel (if key present)
  let duffelItems: any[] = [];
  if (DUFFEL) {
    meta.duffelTried = true;
    try {
      const duffelUrl =
        `https://api.duffel.com/air/places/suggestions?` +
        `name=${encodeURIComponent(q)}&types[]=airport&types[]=city&limit=8`;

      const res = await fetch(duffelUrl, {
        headers: {
          Authorization: `Bearer ${DUFFEL}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      meta.duffelStatus = res.status;

      const raw = await res.text();
      let json: any = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch {}

      if (res.ok && Array.isArray(json?.data)) {
        duffelItems = json.data.map(mapDuffel).filter((x: any) => x?.label);
        meta.duffelCount = duffelItems.length;
      } else {
        meta.duffelError = raw?.slice(0, 300) || "Duffel non-OK";
      }
    } catch (e: any) {
      meta.duffelError = e?.message || String(e);
    }
  }

  if (duffelItems.length > 0) {
    return NextResponse.json(
      { ok: true, source: "duffel", data: duffelItems, ...(diag ? { meta } : {}) },
      { status: 200 }
    );
  }

  // 2) Teleport fallback
  meta.teleportTried = true;
  const tele = await fallbackTeleport(q);
  meta.teleportCount = tele.length;

  if (tele.length > 0) {
    return NextResponse.json(
      { ok: true, source: "teleport", data: tele, ...(diag ? { meta } : {}) },
      { status: 200 }
    );
  }

  // 3) Local seed (last resort so UI shows *something*)
  const seeded = fallbackLocal(q);
  if (seeded.length > 0) {
    return NextResponse.json(
      { ok: true, source: "local-seed", data: seeded, ...(diag ? { meta } : {}) },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { ok: true, source: "empty", data: [], ...(diag ? { meta } : {}) },
    { status: 200 }
  );
}
