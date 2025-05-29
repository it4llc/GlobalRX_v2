'use client';

import { LocationProvider as OriginalLocationProvider } from "@/contexts/LocationContext";
import { ReactNode } from "react";

export function LocationProvider({ children }: { children: ReactNode }) {
  return <OriginalLocationProvider>{children}</OriginalLocationProvider>;
}