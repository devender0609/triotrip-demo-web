// app/api/airports/route.ts
import { NextResponse } from "next/server";

// Worldwide airport dataset (public GitHub). We cache it in-memory on first request.
const DATA_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

type Airport = {
  iata?: string;
  icao?: string;
  name?: string;
  city?: string;
  country?: string;
  // many more fields exist in the source, we only use these
};

let cache: Record<string, Airport> | null = null;
let cacheAt = 0;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function getData(): Promise<Record<string, Airport>> {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const r = await fetch(DATA_URL, { next: { revalidate: 0 }, cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load airports dataset");
  cache = (await r.json()) as Record<string, Airport>;
  cacheAt = Date.now();
  return cache!;
}

function norm(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = norm(searchParams.get("q") || "");
    const max = Number(searchParams.get("limit") || 12);

    const data = await getData();
    const items: {
      code: string;
      label: string;
      city?: string;
      name?: string;
      country?: string;
    }[] = [];

    for (const key in data) {
      const a = data[key];
      const code = (a.iata || a.icao || "").toUpperCase();
      const city = a.city || "";
      const name = a.name || "";
      const country = a.country || "";

      // Filter out entries without a 3-letter IATA (prefer IATA for booking)
      if (!a.iata || a.iata.length !== 3) continue;

      if (!q) {
        // No query: just collect popular-ish airports first (heuristic: big cities by name length)
        items.push({
          code: a.iata.toUpperCase(),
          label: `${a.iata.toUpperCase()} — ${city ? city + " — " : ""}${name}`,
          city,
          name,
          country,
        });
      } else {
        const sCode = norm(code);
        const sCity = norm(city);
        const sName = norm(name);
        const sCountry = norm(country);

        let score = 0;
        if (sCode.startsWith(q)) score += 10;
        if (sCode.includes(q)) score += 5;
        if (sCity.startsWith(q)) score += 8;
        if (sCity.includes(q)) score += 4;
        if (sName.startsWith(q)) score += 6;
        if (sName.includes(q)) score += 3;
        if (sCountry.startsWith(q)) score += 1;

        if (score > 0) {
          items.push({
            code: a.iata.toUpperCase(),
            label: `${a.iata.toUpperCase()} — ${city ? city + " — " : ""}${name}`,
            city,
            name,
            country,
          });
        }
      }
    }

    // sort by best score/alpha-ish
    const nq = norm(q);
    items.sort((A, B) => {
      const a = A.label.toLowerCase();
      const b = B.label.toLowerCase();
      const aStarts = a.startsWith(nq) ? 1 : 0;
      const bStarts = b.startsWith(nq) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return a.localeCompare(b);
    });

    return NextResponse.json({ results: items.slice(0, max) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Airport search failed" }, { status: 500 });
  }
}
