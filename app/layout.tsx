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
  // suppressHydrationWarning silences mismatches caused by browser extensions
  // (Ember Inspector, Grammarly, dark-mode addons, etc.) that inject
  // attributes into <html>/<body> before React hydrates. Scoped to the root
  // shell only — does NOT silence mismatches in your own components.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
