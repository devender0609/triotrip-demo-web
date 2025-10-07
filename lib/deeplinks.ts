import type { SearchPayload } from "./search";
const compact = (d: string) => (d || "").replace(/-/g, "");
export function skyscannerFlightLink(q: SearchPayload) {
  const base = "https://www.skyscanner.com/transport/flights";
  const from = (q.origin || "").toLowerCase();
  const to = (q.destination || "").toLowerCase();
  const depart = compact(q.depart);
  const ret = q.returnDate ? `/${compact(q.returnDate)}` : "";
  const cabin = q.cabin_class === "BUSINESS" ? "business" : q.cabin_class === "PREMIUM_ECONOMY" ? "premiumeconomy" : q.cabin_class === "FIRST" ? "first" : "economy";
  const adults = Math.max(1, Number((q as any).travelers || 1));
  return `${base}/${from}/${to}/${depart}${ret}/?adults=${adults}&cabinclass=${cabin}&preferdirects=false`;
}
export function bookingHotelLink(city: string, checkIn: string, checkOut?: string, adults=1, minStars?: number) {
  const base = "https://www.booking.com/searchresults.html";
  const nf = minStars ? `&nflt=class%3D${minStars}` : "";
  return `${base}?ss=${encodeURIComponent(city)}&checkin=${checkIn}${checkOut?`&checkout=${checkOut}`:""}&group_adults=${adults}${nf}`;
}