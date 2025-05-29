// src/app/nav-layout.tsx
"use client";

import { ClientNav } from "@/components/layout/client-nav";
import { SiteFooter } from "@/components/layout/site-footer";

export default function NavLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <ClientNav />
      <main className="flex-grow flex justify-center">
        <div className="centered-container">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}