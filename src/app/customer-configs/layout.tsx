// src/app/customer-configs/layout.tsx
'use client';

import NavLayout from '../nav-layout';
import { useTranslation } from '@/contexts/TranslationContext';
import { PageContent } from '@/components/layout/PageContent';

export default function CustomerConfigsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  
  return (
    <NavLayout>
      <PageContent>
        <div className="p-6">
          {/* Page content */}
          <div>{children}</div>
        </div>
      </PageContent>
    </NavLayout>
  );
}