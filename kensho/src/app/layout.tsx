import type { Metadata } from "next";
import { Dela_Gothic_One, IBM_Plex_Mono, Shantell_Sans, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const dela = Dela_Gothic_One({ weight: "400", preload: false, variable: "--font-dela" });
const zen = Zen_Kaku_Gothic_New({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--font-zen" });
const shantell = Shantell_Sans({ subsets: ["latin"], axes: ["INFM", "BNCE"], variable: "--font-shantell" });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Kenshō — read research like manga",
  description:
    "Search any research topic. Kenshō finds real papers on the web with TinyFish and redraws them as grounded, cited manga chapters.",
};

// Runs before first paint: returning readers never see a flash of the opening title card.
const INTRO_SCRIPT = `try{if(localStorage.getItem("kensho.intro.v1")==="seen"&&!/[?&]intro=1/.test(location.search))document.documentElement.dataset.intro="seen"}catch(e){document.documentElement.dataset.intro="seen"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dela.variable} ${zen.variable} ${shantell.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body className="min-h-dvh paper-grain">{children}</body>
    </html>
  );
}
