// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Brand from "../components/Brand";

export const metadata = {
  title: "TripTrio",
  description: "Top-3 smarter travel picks",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            padding: "10px 16px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Brand />
        </header>

        <main style={{ minHeight: "100vh" }}>{children}</main>
      </body>
    </html>
  );
}
