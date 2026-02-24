'use client';
// src/components/auth/auth-interceptor.tsx
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Define the paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// Auth Context type
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  checkPermission: (module: string, action?: string) => boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  fetchWithAuth: async () => new Response(),
  checkPermission: () => false,
});

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<any>(null);
  
  // Update user when session changes
  useEffect(() => {
    if (session?.user) {
      setUser(session.user);
    } else if (status !== 'loading') {
      setUser(null);
    }
  }, [session, status]);
  
  // Check if user has permission for a module/action
  const checkPermission = useCallback((module: string, action?: string): boolean => {
    // Allow everything in development for easier testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    if (!user?.permissions) return false;
    
    // Handle super admin case
    if (user.permissions === '*') return true;
    
    // Handle object permissions
    const permissions = user.permissions;
    
    // Check module access
    if (!permissions[module]) return false;
    
    // If no specific action, just check if module access exists
    if (!action) {
      // Handle boolean case
      if (typeof permissions[module] === 'boolean') {
        return permissions[module];
      }
      
      // Handle object case with view permission
      if (typeof permissions[module] === 'object') {
        return permissions[module].view === true;
      }
      
      // Handle other cases
      return true;
    }
    
    // Check specific action permission
    if (typeof permissions[module] === 'object') {
      return permissions[module][action] === true;
    }
    
    return false;
  }, [user]);
  
  // Function to fetch with authentication
  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    try {
      // Make the request with existing options
      const response = await fetch(url, options);
      
      // If unauthorized, try refreshing the session
      if (response.status === 401) {
        // Try to refresh the session
        const refreshResult = await signIn('refresh', { redirect: false });
        
        // If refresh was successful, retry the original request
        if (refreshResult?.ok) {
          return fetch(url, options);
        }
      }
      
      return response;
    } catch (error: unknown) {
      clientLogger.error('Error in fetchWithAuth:', error);
      throw error;
    }
  }, []);
  
  // Provide auth context
  const contextValue: AuthContextType = {
    isAuthenticated: !!session?.user,
    isLoading: status === 'loading',
    user: user,
    fetchWithAuth,
    checkPermission,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Auth Interceptor Component
export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Prevent redirect loops
  const redirectAttemptedRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  
  // Determine if current path is public
  const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path));
  
  // Handle redirect to login
  const redirectToLogin = useCallback(() => {
    // Skip if we've already attempted a redirect or we're already on a public path
    if (redirectAttemptedRef.current || isPublicPath) return;
    
    // Prevent infinite redirects
    redirectAttemptedRef.current = true;
    
    // Build the return URL
    const returnUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Store the return URL in localStorage for more reliable persistence
    if (returnUrl && returnUrl !== '/login') {
      localStorage.setItem('authReturnUrl', returnUrl);
    }
    
    // Redirect to login
    router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }, [router, pathname, searchParams, isPublicPath]);
  
  // Check authentication status
  useEffect(() => {
    // Always allow access to public paths
    if (isPublicPath) {
      setIsAuthorized(true);
      return;
    }
    
    // While loading, don't change auth state
    if (status === 'loading') {
      return;
    }
    
    // Mark initial load as completed
    initialLoadCompletedRef.current = true;
    
    // If authenticated, allow access
    if (session?.user) {
      setIsAuthorized(true);
      // Reset redirect flag when successfully authenticated
      redirectAttemptedRef.current = false;
      return;
    }
    
    // Not authenticated and not public path - redirect to login
    redirectToLogin();
  }, [session, status, isPublicPath, redirectToLogin]);
  
  // Reset redirect attempt flag when navigating to a new page
  useEffect(() => {
    // Only reset if we've completed the initial load
    if (initialLoadCompletedRef.current) {
      redirectAttemptedRef.current = false;
    }
  }, [pathname]);
  
  // Show loading state while checking authentication
  if (!isAuthorized && !isPublicPath && status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // If checking is done but not authorized, still show loading
  // This prevents showing protected content momentarily
  if (!isAuthorized && !isPublicPath && status !== 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
        <p className="ml-2">Redirecting to login...</p>
      </div>
    );
  }
  
  // Wrap children with auth provider
  return <AuthProvider>{children}</AuthProvider>;
}