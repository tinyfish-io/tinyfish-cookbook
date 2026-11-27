import { useCallback, useEffect, useRef, useState } from "react";

export type Load<T> =
  | { state: "loading" }
  | { state: "failed"; message: string; code: string | null }
  | { state: "ready"; data: T };

function asFailure(error: unknown): Extract<Load<never>, { state: "failed" }> {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  return {
    state: "failed",
    code,
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

/** Loads on mount and whenever `key` changes. A slower older answer never replaces a newer one. */
export function useLoad<T>(key: string, load: () => Promise<T>) {
  const [result, setResult] = useState<Load<T>>({ state: "loading" });
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    latest.current += 1;
    const ticket = latest.current;
    try {
      const data = await loadRef.current();
      if (ticket === latest.current) setResult({ state: "ready", data });
    } catch (error) {
      if (ticket === latest.current) setResult(asFailure(error));
    }
  }, []);

  useEffect(() => {
    setResult({ state: "loading" });
    void refresh();
    return () => {
      latest.current += 1;
    };
  }, [key, refresh]);

  return { result, refresh, setResult };
}
