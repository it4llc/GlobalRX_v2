// src/components/layout/PageContent.tsx
"use client";

import React, { useEffect, ReactNode } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export function PageContent({ children, className = "" }: PageContentProps) {
  const { t } = useTranslation();

  // Process translations on the client side
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Find all elements with data-i18n-key attribute and translate them
    const elementsToTranslate = document.querySelectorAll('[data-i18n-key]');
    
    elementsToTranslate.forEach((element) => {
      const key = element.getAttribute('data-i18n-key');
      if (key) {
        // For elements that should preserve their HTML content
        if (element.hasAttribute('data-i18n-html')) {
          element.innerHTML = t(key);
        } else {
          // For regular text content
          element.textContent = t(key);
        }
      }
    });
  }, [t]);

  // Use the content-section class for consistent padding
  return (
    <div className={`content-section ${className}`}>
      {children}
    </div>
  );
}