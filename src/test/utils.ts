// Test utility functions
import { vi } from 'vitest';
import { Session } from 'next-auth';
import { PrismaClient } from '@prisma/client';

/**
 * Create a mock Prisma client for testing
 */
export function createMockPrisma(): any {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customerService: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(createMockPrisma())),
  };
}

/**
 * Create a mock session for testing
 */
export function createMockSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      permissions: {
        customers: ['*'],
        users: ['*'],
        services: ['*']
      },
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Create a mock session with specific permissions
 */
export function createSessionWithPermissions(permissions: any): Session {
  return createMockSession({ permissions });
}

/**
 * Create a mock session for an unauthenticated user
 */
export function createUnauthenticatedSession(): null {
  return null;
}

/**
 * Mock NextRequest for API route testing
 */
export function createMockRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    searchParams?: Record<string, string>;
  } = {}
): Request {
  const url = new URL(options.url || 'http://localhost:3000/api/test');

  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  return new Request(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Helper to extract JSON response from NextResponse
 */
export async function getJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Helper to wait for async operations
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create test data factories
 */
export const testFactories = {
  user: (overrides = {}) => ({
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    email: `user-${Date.now()}@example.com`,
    name: 'Test User',
    password: 'hashedpassword',
    role: 'USER',
    permissions: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lockedUntil: null,
    failedAttempts: 0,
    ...overrides,
  }),

  customer: (overrides = {}) => ({
    id: 'cust-' + Math.random().toString(36).substr(2, 9),
    name: `Test Customer ${Date.now()}`,
    address: '123 Test St',
    contactName: 'Contact Person',
    contactEmail: 'contact@example.com',
    contactPhone: '555-0100',
    disabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  service: (overrides = {}) => ({
    id: 'serv-' + Math.random().toString(36).substr(2, 9),
    name: `Test Service ${Date.now()}`,
    description: 'Test service description',
    price: 100,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};