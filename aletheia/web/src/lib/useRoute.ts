import { useSyncExternalStore } from "react";

import { matchRoute } from "./route.ts";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const currentHref = () => window.location.pathname + window.location.search;

export function navigate(href: string, { replace = false } = {}): void {
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  notify();
  window.scrollTo(0, 0);
}

export function useRoute() {
  const href = useSyncExternalStore(subscribe, currentHref);
  const url = new URL(href, window.location.origin);
  return { href, route: matchRoute(url.pathname, url.search) };
}
