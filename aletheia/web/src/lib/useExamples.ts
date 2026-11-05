import { useEffect, useState } from "react";

import { getExamples } from "./api.ts";

/** Suggestions are a nicety, so a failed request just leaves the prompt box on its own. */
export function useExamples(): string[] {
  const [examples, setExamples] = useState<string[]>([]);

  useEffect(() => {
    let current = true;
    getExamples().then(
      (next) => {
        if (current) setExamples(next);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);

  return examples;
}
