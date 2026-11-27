import type { Metadata } from "next";

export const metadata: Metadata = { title: "My radar · Openings" };

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
