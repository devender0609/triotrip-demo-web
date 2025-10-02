// app/api/search/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
type SortKey = "best" | "cheapest" | "fastest" | "flexible";
type SortBasis = "flightOnly" | "bundle"; // NEW: controls sorting basis

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

  // optional from UI; defaults to flightOnly if omitted
  sortBasis?: SortBasis;
};

function assertString(v: any): v is string {
  return typeof v === "string" && v.length > 0;
}
function num(v: any): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
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

/** crude direct airline URLs; fallback to airline homepage when no stable deep link */
function airlineUrl(
  carrier: string,
  origin: string,
  destination: string,
  departDate: string,
  roundTrip: boolean,
  returnDate?: string
) {
  const d = departDate; // yyyy-mm-dd
  const r = returnDate;
  const c = carrier.toLowerCase();

  if (c.includes("united")) {
    return `https://www.united.com/en-us/flight-search?from=${origin}&to=${destination}&depDate=${d}${roundTrip && r ? `&retDate=${r}` : ""}`;
  }
  if (c.includes("american")) {
    return `https://www.aa.com/booking/find-flights?tripType=${roundTrip ? "roundTrip" : "oneWay"}&from=${origin}&to=${destination}&departDate=${d}${roundTrip && r ? `&returnDate=${r}` : ""}`;
  }
  if (c.includes("delta")) {
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
  if (c.includes("air canada")) return `https://www.aircanada.com/`;
  if (c.includes("lufthansa")) return `https://www.lufthansa.com/`;
  if (c.includes("british")) return `https://www.britishairways.com/`;
  if (c.includes("air india")) return `https://www.airindia.com/`;
  return `https://www.${carrier.replace(/\s+/g, "").toLowerCase()}.com/`;
}

function attachAirlineLink(pkg: any, p: SearchPayload) {
  const carrier = pkg?.flight?.carrier_name || pkg?.flight?.carrier;
  if (!carrier) return pkg;
  const url = airlineUrl(
    carrier,
    p.origin,
    p.destination,
    p.departDate,
    p.roundTrip,
    p.returnDate
  );
  pkg.deeplinks = { ...(pkg.deeplinks || {}), airline: { name: carrier, url } };
  pkg.flight.deeplinks = { ...(pkg.flight.deeplinks || {}), airline: { name: carrier, url } };
  return pkg;
}

function buildCandidates(p: SearchPayload) {
  const { origin, destination, departDate, returnDate, roundTrip, cabin, currency } = p;

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
      flight: {
        carrier_name: "United",
        cabin,
        stops: 0,
        refundable: true,
        greener: true,
        price_usd: Math.round(bp + 60),
        segments_out: directOut,
        ...(directIn ? { segments_in: directIn } : {}),
        duration_minutes: sumSegMinutes(directOut) + (directIn ? sumSegMinutes(directIn) : 0),
      },
    },
    {
      id: "CAND-2",
      currency,
      flight: {
        carrier_name: "American",
        cabin,
        stops: 1,
        refundable: false,
        greener: false,
        price_usd: Math.round(bp - 30),
        segments_out: oneStopOut,
        ...(oneStopIn ? { segments_in: oneStopIn } : {}),
        duration_minutes: sumSegMinutes(oneStopOut) + (oneStopIn ? sumSegMinutes(oneStopIn) : 0),
      },
    },
    {
      id: "CAND-3",
      currency,
      flight: {
        carrier_name: "Delta",
        cabin,
        stops: 2,
        refundable: true,
        greener: false,
        price_usd: Math.round(bp + 10),
        segments_out: twoStopOut,
        ...(oneStopIn ? { segments_in: oneStopIn } : {}),
        duration_minutes: sumSegMinutes(twoStopOut) + (oneStopIn ? sumSegMinutes(oneStopIn) : 0),
      },
    },
  ];

  // Add (soft) hotel data; don't remove flights if stars don't match.
  if (p.includeHotel) {
    const nights = Math.max(1, p.nights ?? 1);
    const starTarget = p.minHotelStar ?? 0;
    const hotelBase = 95 + (bp % 60); // per night

    candidates.forEach((c, i) => {
      const offeredStar = Math.max(3, Math.min(5, starTarget || 4));
      const meets = offeredStar >= starTarget; // always true unless starTarget > offeredStar (rare with our default)
      const hotelPrice = hotelBase * nights;

      c["hotel"] = {
        name: ["Downtown Inn", "Airport Suites", "Central Plaza"][i % 3],
        star: offeredStar,
        city: destination,
        price_converted: hotelPrice,
        currency,
        deeplinks: { booking: true, hotels: true, expedia: true },
        ...(meets ? {} : { filteredOutByStar: true }), // mark if not meeting requested star
      };
    });
  }

  // Attach airline links
  return candidates.map((c) => attachAirlineLink(c, p));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SearchPayload;

    // Basic validation
    if (!assertString(body.origin) || !assertString(body.destination)) {
      return NextResponse.json({ error: "Origin and destination are required." }, { status: 400 });
    }
    if (!assertString(body.departDate)) {
      return NextResponse.json({ error: "Departure date is required." }, { status: 400 });
    }
    if (body.roundTrip && !assertString(body.returnDate || "")) {
      return NextResponse.json({ error: "Return date is required for round-trip." }, { status: 400 });
    }

    // Build candidates and compute totals with SOFT hotel effect
    const sortBasis: SortBasis = body.sortBasis === "bundle" ? "bundle" : "flightOnly";
    const nights = Math.max(1, body.nights ?? 1);

    let results = buildCandidates(body).map((c) => {
      const flight_total = c.flight?.price_usd ?? 0;
      let hotel_total = 0;

      if (body.includeHotel && c.hotel) {
        // If minHotelStar set and hotel below it, DO NOT add hotel cost, but keep the hotel object with a badge
        const meets =
          typeof body.minHotelStar === "number"
            ? (c.hotel.star || 0) >= body.minHotelStar
            : true;

        if (meets) {
          hotel_total = c.hotel.price_converted ?? 0;
        } else {
          c.hotel.filteredOutByStar = true;
          hotel_total = 0;
        }
      }

      const bundle_total = Math.round(flight_total + hotel_total);

      return {
        ...c,
        // Detailed totals for UI/compare
        flight_total,
        hotel_total,
        total_cost: bundle_total, // keep existing field: used by cards/compare
        display_total: sortBasis === "bundle" ? bundle_total : flight_total, // used only for sorting
      };
    });

    // Apply user filters that should still impact flights (but not hide airlines because of hotel)
    if (body.refundable) results = results.filter((c) => c.flight?.refundable);
    if (body.greener) results = results.filter((c) => c.flight?.greener);
    if (typeof body.maxStops === "number")
      results = results.filter((c) => (c.flight?.stops ?? 99) <= body.maxStops!);

    // Budget filters—interpret as bundle budget if hotel included & counted, otherwise flight
    if (num(body.minBudget) !== undefined)
      results = results.filter((c) => c.total_cost >= (body.minBudget as number));
    if (num(body.maxBudget) !== undefined)
      results = results.filter((c) => c.total_cost <= (body.maxBudget as number));

    // Sort (by requested key) but order using display_total for price-based sorts
    const key = body.sort || "best";
    if (key === "cheapest") {
      results.sort((a, b) => a.display_total - b.display_total);
    } else if (key === "fastest") {
      results.sort(
        (a, b) => (a.flight?.duration_minutes ?? 1e9) - (b.flight?.duration_minutes ?? 1e9)
      );
    } else if (key === "flexible") {
      results.sort((a, b) => {
        const ra = a.flight?.refundable ? 0 : 1;
        const rb = b.flight?.refundable ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return a.display_total - b.display_total;
      });
    } else {
      // "best": simple blend of price+duration; use display_total for the price portion
      results.sort((a, b) => {
        const as = a.display_total * 1.0 + (a.flight?.duration_minutes ?? 1e9) * 0.2;
        const bs = b.display_total * 1.0 + (b.flight?.duration_minutes ?? 1e9) * 0.2;
        return as - bs;
      });
    }

    const hotelWarning =
      body.includeHotel && !body.nights ? "Using 1 night by default for hotel pricing." : null;

    return NextResponse.json({ results, hotelWarning, sortBasis });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Search failed" }, { status: 500 });
  }
}
