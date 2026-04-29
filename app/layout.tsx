import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spain Tax — IVA / IGIC / IPSI calculator",
  description:
    "AI-assisted Spanish indirect tax calculator. Determines IVA, IGIC, IPSI, equivalence surcharge, IIEE and IEDMT against versioned, dated rules.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
