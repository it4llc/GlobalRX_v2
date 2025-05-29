// src/components/ui/tooltip.tsx
'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  contentClassName?: string;
  showIndicator?: boolean;
  iconOnly?: boolean;
  iconSize?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Simple tooltip component that displays content on hover
 */
export function Tooltip({
  children,
  content,
  position = 'bottom',
  className,
  contentClassName,
  showIndicator = true,
  iconOnly = false,
  iconSize = 'md'
}: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2'
  };

  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  const infoIcon = (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={cn("text-gray-500", sizeClasses[iconSize])}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
  );

  return (
    <div className={cn('relative inline-block', className)}>
      {/* For icon-only tooltips */}
      {iconOnly ? (
        <span className="inline-flex items-center cursor-help">
          {getDataTypeLabel(children as string)}
          <span className="group ml-1">
            {infoIcon}
            <div 
              className={cn(
                'absolute hidden group-hover:block z-50 bg-white border border-gray-200 shadow-lg rounded-md p-2 text-xs min-w-[12rem] max-w-xs',
                positionClasses[position],
                contentClassName
              )}
              role="tooltip"
            >
              {content}
            </div>
          </span>
        </span>
      ) : (
        /* For regular tooltips with text */
        <span className="group inline-flex items-center">
          {showIndicator ? (
            <span className="cursor-help border-b border-dotted border-blue-400 font-medium">
              {children}
            </span>
          ) : (
            <span>{children}</span>
          )}
          
          <span className="ml-1 cursor-help">{infoIcon}</span>
          
          <div 
            className={cn(
              'absolute z-50 hidden group-hover:block bg-white border border-gray-200 shadow-lg rounded-md p-2 text-xs min-w-[12rem] max-w-xs',
              positionClasses[position],
              contentClassName
            )}
            role="tooltip"
          >
            {content}
          </div>
        </span>
      )}
    </div>
  );
}

// Helper function to handle children content for Data Type
function getDataTypeLabel(dataType: string): string {
  if (!dataType) return '';
  
  const typeMap: Record<string, string> = {
    'text': 'Text',
    'number': 'Number',
    'date': 'Date',
    'email': 'Email',
    'phone': 'Phone',
    'select': 'Dropdown',
    'checkbox': 'Checkbox',
    'radio': 'Radio Buttons'
  };
  
  return typeMap[dataType] || dataType;
}