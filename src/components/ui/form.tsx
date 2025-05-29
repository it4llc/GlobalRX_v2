// src/components/ui/form.tsx
import React from 'react';

interface FormTableProps {
  children: React.ReactNode;
  className?: string;
}

const FormTable: React.FC<FormTableProps> = ({ children, className = '' }) => {
  return (
    <div className={`form-table ${className}`}>
      <table className="w-full">
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
};

interface FormRowProps {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

const FormRow: React.FC<FormRowProps> = ({ 
  label, 
  htmlFor, 
  required = false, 
  error, 
  children, 
  className = '' 
}) => {
  return (
    <tr className={`form-row ${className}`}>
      <td className="form-label text-right py-2 pr-4 align-top">
        <label htmlFor={htmlFor} className="font-medium text-sm">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </td>
      <td className="form-input py-2 align-top">
        {children}
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </td>
      <td className="form-info text-xs text-gray-500 py-2 pl-4 align-top">
        {required ? 'Required' : 'Optional'}
      </td>
    </tr>
  );
};

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

const FormActions: React.FC<FormActionsProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex justify-end space-x-4 mt-6 ${className}`}>
      {children}
    </div>
  );
};

export { FormTable, FormRow, FormActions };