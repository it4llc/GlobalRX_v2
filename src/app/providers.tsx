// src/app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { AuthInterceptor } from "@/components/auth/auth-interceptor";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AuthInterceptor>
        <TranslationProvider>
          {children}
        </TranslationProvider>
      </AuthInterceptor>
    </SessionProvider>
  );
}