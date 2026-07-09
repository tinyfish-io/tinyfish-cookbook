import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", weight: ["500", "600"], style: ["normal", "italic"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "MarketPulse — retail competitor intelligence",
  description: "Live competitor pricing and stock tracking across Vietnam's electronics retailers.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('marketpulse-theme');
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
          <TopNav />
          <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
