// src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { hasPermission, normalizePermissions } from '@/lib/permission-utils';
import clientLogger from '@/lib/client-logger';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkPermission: (resource: string, action?: string) => boolean;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  checkPermission: () => false,
  fetchWithAuth: async () => new Response(),
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(status === 'loading');
  }, [status]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error: unknown) {
      clientLogger.error('Login attempt failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return { success: false, error: 'An unexpected error occurred during login' };
    }
  };

  // Logout function
  const logout = async () => {
    await signOut({ redirect: false });
  };

  // Check if user has a specific permission
  const checkPermission = (resource: string, action?: string): boolean => {
    if (!session?.user) return false;
    return hasPermission(session.user, resource, action);
  };

  // Fetch with authentication and error handling
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      // Add default headers
      const headers = new Headers(options.headers || {});
      
      if (!headers.has('Content-Type') && options.method !== 'GET' && options.body) {
        headers.set('Content-Type');
      }

      // Add CSRF token if needed
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Include cookies
      });

      // Handle unauthorized responses
      if (response.status === 401) {
        // Attempt to refresh the session
        const refreshResult = await signIn('refresh', { redirect: false });
        
        if (refreshResult?.error) {
          // If refresh fails, redirect to login
          window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`;
          throw new Error('Session expired');
        }
        
        // Retry the request
        return fetchWithAuth(url, options);
      }

      return response;
    } catch (error: unknown) {
      clientLogger.error('API request failed', {
        url,
        method: options.method || 'GET',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  };

  // Create a normalized version of the user with consistent permission format
  const normalizedUser = session?.user ? {
    ...session.user,
    permissions: normalizePermissions(session.user.permissions)
  } : null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session?.user,
        user: normalizedUser,
        isLoading,
        login,
        logout,
        checkPermission,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);