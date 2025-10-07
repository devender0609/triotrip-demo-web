// web/lib/airlines.ts
export const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  BA: "British Airways",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  SQ: "Singapore Airlines",
  EK: "Emirates",
  QR: "Qatar Airways",
  AC: "Air Canada",
  QF: "Qantas",
  CX: "Cathay Pacific",
  AI: "Air India",
  VS: "Virgin Atlantic",
};

export function airlineName(code?: string) {
  if (!code) return "Airline";
  return AIRLINE_NAMES[code] || code;
}

/**
 * Very rough deep-links for a few carriers. Many airline sites change params frequently.
 * We provide best-effort links; Google/Skyscanner links remain the most reliable.
 */
export function airlineBookingLink(
  carrierCode: string,
  origin: string,
  destination: string,
  depart: string,
  ret?: string
): string {
  const r = ret ? "&tripType=roundtrip" : "&tripType=oneway";
  switch (carrierCode) {
    case "UA":
      // United supports simple query params
      return `https://www.united.com/en-us/flights?origin=${origin}&destination=${destination}&date=${depart}${ret ? `&returnDate=${ret}` : ""}${r}`;
    case "AA":
      return `https://www.aa.com/booking/flights/choose-flights?tripType=${ret ? "roundTrip" : "oneWay"}&destination=${destination}&origin=${origin}&departDate=${depart}${ret ? `&returnDate=${ret}` : ""}`;
    case "BA":
      return `https://www.britishairways.com/travel/home/public/en_us/booking#plan?type=${ret ? "return" : "oneway"}&from=${origin}&to=${destination}&out=${depart}${ret ? `&in=${ret}` : ""}`;
    case "DL":
      return `https://www.delta.com/flight-search/search?tripType=${ret ? "RT" : "OW"}&fromCity=${origin}&toCity=${destination}&departDate=${depart}${ret ? `&returnDate=${ret}` : ""}`;
    default:
      // Fallback: show airline code reference (user can navigate from there)
      return `https://en.wikipedia.org/wiki/${carrierCode}_airline`;
  }
}
