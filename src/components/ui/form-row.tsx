// src/components/ui/form-row.tsx
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';

interface FormRowProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  info?: string | React.ReactNode;
  error?: string;
  alignTop?: boolean;
  children: React.ReactNode;
}

export function FormRow({
  label,
  htmlFor,
  required = false,
  info,
  error,
  alignTop = false,
  children
}: FormRowProps) {
  return (
    <tr>
      <td className={alignTop ? "form-label-top" : "form-label"}>
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      </td>
      <td className={alignTop ? "form-input-top" : "form-input"}>
        {children}
        {error && <p className="form-error">{error}</p>}
      </td>
      <td className="form-info">
        {info || (
          <span className={required ? "form-required" : "form-optional"}>
            {required ? "Required" : "Optional"}
          </span>
        )}
      </td>
    </tr>
  );
}