import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["600", "700"], style: ["normal", "italic"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "PropertyPulse — real estate market intelligence",
  description: "Live property listing intelligence across Vietnam's real estate portals, for agencies.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('propertypulse-theme');
    var theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${serif.variable} ${body.variable} font-body`}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
