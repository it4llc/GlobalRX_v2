// src/components/layout/ContentSection.tsx
import React from 'react';

interface ContentSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ 
  children, 
  className = "" 
}) => {
  return (
    <div className={`px-6 py-6 ${className}`}>
      {children}
    </div>
  );
};