import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Suggestion = {
  code: string;
  name: string;
  city: string;
  country: string;
  label: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json<Suggestion[]>([]);

    const url = `https://api.duffel.com/air/places/suggestions?query=${encodeURIComponent(q)}&limit=10`;

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_KEY ?? ""}`,
        "Duffel-Version": process.env.DUFFEL_VERSION ?? "v2",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!r.ok) throw new Error(String(r.status));

    const j = await r.json();
    const items: Suggestion[] = (j?.data ?? [])
      .filter((p: any) => p.iata_code && (p.type === "airport" || p.type === "city"))
      .map((p: any) => {
        const code = p.iata_code;
        const name = p.name || p.airport_name || p.city_name || "";
        const city = p.city?.name || p.city_name || p.municipality_name || "";
        const country =
          p.country?.name || p.country_name || p.address?.country_code || "";
        const label = `${code} — ${name}${city ? ` (${city}` : ""}${country ? `, ${country}` : ""}${city ? ")" : ""}`;
        return { code, name, city, country, label };
      });

    return NextResponse.json(items);
  } catch {
    // Safe fallback so UI still works
    return NextResponse.json<Suggestion[]>([
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
        code: "LHR",
        name: "Heathrow",
        city: "London",
        country: "UK",
        label: "LHR — Heathrow (London, UK)",
      },
    ]);
  }
}
