// /GlobalRX_v2/src/contexts/ViewContext.tsx

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getUserViewMode } from '@/lib/vendorUtils';

export type ViewType = 'config' | 'orders';

interface ViewContextType {
  view: ViewType;
  setView: (view: ViewType) => void;
  canToggle: boolean;
  availableViews: ViewType[];
}

const ViewContext = createContext<ViewContextType | null>(null);

interface ViewContextProviderProps {
  children: ReactNode;
}

export function ViewProvider({ children }: ViewContextProviderProps) {
  const { user } = useAuth();
  const [view, setViewState] = useState<ViewType>('orders');

  // Calculate user's view capabilities
  const viewMode = getUserViewMode(user);

  useEffect(() => {
    // Set initial view based on user permissions
    if (viewMode.defaultView) {
      setViewState(viewMode.defaultView as ViewType);
    }
  }, [viewMode.defaultView]);

  // Custom setView that respects permissions
  const setView = (newView: ViewType) => {
    // Only allow view changes if user has access to the requested view
    if (viewMode.availableViews.includes(newView)) {
      setViewState(newView);
    }
    // If user doesn't have permission, the view change is silently ignored
  };

  const value: ViewContextType = {
    view,
    setView,
    canToggle: viewMode.canToggle,
    availableViews: viewMode.availableViews as ViewType[]
  };

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  );
}

export function useViewContext(): ViewContextType {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useViewContext must be used within ViewProvider');
  }
  return context;
}