'use client';

import { TranslationProvider as OriginalTranslationProvider } from "@/contexts/TranslationContext";
import { ReactNode } from "react";

export function TranslationProvider({ children }: { children: ReactNode }) {
  return <OriginalTranslationProvider>{children}</OriginalTranslationProvider>;
}