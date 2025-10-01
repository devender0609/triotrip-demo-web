// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Read your key exactly as you set it in Vercel: DUFFEL_KEY=duffel_test_...
// Also allow a few alternates so it works if you ever rename it.
const DUFFEL =
  process.env.DUFFEL_KEY ||
  process.env.DUFFEL_API_KEY ||
  process.env.DUFFEL_TOKEN ||
  "";

// Normalize Duffel suggestion into our UI shape
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

// Fallback: Teleport city suggestions so the UI never shows empty purely due to Duffel
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
  } catch (e: any) {
    console.warn("[/api/places] Teleport fetch failed:", e?.message || String(e));
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ ok: true, source: "empty", data: [] }, { status: 200 });
  }

  console.log("[/api/places] q=%s, hasDuffelKey=%s", q, DUFFEL ? "yes" : "no");

  // Try Duffel first if we have a key
  let duffelItems: any[] = [];
  if (DUFFEL) {
    try {
      const duffelUrl =
        `https://api.duffel.com/air/places/suggestions?` +
        `name=${encodeURIComponent(q)}&types[]=airport&types[]=city&limit=8`;

      const duffelRes = await fetch(duffelUrl, {
        headers: {
          Authorization: `Bearer ${DUFFEL}`,
          "Duffel-Version": "v2", // IMPORTANT: use v2 (not "beta")
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const raw = await duffelRes.text(); // safe for logging
      let json: any = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch {}

      console.log(
        "[/api/places] Duffel status=%d ok=%s count=%s",
        duffelRes.status,
        String(duffelRes.ok),
        Array.isArray(json?.data) ? json.data.length : "n/a"
      );

      if (duffelRes.ok && Array.isArray(json?.data)) {
        duffelItems = json.data.map(mapDuffel).filter((x: any) => x?.label);
      } else {
        console.warn("[/api/places] Duffel error body:", raw?.slice(0, 400));
      }
    } catch (e: any) {
      console.error("[/api/places] Duffel fetch failed:", e?.message || String(e));
    }
  }

  if (duffelItems.length > 0) {
    return NextResponse.json({ ok: true, source: "duffel", data: duffelItems }, { status: 200 });
  }

  // Fallback to Teleport so typing always yields suggestions
  const tele = await fallbackTeleport(q);
  console.log("[/api/places] Teleport count=%d", tele.length);

  return NextResponse.json(
    { ok: true, source: tele.length ? "teleport" : "empty", data: tele },
    { status: 200 }
  );
}
