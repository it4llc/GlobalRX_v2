'use client';

import { DSXProvider as OriginalDSXProvider } from "@/contexts/DSXContext";
import { ReactNode } from "react";

export function DSXProvider({ children }: { children: ReactNode }) {
  return <OriginalDSXProvider>{children}</OriginalDSXProvider>;
}