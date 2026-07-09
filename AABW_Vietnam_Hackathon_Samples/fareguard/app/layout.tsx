import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Header from "@/components/Header";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "FareGuard — corporate travel cost control",
  description: "Live fare and demand tracking across Vietnam airline and OTA portals.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('fareguard-theme');
    var theme = stored || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${body.variable} font-body`}>
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <MobileNav />
            <Header />
            <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
