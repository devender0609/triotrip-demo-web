import { NextRequest, NextResponse } from "next/server";

type Payload = {
  origin: string; destination: string; depart: string; returnDate?: string | null;
  hotel?: boolean; nights?: number; travelers: number;
  cabin_class?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  bags?: number; max_stops?: number; budgetMin?: number; budgetMax?: number;
  hotelStarsMin?: number; mode?: "best" | "cheapest" | "fastest" | "flexible";
};

export async function POST(req: NextRequest) {
  const q = (await req.json()) as Payload;

  const carriers = ["Delta","United","American","Alaska","JetBlue","Frontier"];
  const hotels   = ["City Inn","Grand Plaza","Riverside Suites","Skyline Hotel","Maple Stay","Lakeview"];
  const nights   = q.nights ?? 2;
  const bags     = q.bags ?? 0;

  const results = Array.from({ length: 6 }).map((_, i) => {
    const duration     = 140 + i * 25;
    const base_price   = 220 + i * 40;
    const nightly_rate = 70  + i * 15;
    const taxes        = 12  + i * 3;
    const bag_fee      = 35  * bags;

    const flight = {
      id: `F${i + 1}`,
      carrier: carriers[i % carriers.length],
      origin: q.origin,
      destination: q.destination,
      duration_minutes: duration,
      base_price,
      bag_fees: { checked: bag_fee }
    };

    const hotel = q.hotel ? {
      id: `H${i + 1}`,
      name: hotels[i % hotels.length],
      nights,
      nightly_rate,
      taxes_fees_total: taxes,
      rating: 3 + (i % 3),
      refundable: i % 2 === 0,
      city: q.destination
    } : undefined;

    const total_cost = base_price + bag_fee + (hotel ? nights * nightly_rate + taxes : 0);
    return { id: `demo-${i + 1}`, flight, hotel, total_cost, duration };
  });

  const mode = q.mode || "best";
  results.sort((a, b) => {
    if (mode === "cheapest") return a.total_cost - b.total_cost;
    if (mode === "fastest")  return a.duration   - b.duration;
    return (a.total_cost + a.duration / 10) - (b.total_cost + b.duration / 10);
  });

  return NextResponse.json({ results });
}
