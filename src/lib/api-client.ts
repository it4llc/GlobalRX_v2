// src/lib/api-client.ts
interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Build URL with query parameters
  const url = new URL(`/api/${endpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  // Set default headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Content-Type') && fetchOptions.method !== 'GET' && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Make the request
  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
  });

  // Handle authentication errors (will be handled by auth hooks)
  if (response.status === 401) {
    throw new Error('Authentication required');
  }

  if (response.status === 403) {
    throw new Error('Insufficient permissions');
  }

  // Parse the response
  const data = await response.json();

  // Handle application errors
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data as T;
}

// Helper methods for common operations
export const api = {
  get: <T>(endpoint: string, params?: Record<string, any>) =>
    apiFetch<T>(endpoint, { params }),
  post: <T>(endpoint: string, data: any) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: any) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};