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

function basePrice(origin: string, destination: string, date: string) {
  const seed = (s: string) =>
    s.split("").reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 9973, 7);
  const v = seed(origin + destination + date);
  return 120 + (v % 160); // 120–279
}

/** crude but direct airline URLs; if deep link params aren't supported, we route to the airline's booking page */
function airlineUrl(carrier: string, origin: string, destination: string, departDate: string, roundTrip: boolean, returnDate?: string) {
  const d = departDate; // yyyy-mm-dd
  const r = returnDate;
  const c = carrier.toLowerCase();

  // Known patterns (not guaranteed for all locales; fallback to home booking)
  if (c.includes("united")) {
    // https://www.united.com/en-us/flight-search
    return `https://www.united.com/en-us/flight-search?from=${origin}&to=${destination}&depDate=${d}${roundTrip && r ? `&retDate=${r}` : ""}`;
  }
  if (c.includes("american")) {
    // https://www.aa.com/booking/find-flights
    return `https://www.aa.com/booking/find-flights?tripType=${roundTrip ? "roundTrip" : "oneWay"}&from=${origin}&to=${destination}&departDate=${d}${roundTrip && r ? `&returnDate=${r}` : ""}`;
  }
  if (c.includes("delta")) {
    // https://www.delta.com/flight-search/book-a-flight
    return `https://www.delta.com/flight-search/book-a-flight?fromCity=${origin}&toCity=${destination}&departureDate=${d}${roundTrip && r ? `&returnDate=${r}` : ""}`;
  }
  if (c.includes("southwest")) {
    return `https://www.southwest.com/air/booking/select.html?originationAirportCode=${origin}&destinationAirportCode=${destination}&departureDate=${d}${roundTrip && r ? `&returnDate=${r}` : ""}`;
  }
  if (c.includes("alaska")) {
    return `https://www.alaskaair.com/planbook?from=${origin}&to=${destination}&depart=${d}${roundTrip && r ? `&return=${r}` : ""}`;
  }
  if (c.includes("jetblue")) {
    return `https://www.jetblue.com/booking/flights?from=${origin}&to=${destination}&depart=${d}${roundTrip && r ? `&return=${r}` : ""}`;
  }
  if (c.includes("air canada")) {
    return `https://www.aircanada.com/`;// AC deeplink params are complex
  }
  if (c.includes("lufthansa")) {
    return `https://www.lufthansa.com/`;// fallback
  }
  if (c.includes("british airways") || c === "ba" || c.includes("british")) {
    return `https://www.britishairways.com/`;// fallback
  }
  if (c.includes("air india")) {
    return `https://www.airindia.com/`;// fallback
  }
  // generic fallback: airline name search page (but on airline domain)
  return `https://www.${carrier.replace(/\s+/g, "").toLowerCase()}.com/`;
}

function attachAirlineLink(pkg: any, p: SearchPayload) {
  const carrier = pkg?.flight?.carrier_name || pkg?.flight?.carrier;
  if (!carrier) return pkg;
  const url = airlineUrl(carrier, p.origin, p.destination, p.departDate, p.roundTrip, p.returnDate);
  pkg.deeplinks = {
    ...(pkg.deeplinks || {}),
    airline: { name: carrier, url },
  };
  pkg.flight.deeplinks = {
    ...(pkg.flight.deeplinks || {}),
    airline: { name: carrier, url },
  };
  return pkg;
}

function buildCandidates(p: SearchPayload) {
  const {
    origin, destination, departDate, returnDate, roundTrip, cabin, currency,
  } = p;

  const bp = basePrice(origin, destination, departDate);

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

  const directIn = roundTrip
    ? [{ from: destination, to: origin, depart_time: `${returnDate}T17:40`, arrive_time: `${returnDate}T20:20`, duration_minutes: 160 }]
    : undefined;
  const oneStopIn = roundTrip
    ? [
        { from: destination, to: "CLT", depart_time: `${returnDate}T18:15`, arrive_time: `${returnDate}T19:55`, duration_minutes: 100 },
        { from: "CLT", to: origin, depart_time: `${returnDate}T21:00`, arrive_time: `${returnDate}T22:45`, duration_minutes: 105 },
      ]
    : undefined;

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

  if (p.includeHotel) {
    const star = Math.max(3, Math.min(5, (p.minHotelStar ?? 0) || 4));
    const price = 95 + (bp % 60);
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

  // add airline direct link per candidate
  return candidates.map((c) => attachAirlineLink(c, p));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchPayload;

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

    let results = buildCandidates(body);

    // user filters
    if (body.refundable) results = results.filter((c) => c.flight?.refundable);
    if (body.greener) results = results.filter((c) => c.flight?.greener);
    if (typeof body.maxStops === "number")
      results = results.filter((c) => (c.flight?.stops ?? 99) <= body.maxStops!);
    if (num(body.minBudget) !== undefined)
      results = results.filter((c) => c.total_cost >= (body.minBudget as number));
    if (num(body.maxBudget) !== undefined)
      results = results.filter((c) => c.total_cost <= (body.maxBudget as number));
    if (body.includeHotel && body.minHotelStar)
      results = results.filter((c) => !c.hotel || (c.hotel.star || 0) >= body.minHotelStar!);

    // sort
    const k = body.sort || "best";
    if (k === "cheapest") results.sort((a, b) => a.total_cost - b.total_cost);
    else if (k === "fastest")
      results.sort(
        (a, b) => (a.flight?.duration_minutes ?? 1e9) - (b.flight?.duration_minutes ?? 1e9)
      );
    else if (k === "flexible")
      results.sort((a, b) => {
        const ra = a.flight?.refundable ? 0 : 1;
        const rb = b.flight?.refundable ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return a.total_cost - b.total_cost;
      });
    else
      results.sort((a, b) => {
        const as = a.total_cost * 1.0 + (a.flight?.duration_minutes ?? 1e9) * 0.2;
        const bs = b.total_cost * 1.0 + (b.flight?.duration_minutes ?? 1e9) * 0.2;
        return as - bs;
      });

    const hotelWarning =
      body.includeHotel && !body.nights ? "Using 1 night by default for hotel pricing." : null;

    return NextResponse.json({ results, hotelWarning });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Search failed" },
      { status: 500 }
    );
  }
}
