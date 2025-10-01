// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Server-only env: make sure this is set in Vercel project settings
const DUFFEL_KEY = process.env.DUFFEL_API_KEY || process.env.DUFFEL_TOKEN || "";

// Map Duffel suggestion to our shape
function mapDuffel(p: any) {
  const code = p?.iata_code || p?.iata_code_v1 || p?.iata || null;
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

// Fallback: Teleport city search -> top few cities
async function fallbackTeleport(q: string) {
  try {
    const u = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(q)}&limit=5`;
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json();
    const items = (j?._embedded?.["city:search-results"] || []).map((it: any) => {
      const name: string = it?.matching_full_name || it?.matching_alternate_names?.[0]?.name || "";
      return {
        code: undefined,
        name,
        city: name,
        country: undefined,
        label: name,
      };
    });
    return items;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ ok: true, data: [] }, { status: 200 });
  }

  // Debug banner in logs
  console.log("[/api/places] q=%s, duffelKey? %s", q, DUFFEL_KEY ? "yes" : "no");

  // Try Duffel first, if we have a key
  let duffelItems: any[] = [];
  if (DUFFEL_KEY) {
    try {
      const duffelUrl =
        `https://api.duffel.com/air/places/suggestions?` +
        `name=${encodeURIComponent(q)}&types[]=airport&types[]=city&limit=8`;

      const duffelRes = await fetch(duffelUrl, {
        headers: {
          Authorization: `Bearer ${DUFFEL_KEY}`,
          "Duffel-Version": "v2",          // IMPORTANT: v2, not "beta"
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const text = await duffelRes.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch {}

      console.log("[/api/places] Duffel status=%d ok=%s count=%s",
        duffelRes.status, String(duffelRes.ok),
        Array.isArray(json?.data) ? json.data.length : "n/a"
      );

      if (duffelRes.ok && Array.isArray(json?.data)) {
        duffelItems = json.data.map(mapDuffel).filter((x: any) => x?.label);
      } else {
        // Log the error payload to help debugging
        console.warn("[/api/places] Duffel error:", text?.slice(0, 500));
      }
    } catch (e: any) {
      console.error("[/api/places] Duffel fetch failed:", e?.message || String(e));
    }
  }

  // If Duffel produced results, return them
  if (duffelItems.length > 0) {
    return NextResponse.json({ ok: true, source: "duffel", data: duffelItems }, { status: 200 });
  }

  // Fallback to Teleport cities to avoid "No matches"
  const teleItems = await fallbackTeleport(q);
  console.log("[/api/places] Teleport count=%d", teleItems.length);

  return NextResponse.json(
    { ok: true, source: teleItems.length ? "teleport" : "empty", data: teleItems },
    { status: 200 }
  );
}
