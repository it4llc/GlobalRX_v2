// src/components/auth/session-timeout.tsx
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

// 2 minutes timeout for testing (120,000 ms)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 
// Show warning 30 seconds before logout for testing (30,000 ms)
const WARNING_TIME = 2 * 60 * 1000;

export function SessionTimeout() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  
  // Only execute the timer logic when user is authenticated
  const isAuthenticated = status === 'authenticated' && !!session;

  const resetTimer = useCallback(() => {
    // Skip if not authenticated
    if (!isAuthenticated) return;
    
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    
    // Reset warning flag
    warningShownRef.current = false;
    
    // Set warning timeout
    warningRef.current = setTimeout(() => {
      warningShownRef.current = true;
      // Check if user wants to stay logged in using the browser's built-in confirm dialog
      const stayLoggedIn = window.confirm(
        'Your session is about to expire due to inactivity. Would you like to stay logged in?'
      );
      
      if (stayLoggedIn) {
        // User wants to stay - reset the timer
        resetTimer();
      } else {
        // User chose to logout - do it immediately
        signOut({ redirect: true, callbackUrl: '/login?timeout=true' });
      }
    }, INACTIVITY_TIMEOUT - WARNING_TIME);
    
    // Set final timeout - logout after total timeout period
    timeoutRef.current = setTimeout(() => {
      // Only logout if warning was shown and user didn't respond
      if (warningShownRef.current) {
        signOut({ redirect: true, callbackUrl: '/login?timeout=true' });
      }
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated]);

  // Setup event listeners lazily only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Events that reset the timer - use passive option for better performance
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Set initial timer
    resetTimer();
    
    // Add event listeners to reset timer on user activity
    const options = { passive: true };
    events.forEach(event => {
      window.addEventListener(event, resetTimer, options);
    });
    
    // Clean up
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, resetTimer]);

  // Reset timer on route changes only when necessary
  useEffect(() => {
    if (isAuthenticated) {
      resetTimer();
    }
  }, [pathname, resetTimer, isAuthenticated]);

  // Handle tab visibility changes with optimized logic
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Track when the user actually closes the browser window or tab
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('tabClosed', 'true');
    });
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to the page - just reset the timer
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, resetTimer]);

  return null; // This component doesn't render anything
}