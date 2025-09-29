// app/api/airports/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Suggestion = {
  code: string;   // IATA
  name: string;   // Airport or city name
  city: string;
  country: string;
  label: string;  // e.g. "AUS — Austin-Bergstrom International (Austin, US)"
};

/** Small local fallback so the UI keeps working without Duffel */
const LOCAL: Suggestion[] = [
  {
    code: "AUS",
    name: "Austin-Bergstrom International",
    city: "Austin",
    country: "US",
    label: "AUS — Austin-Bergstrom International (Austin, US)",
  },
  {
    code: "SFO",
    name: "San Francisco International",
    city: "San Francisco",
    country: "US",
    label: "SFO — San Francisco International (San Francisco, US)",
  },
  {
    code: "JFK",
    name: "John F. Kennedy International",
    city: "New York",
    country: "US",
    label: "JFK — John F. Kennedy International (New York, US)",
  },
  {
    code: "LHR",
    name: "Heathrow",
    city: "London",
    country: "UK",
    label: "LHR — Heathrow (London, UK)",
  },
  {
    code: "CDG",
    name: "Charles de Gaulle",
    city: "Paris",
    country: "FR",
    label: "CDG — Charles de Gaulle (Paris, FR)",
  },
  {
    code: "DXB",
    name: "Dubai International",
    city: "Dubai",
    country: "AE",
    label: "DXB — Dubai International (Dubai, AE)",
  },
];

function toJSON(data: Suggestion[]) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q || q.length < 2) {
    return toJSON([]);
  }

  // If we have a Duffel key, try live suggestions first
  const key = process.env.DUFFEL_KEY ?? "";
  if (key) {
    try {
      const url =
        "https://api.duffel.com/air/places/suggestions?" +
        new URLSearchParams({
          query: q,
          limit: "10",
        }).toString();

      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          "Duffel-Version": process.env.DUFFEL_VERSION ?? "v2",
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (r.ok) {
        const j = await r.json().catch(() => null);
        const items: Suggestion[] = (j?.data ?? [])
          .filter(
            (p: any) => p?.iata_code && (p?.type === "airport" || p?.type === "city")
          )
          .map((p: any) => {
            const code = p.iata_code;
            const name = p.name || p.airport_name || p.city_name || "";
            const city = p.city?.name || p.city_name || p.municipality_name || "";
            const country =
              p.country?.name ||
              p.country_name ||
              p.address?.country_code ||
              "";
            const label = `${code} — ${name}${city ? ` (${city}` : ""}${
              country ? `, ${country}` : ""
            }${city ? ")" : ""}`;
            return { code, name, city, country, label };
          });

        return toJSON(items);
      }
      // fall through to local if Duffel returns non-OK
    } catch {
      // fall through to local
    }
  }

  // Local fallback search (case-insensitive, matches code/name/city)
  const qLower = q.toLowerCase();
  const local = LOCAL.filter(
    (a) =>
      a.code.toLowerCase().includes(qLower) ||
      a.name.toLowerCase().includes(qLower) ||
      a.city.toLowerCase().includes(qLower)
  ).slice(0, 10);

  return toJSON(local);
}
