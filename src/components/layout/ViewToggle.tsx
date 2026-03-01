// /GlobalRX_v2/src/components/layout/ViewToggle.tsx

'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useViewContext } from '@/contexts/ViewContext';

export function ViewToggle() {
  const { user } = useAuth();
  const { view, setView, canToggle } = useViewContext();

  // Only show for users who can toggle between views
  if (!canToggle) {
    return null;
  }

  const handleViewChange = (newView: 'config' | 'orders') => {
    if (view !== newView) {
      setView(newView);
    }
  };

  return (
    <div className="view-toggle flex items-center bg-gray-100 rounded-lg p-1">
      <button
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium
          ${view === 'config'
            ? 'bg-white text-gray-900 shadow-sm active'
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
        onClick={() => handleViewChange('config')}
        title="Manage system settings, users, and configurations"
        aria-label="Configuration View"
      >
        <svg
          data-testid="config-icon"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span>Configuration</span>
        <span className="sr-only" role="tooltip">Manage system settings, users, and configurations</span>
      </button>

      <button
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium
          ${view === 'orders'
            ? 'bg-white text-gray-900 shadow-sm active'
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
        onClick={() => handleViewChange('orders')}
        title="View and manage background check orders"
        aria-label="Order View"
      >
        <svg
          data-testid="orders-icon"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span>Orders</span>
        <span className="sr-only" role="tooltip">View and manage background check orders</span>
      </button>
    </div>
  );
}