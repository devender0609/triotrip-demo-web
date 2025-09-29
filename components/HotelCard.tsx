"use client";

export default function HotelCard({ item, index, currency }: { item: any; index: number; currency: string; }) {
  const price = item.total_converted ?? item.total_usd ?? item.price_usd ?? 0;
  const curr = currency || item.currency || "USD";
  const name = item.name || "Hotel";

  const qCity = encodeURIComponent(item.city || item.location || "");
  const qIn = encodeURIComponent(item.checkin || "");
  const qOut = encodeURIComponent(item.checkout || "");

  const booking = `https://www.booking.com/searchresults.html?ss=${qCity}&checkin=${qIn}&checkout=${qOut}`;
  const hotels = `https://www.hotels.com/Hotel-Search?destination=${qCity}&startDate=${qIn}&endDate=${qOut}`;

  return (
    <article className="hcard" aria-label={`Hotel option ${index + 1}`}>
      <header className="h">
        <div className="rank">#{index + 1}</div>
        <div className="name">{name}</div>
        <div className="stars">{item.stars ? "★".repeat(item.stars) : ""}</div>
        <div className="price">{curr} {Intl.NumberFormat().format(Math.round(price))}</div>
      </header>
      <footer className="cta">
        <a className="btn" href={booking} target="_blank">Booking.com</a>
        <a className="btn" href={hotels} target="_blank">Hotels.com</a>
      </footer>

      <style jsx>{`
        .hcard { background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; }
        .h { display:grid; grid-template-columns:auto 1fr auto auto; gap:10px; align-items:center; padding:10px 12px; border-bottom:1px solid #e5e7eb; }
        .rank { font-weight:900; }
        .name { font-weight:800; }
        .stars { color:#f59e0b; font-weight:900; }
        .price { font-weight:900; text-align:right; }
        .cta { display:flex; gap:8px; padding:10px 12px; justify-content:flex-end; }
        .btn { height:32px; padding:0 10px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; font-weight:800; }
      `}</style>
    </article>
  );
}
