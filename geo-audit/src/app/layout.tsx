import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";

const fontVariables = {
  "--font-geist-sans":
    'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-geist-mono":
    '"SFMono-Regular", ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
  "--font-playfair": 'Georgia, "Times New Roman", Times, serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: "GEO — Generative Engine Optimization Audit",
  description:
    "Audit how ChatGPT, Claude, and Perplexity understand your website. Not search ranking. Not keywords. Answer-engine comprehension.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "GEO — Generative Engine Optimization Audit",
    description:
      "Audit how ChatGPT, Claude, and Perplexity understand your website.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GEO — Generative Engine Optimization Audit",
    description:
      "Audit how ChatGPT, Claude, and Perplexity understand your website.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" style={fontVariables}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
