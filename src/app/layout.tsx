// src/app/layout.tsx
import '@/app/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientProvider from '@/components/providers/client-provider';

// Configure font
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GlobalRx Platform',
  description: 'Global Background Screening Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}