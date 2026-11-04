import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Substitutes for hex.tech's commercial fonts (see DESIGN.md):
// PP Formula SemiExtended → Archivo (wide), Cinetype → Geist, Cinetype Mono → Geist Mono.
const display = Archivo({ variable: "--ff-display", subsets: ["latin"], axes: ["wdth"] });
const serif = Instrument_Serif({ variable: "--ff-serif", subsets: ["latin"], weight: "400", style: "italic" });
const sans = Geist({ variable: "--ff-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--ff-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Openings — the job radar for students",
  description:
    "Tell Openings what you're looking for once. It checks live careers pages, reads every posting, and shows the internships and new-grad roles that fit you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
