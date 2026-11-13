"use client";

import { createContext, useContext } from "react";
import type { Claim, Term } from "@/lib/types";

export interface ReaderCtx {
  claims: Map<string, Claim>;
  glossary: Term[];
  sectionHeading: (id: string) => string | undefined;
  openClaim: (id: string) => void;
  openTerm: (term: Term) => void;
}

const noop = () => {};
export const ReaderContext = createContext<ReaderCtx>({
  claims: new Map(),
  glossary: [],
  sectionHeading: () => undefined,
  openClaim: noop,
  openTerm: noop,
});

export const useReader = () => useContext(ReaderContext);
