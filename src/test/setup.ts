// Test setup file for Vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Add missing DOM methods for Radix UI components
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function () {
    return false;
  };
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function () {};
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function () {};
}

// Mock HTMLDialogElement if it doesn't exist
if (typeof HTMLDialogElement === 'undefined') {
  (global as any).HTMLDialogElement = class HTMLDialogElement extends HTMLElement {
    open = false;

    showModal() {
      this.open = true;
      this.setAttribute('open', '');
    }

    close() {
      this.open = false;
      this.removeAttribute('open');
    }
  };
}

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Import toast helper for better toast mocking
import { mockToastImplementation } from '@/test/toast-test-helper';

// Mock useToast hook with DOM creation
vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockToastImplementation(),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasPermission: vi.fn(() => true),
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window methods that don't exist in test environment
if (typeof window !== 'undefined') {
  window.print = vi.fn();
  window.alert = vi.fn();
  window.confirm = vi.fn(() => true);
}

// Mock environment variables for testing
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';
// Use CI database URL if available, otherwise use local test database
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:testpassword@localhost:5432/globalrx_test';

// Suppress console errors during tests (can be removed for debugging)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') ||
       args[0].includes('ReactDOM.render'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.restoreAllMocks();
});