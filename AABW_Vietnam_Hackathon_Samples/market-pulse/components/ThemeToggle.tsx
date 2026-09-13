"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("marketpulse-theme", next);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle color theme"
      className={`rounded-md border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent/40 transition-colors ${collapsed ? "w-8 h-8" : "w-8 h-8"}`}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
