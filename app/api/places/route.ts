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

const LOCAL_SEED: Place[] = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US", label: "BOS – Logan International Airport – Boston – US" },
  { code: "AUS", name: "Austin-Bergstrom International Airport", city: "Austin", country: "US", label: "AUS – Austin-Bergstrom – Austin – US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US", label: "MIA – Miami International Airport – Miami – US" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, source: "empty", data: [] });
  }

  const duffelKey = process.env.DUFFEL_KEY || process.env.DUFFEL_API_KEY || "";
  const duffelVersion = process.env.DUFFEL_VERSION || "v1";

  // Helper to normalize Duffel response to Place[]
  const mapDuffel = (j: any): Place[] =>
    Array.isArray(j?.data)
      ? j.data.map((p: any) => {
          const code = p.iata_code || p.iata_city_code || "";
          const name = p.name || p.city_name || p.subdivision_name || p.country_name || "";
          const city = p.city_name || undefined;
          const country = p.country_code || p.country_name || undefined;
          const label = `${code} – ${name}${city ? ` – ${city}` : ""}${country ? ` – ${country}` : ""}`;
          return { code, name, city, country, label };
        }).filter((x: Place) => x.code && x.name)
      : [];

  // Try Duffel suggestions first
  let duffelTried = false;
  try {
    if (duffelKey) {
      duffelTried = true;
      const params = new URLSearchParams();
      params.set("name", q);
      params.set("limit", "12");
      params.append("types[]", "airport");
      params.append("types[]", "city");

      const res = await fetch(`https://api.duffel.com/places/suggestions?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${duffelKey}`,
          "Duffel-Version": duffelVersion,
          Accept: "application/json",
        },
        // absolutely no caching here
        cache: "no-store",
      });

      // If Duffel returns OK, map and return
      if (res.ok) {
        const j = await res.json();
        const items = mapDuffel(j);
        if (items.length > 0) {
          return NextResponse.json({ ok: true, source: "duffel", data: items });
        }
      } else {
        // Surface version/permission issues to help debugging in /api/places
        const errBody = await res.text().catch(() => "");
        return NextResponse.json(
          {
            ok: true,
            source: "duffel-error",
            status: res.status,
            error: errBody,
            data: [],
          },
          { status: 200 },
        );
      }
    }
  } catch (e: any) {
    // swallow network errors and fall through to seed
  }

  // Fallback – simple local seed so the UI isn’t empty
  const qLower = q.toLowerCase();
  const seeded = LOCAL_SEED.filter(
    (p) =>
      p.code.toLowerCase().includes(qLower) ||
      p.name.toLowerCase().includes(qLower) ||
      (p.city?.toLowerCase() || "").includes(qLower),
  );

  return NextResponse.json({
    ok: true,
    source: duffelTried ? "local-seed (duffel empty)" : "local-seed",
    data: seeded,
  });
}
