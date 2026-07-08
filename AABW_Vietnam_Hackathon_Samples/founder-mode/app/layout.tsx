import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Header from "@/components/Header";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Founder Mode — accelerator & grant application copilot",
  description: "Discovers open accelerator and grant programs, drafts applications, and tracks the pipeline.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('founder-mode-theme');
    var theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.className} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <MobileNav />
            <Header />
            <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
