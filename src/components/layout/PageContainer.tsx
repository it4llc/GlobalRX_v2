// src/components/layout/PageContainer.tsx
import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className = "" 
}) => {
  // We already have the centered-container styling at the root layout
  // This component now focuses on the content inside that container
  return (
    <div className={`w-full bg-white min-h-screen ${className}`}>
      {children}
    </div>
  );
};