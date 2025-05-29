// src/components/ui/loading-spinner.tsx
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = 'border-blue-500',
  className = '',
}: LoadingSpinnerProps) {
  // Determine size classes
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  const sizeClass = sizeClasses[size];

  return (
    <div className={`spinner-container ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClass} border-solid ${color} border-t-transparent`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}