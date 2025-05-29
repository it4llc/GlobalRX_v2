// src/components/ui/form-actions.tsx
'use client';

import React from 'react';

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className = "" }: FormActionsProps) {
  return (
    <div className={`flex justify-end space-x-2 pt-4 mt-4 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
}