import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RateRadar — Shinhan Bank Rate Intelligence",
  description:
    "Compare live loan rates and savings yields across Vietnam's banks, with Shinhan Bank featured, and apply to multiple banks in parallel."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink text-paper font-sans antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
