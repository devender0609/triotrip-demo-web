import "./globals.css";
import type { Metadata } from "next";
import Header from "../components/Header";

export const metadata: Metadata = {
  title: "TrioTrip",
  description: "Top-3 travel picks – smarter, clearer, bookable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="tt-body">
        <Header />
        <main className="tt-main">{children}</main>
      </body>
    </html>
  );
}
