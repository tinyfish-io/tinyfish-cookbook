"use client";

import type { Category } from "@/lib/types";

export default function CategoryTabs({
  value,
  onChange,
}: {
  value: Category;
  onChange: (c: Category) => void;
}) {
  const categories: Category[] = ["Laptops", "PC Components"];
  return (
    <div className="flex items-center gap-2 mb-5">
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            value === c
              ? "bg-burgundy border-burgundy text-accent font-medium"
              : "border-border text-text-secondary hover:text-text-primary hover:border-accent/40"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
