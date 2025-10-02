// app/api/search/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SortKey = "best" | "cheapest" | "fastest" | "flexible";

type SearchPayload = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  roundTrip: boolean;

  passengers: number;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  passengersChildrenAges?: number[];

  cabin: Cabin;

  includeHotel: boolean;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  nights?: number;
  minHotelStar?: number;

  minBudget?: number;
  maxBudget?: number;
  currency: string;
  sort: SortKey;
  maxStops?: 0 | 1 | 2;
  refundable?: boolean;
  greener?: boolean;
};

/* ---------------- helpers ---------------- */
function assertString(v: any): v is string {
  return typeof v === "string" && v.length > 0;
}
function num(v: any): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function minutesToText(m?: number) {
  if (typeof m !== "number") return "—";
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function sumSegMinutes(segs: any[]): number {
  return segs.reduce((t, s) => t + (Number(s?.duration_minutes) || 0), 0);
}

/** Make a deterministic-ish price from route + date (keeps demos consistent) */
function basePrice(origin: string, destination: string, date: string) {
  const seed = (s: string) =>
    s.split("").reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 9973, 7);
  const v = seed(origin + destination + date);
  return 120 + (v % 160); // 120–279
}

/** Build a few demo itineraries */
function buildCandidates(p: SearchPayload) {
  const {
    origin,
    destination,
    departDate,
    returnDate,
    roundTrip,
    cabin,
    refundable,
    greener,
    currency,
  } = p;

  const bp = basePrice(origin, destination, departDate);

  // Outbound templates
  const directOut = [
    { from: origin, to: destination, depart_time: `${departDate}T08:10`, arrive_time: `${departDate}T10:55`, duration_minutes: 165 },
  ];
  const oneStopOut = [
    { from: origin, to: "CLT", depart_time: `${departDate}T06:00`, arrive_time: `${departDate}T07:45`, duration_minutes: 105 },
    { from: "CLT", to: destination, depart_time: `${departDate}T08:50`, arrive_time: `${departDate}T10:35`, duration_minutes: 105 },
  ];
  const twoStopOut = [
    { from: origin, to: "ORD", depart_time: `${departDate}T05:40`, arrive_time: `${departDate}T07:20`, duration_minutes: 100 },
    { from: "ORD", to: "PHX", depart_time: `${departDate}T08:20`, arrive_time: `${departDate}T10:05`, duration_minutes: 105 },
    { from: "PHX", to: destination, depart_time: `${departDate}T11:10`, arrive_time: `${departDate}T13:05`, duration_minutes: 115 },
  ];

  // Return templates
  const directIn = roundTrip
    ? [{ from: destination, to: origin, depart_time: `${returnDate}T17:40`, arrive_time: `${returnDate}T20:20`, duration_minutes: 160 }]
    : undefined;
  const oneStopIn = roundTrip
    ? [
        { from: destination, to: "CLT", depart_time: `${returnDate}T18:15`, arrive_time: `${returnDate}T19:55`, duration_minutes: 100 },
        { from: "CLT", to: origin, depart_time: `${returnDate}T21:00`, arrive_time: `${returnDate}T22:45`, duration_minutes: 105 },
      ]
    : undefined;

  // 3 candidates: nonstop (fastest), 1-stop (cheapest), 2-stop (flex-ish)
  const candidates = [
    {
      id: "CAND-1",
      currency,
      total_cost: Math.round(bp + 60),
      flight: {
        carrier_name: "United",
        cabin,
        stops: 0,
        refundable: true,
        greener: true,
        price_usd: Math.round(bp + 60),
        segments_out: directOut,
        ...(directIn ? { segments_in: directIn } : {}),
        duration_minutes:
          sumSegMinutes(directOut) + (directIn ? sumSegMinutes(directIn) : 0),
      },
    },
    {
      id: "CAND-2",
      currency,
      total_cost: Math.round(bp - 30),
      flight: {
        carrier_name: "American",
        cabin,
        stops: 1,
        refundable: false,
        greener: false,
        price_usd: Math.round(bp - 30),
        segments_out: oneStopOut,
        ...(oneStopIn ? { segments_in: oneStopIn } : {}),
        duration_minutes:
          sumSegMinutes(oneStopOut) + (oneStopIn ? sumSegMinutes(oneStopIn) : 0),
      },
    },
    {
      id: "CAND-3",
      currency,
      total_cost: Math.round(bp + 10),
      flight: {
        carrier_name: "Delta",
        cabin,
        stops: 2,
        refundable: true,
        greener: false,
        price_usd: Math.round(bp + 10),
        segments_out: twoStopOut,
        ...(oneStopIn ? { segments_in: oneStopIn } : {}),
        duration_minutes:
          sumSegMinutes(twoStopOut) + (oneStopIn ? sumSegMinutes(oneStopIn) : 0),
      },
    },
  ];

  // Attach hotel if requested
  if (p.includeHotel) {
    const star = Math.max(3, Math.min(5, (p.minHotelStar ?? 0) || 4));
    const price = 95 + (bp % 60); // 95–154
    const nights = Math.max(1, p.nights ?? 1);
    candidates.forEach((c, i) => {
      c["hotel"] = {
        name: ["Downtown Inn", "Airport Suites", "Central Plaza"][i % 3],
        star,
        city: destination,
        price_converted: price * nights,
        currency,
        deeplinks: {
          booking: true,
          hotels: true,
          expedia: true,
        },
      };
      c.total_cost += Math.round(price * nights);
    });
  }

  // Apply requested refundable/greener filters (only if true)
  let filtered = candidates.slice();
  if (p.refundable) {
    filtered = filtered.filter((c) => c.flight?.refundable);
  }
  if (p.greener) {
    filtered = filtered.filter((c) => c.flight?.greener);
  }

  // max stops filter
  if (typeof p.maxStops === "number") {
    filtered = filtered.filter((c) => (c.flight?.stops ?? 99) <= p.maxStops!);
  }

  // min/max budget filter
  if (num(p.minBudget) !== undefined) {
    filtered = filtered.filter((c) => c.total_cost >= (p.minBudget as number));
  }
  if (num(p.maxBudget) !== undefined) {
    filtered = filtered.filter((c) => c.total_cost <= (p.maxBudget as number));
  }

  // Sort
  const key = p.sort || "best";
  if (key === "cheapest") {
    filtered.sort((a, b) => a.total_cost - b.total_cost);
  } else if (key === "fastest") {
    filtered.sort((a, b) => (a.flight?.duration_minutes ?? 1e9) - (b.flight?.duration_minutes ?? 1e9));
  } else if (key === "flexible") {
    // Prefer refundable; then cheaper
    filtered.sort((a, b) => {
      const ra = a.flight?.refundable ? 0 : 1;
      const rb = b.flight?.refundable ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.total_cost - b.total_cost;
    });
  } else {
    // "best": mix of price + duration (simple score)
    filtered.sort((a, b) => {
      const ap = a.total_cost;
      const bp_ = b.total_cost;
      const ad = a.flight?.duration_minutes ?? 1e9;
      const bd = b.flight?.duration_minutes ?? 1e9;
      const ascore = ap * 1.0 + ad * 0.2;
      const bscore = bp_ * 1.0 + bd * 0.2;
      return ascore - bscore;
    });
  }

  return filtered;
}

/* ---------------- POST handler ---------------- */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchPayload;

    // Basic validation
    if (!assertString(body.origin) || !assertString(body.destination)) {
      return NextResponse.json(
        { error: "Origin and destination are required." },
        { status: 400 }
      );
    }
    if (!assertString(body.departDate)) {
      return NextResponse.json(
        { error: "Departure date is required." },
        { status: 400 }
      );
    }
    if (body.roundTrip && !assertString(body.returnDate || "")) {
      return NextResponse.json(
        { error: "Return date is required for round-trip." },
        { status: 400 }
      );
    }

    // Build demo results (replace with your real GDS/Amadeus call when ready)
    const results = buildCandidates(body);

    // Optional hotel warning (example)
    const hotelWarning =
      body.includeHotel && !body.nights
        ? "Using 1 night by default for hotel pricing."
        : null;

    return NextResponse.json({ results, hotelWarning });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Search failed" },
      { status: 500 }
    );
  }
}
