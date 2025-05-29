// src/components/ui/form-table.tsx
'use client';

import React from 'react';

interface FormTableProps {
  children: React.ReactNode;
  className?: string;
}

export function FormTable({ children, className = "" }: FormTableProps) {
  return (
    <table className={`w-full form-table ${className}`}>
      <tbody>
        {children}
      </tbody>
    </table>
  );
}