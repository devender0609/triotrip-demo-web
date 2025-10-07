"use client";

import jsPDF from "jspdf";

export function printPage() {
  window.print();
}

export async function shareUrl(title = "TripTrio Results") {
  if (navigator.share) {
    await navigator.share({ title, url: window.location.href });
  } else {
    await navigator.clipboard.writeText(window.location.href);
    alert("Link copied.");
  }
}

export function exportPdf(results: any[], currency = "USD") {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TripTrio — Results", 14, 16);
  doc.setFontSize(11);
  let y = 26;
  results.slice(0, 20).forEach((r, i) => {
    const t = r.total_converted ?? r.total_cost_converted ?? r.total_cost ?? 0;
    doc.text(`${i + 1}. ${r.flight?.carrier_name || "Airline"}  •  ${currency} ${Math.round(t)}`, 14, y);
    y += 7;
    if (y > 280) { doc.addPage(); y = 20; }
  });
  doc.save("triptrio-results.pdf");
}
