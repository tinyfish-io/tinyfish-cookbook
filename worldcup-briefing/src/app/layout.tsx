import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Briefing — TinyFish × VideoDB",
  description: "Create soccer moment reels with TinyFish discovery and VideoDB video indexing.",
  icons: { icon: "/brand/icon-football.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[var(--c-bg)] text-[var(--c-text)]">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var c=t==='light'?'theme-light':'theme-dark';var d=document.documentElement;d.classList.remove('theme-dark','theme-light');d.classList.add(c);}catch(e){}})();",
          }}
        />
        <Header />
        {children}
      </body>
    </html>
  );
}
