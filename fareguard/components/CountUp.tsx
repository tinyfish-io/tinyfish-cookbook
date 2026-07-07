"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

export default function CountUp({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevValue.current;
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent = format(v);
      },
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, format]);

  return (
    <span ref={ref} className="tabular">
      {format(0)}
    </span>
  );
}
