// src/components/auth/auth-provider.tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { SessionTimeout } from './session-timeout';

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  return (
    <SessionProvider>
      <SessionTimeout />
      {children}
    </SessionProvider>
  );
}