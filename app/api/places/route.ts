// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Place = { code: string; name: string; city?: string; country?: string; label: string };

const LOCAL_SEED: Place[] = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US", label: "BOS — Logan International Airport — Boston — US" },
  { code: "AUS", name: "Austin-Bergstrom International Airport", city: "Austin", country: "US", label: "AUS — Austin-Bergstrom International — Austin — US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US", label: "MIA — Miami International Airport — Miami — US" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ ok: true, source: "empty", data: [] });
  }

  // Force v1 regardless of env (your env is still beta somewhere).
  const DUFFEL_KEY = process.env.DUFFEL_KEY || process.env.DUFFEL_API_KEY || "";
  const DUFFEL_VERSION = "v1";

  // Map Duffel -> UI
  const mapDuffel = (j: any): Place[] =>
    Array.isArray(j?.data)
      ? j.data
          .map((p: any) => {
            const code = p.iata_code || p.iata_city_code || "";
            const name = p.name || p.city_name || p.subdivision_name || p.country_name || "";
            const city = p.city_name || undefined;
            const country = p.country_code || p.country_name || undefined;
            const label = `${code} — ${name}${city ? ` — ${city}` : ""}${country ? ` — ${country}` : ""}`;
            return { code, name, city, country, label };
          })
          .filter((x: Place) => x.code && x.name)
      : [];

  // Try Duffel first
  if (DUFFEL_KEY) {
    try {
      const qs = new URLSearchParams();
      qs.set("name", q);
      qs.set("limit", "12");
      qs.append("types[]", "airport");
      qs.append("types[]", "city");

      const url = `https://api.duffel.com/places/suggestions?${qs.toString()}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${DUFFEL_KEY}`,
          "Duffel-Version": DUFFEL_VERSION, // <- forced v1
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const j = await res.json();
        const items = mapDuffel(j);
        return NextResponse.json({
          ok: true,
          source: "duffel",
          meta: { sentVersion: DUFFEL_VERSION, count: items.length },
          data: items,
        });
      } else {
        const errorText = await res.text().catch(() => "");
        return NextResponse.json({
          ok: true,
          source: "duffel-error",
          status: res.status,
          meta: { sentVersion: DUFFEL_VERSION },
          error: errorText,
          data: [],
        });
      }
    } catch (e: any) {
      // fall through to seed
      // eslint-disable-next-line no-console
      console.error("Duffel fetch failed:", e?.message || e);
    }
  }

  // Fallback local matches so UI still shows something
  const needle = q.toLowerCase();
  const seeded = LOCAL_SEED.filter(
    (p) =>
      p.code.toLowerCase().includes(needle) ||
      p.name.toLowerCase().includes(needle) ||
      (p.city?.toLowerCase() || "").includes(needle)
  );

  return NextResponse.json({
    ok: true,
    source: "local-seed",
    data: seeded,
  });
}