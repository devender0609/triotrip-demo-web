// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Brand from "../components/Brand";

export const metadata: Metadata = {
  title: "TripTrio",
  description: "Top-3 travel picks – smarter, clearer, bookable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            gap: 12,
          }}
        >
          <Brand />
          <nav style={{ display: "flex", gap: 12 }}>
            <a href="/saved" className="btn ghost">Saved</a>
            <a href="/login" className="btn">Login</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
