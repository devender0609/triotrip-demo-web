import "./globals.css";
import type { ReactNode } from "react";
import NavBar from "../components/NavBar";

export const metadata = {
  title: "TripTrio",
  description: "Top-3 smarter travel picks",
};

import Providers from './providers';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}

