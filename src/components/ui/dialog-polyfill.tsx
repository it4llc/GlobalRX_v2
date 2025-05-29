// src/components/ui/dialog-polyfill.tsx
'use client';

import { useEffect } from 'react';

export function DialogPolyfill() {
  useEffect(() => {
    const loadPolyfill = async () => {
      if (typeof window !== 'undefined' && typeof HTMLDialogElement === 'undefined') {
        const dialogPolyfill = await import('dialog-polyfill');
        document.querySelectorAll('dialog').forEach(dialog => {
          dialogPolyfill.default.registerDialog(dialog);
        });
      }
    };
    
    loadPolyfill();
  }, []);

  // This is a utility component that doesn't render anything
  return null;
}