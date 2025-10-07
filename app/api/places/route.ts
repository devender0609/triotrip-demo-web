// app/api/places/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Place = { code: string; name: string; city?: string; country?: string; label: string };

function normalize(items: any[]): Place[] {
  return (items || [])
    .map((p) => {
      const code = p.iata_code ?? p.code ?? "";
      const name = p.name ?? "";
      const city = p.city_name ?? p.city ?? "";
      const country = p.iata_country_code ?? p.country_code ?? p.country ?? "";
      if (!code || !name) return null;
      return {
        code,
        name,
        city,
        country,
        label: `${code} — ${name}${city ? ` — ${city}` : ""}${country ? ` — ${country}` : ""}`,
      };
    })
    .filter(Boolean) as Place[];
}

const SEED: Place[] = [
  { code: "BOS", name: "Logan International Airport", city: "Boston", country: "US", label: "BOS — Logan International Airport — Boston — US" },
  { code: "AUS", name: "Austin–Bergstrom International Airport", city: "Austin", country: "US", label: "AUS — Austin–Bergstrom International — Austin — US" },
  { code: "MIA", name: "Miami International Airport", city: "Miami", country: "US", label: "MIA — Miami International Airport — Miami — US" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || searchParams.get("name") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, source: "empty", data: [] });

  const DUFFEL_KEY = process.env.DUFFEL_KEY || process.env.DUFFEL_API_KEY || "";
  if (!DUFFEL_KEY) {
    const needle = q.toLowerCase();
    const seeded = SEED.filter(
      (p) =>
        p.code.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle) ||
        (p.city ?? "").toLowerCase().includes(needle),
    );
    return NextResponse.json({ ok: true, source: "local-seed", data: seeded });
  }

  try {
    // ✅ Duffel v2 endpoint (NO /air), uses ?query=
    const url = new URL("https://api.duffel.com/places/suggestions");
    url.searchParams.set("query", q);
    // (Optional) You can still filter by type if you want, but it’s not required:
    // url.searchParams.append("types[]", "airport");
    // url.searchParams.append("types[]", "city");
    // url.searchParams.set("limit", "12");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${DUFFEL_KEY}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        {
          ok: true,
          source: "duffel-error",
          status: res.status,
          meta: { sentVersion: "v2", sentUrl: url.toString() },
          error: body,
          data: [],
        },
        { status: 200 }
      );
    }

    const json = await res.json().catch(() => ({}));
    const items = normalize(json?.data ?? []);
    return NextResponse.json({
      ok: true,
      source: "duffel",
      meta: { sentVersion: "v2", sentUrl: url.toString(), count: items.length },
      data: items,
    });
  } catch (e: any) {
    const needle = q.toLowerCase();
    const seeded = SEED.filter(
      (p) =>
        p.code.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle) ||
        (p.city ?? "").toLowerCase().includes(needle),
    );
    return NextResponse.json({
      ok: true,
      source: "local-seed",
      meta: { error: String(e?.message || e) },
      data: seeded,
    });
  }
}
