'use client';

import { SessionProvider } from 'next-auth/react';
import { LocationProvider } from '@/contexts/LocationContext';
import { DSXProvider } from '@/contexts/DSXContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ViewProvider } from '@/contexts/ViewContext';
import { TranslationProvider } from '@/components/providers/translation-provider';

export default function ClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <TranslationProvider>
        <AuthProvider>
          <ViewProvider>
            <LocationProvider>
              <DSXProvider>
                {children}
              </DSXProvider>
            </LocationProvider>
          </ViewProvider>
        </AuthProvider>
      </TranslationProvider>
    </SessionProvider>
  );
}