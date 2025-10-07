export type Currency = "USD" | "EUR" | "INR";
const rates: Record<Currency, number> = { USD: 1, EUR: 0.92, INR: 83 };
export function symbol(c: Currency) { return c === "EUR" ? "€" : c === "INR" ? "₹" : "$"; }
export function convert(amount: number, to: Currency) { return amount * rates[to]; }