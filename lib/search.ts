export type SearchPayload = {
  origin: string; destination: string; depart: string; returnDate?: string | null;
  hotel?: boolean; nights?: number; travelers: number;
  cabin_class?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  bags?: number; max_stops?: number; budgetMin?: number; budgetMax?: number;
  hotelStarsMin?: number; mode?: "best" | "cheapest" | "fastest" | "flexible";
};
export type SearchResponse = { results: any[] };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export async function searchTrips(payload: SearchPayload): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as SearchResponse;
}
