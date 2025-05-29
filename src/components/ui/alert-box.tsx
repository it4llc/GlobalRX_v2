// src/components/ui/alert-box.tsx
import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type AlertType = 'error' | 'warning' | 'info' | 'success';

interface AlertBoxProps {
  type: AlertType;
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function AlertBox({ type, title, message, action, className = '' }: AlertBoxProps) {
  const iconMap = {
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
  };
  
  const bgColorMap = {
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
  };
  
  const textColorMap = {
    error: 'text-red-800',
    warning: 'text-amber-800',
    info: 'text-blue-800',
    success: 'text-green-800',
  };
  
  return (
    <Alert className={`${bgColorMap[type]} ${className} border`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {iconMap[type]}
        </div>
        <div className="ml-3 flex-1">
          <AlertTitle className={`text-sm font-medium ${textColorMap[type]}`}>
            {title}
          </AlertTitle>
          <AlertDescription className={`mt-2 text-sm ${textColorMap[type]}`}>
            {message}
          </AlertDescription>
          {action && (
            <div className="mt-4">
              {action}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}