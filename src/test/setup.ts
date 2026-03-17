// Test setup file for Vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createMockPrisma } from './utils';

// Mock Prisma globally for all tests
vi.mock('@/lib/prisma', () => ({
  prisma: createMockPrisma()
}));

// Mock the logger globally
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn()
  }
}));

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

// Mock TranslationContext with common translations for testing
const testTranslations: Record<string, string> = {
  // Common translations
  'common.loading': 'Loading...',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.confirmDelete': 'Confirm Delete',
  'common.edit': 'Edit',
  'common.save': 'Save',
  'common.submit': 'Submit',
  'common.close': 'Close',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.code': 'Code',
  'common.location': 'Location',
  'common.updated': 'Updated',

  // Service comments
  'serviceComments.title': 'Comments',
  'serviceComments.addComment': 'Add Comment',
  'serviceComments.emptyState': 'No comments yet. Add the first comment.',
  'serviceComments.comment': 'Comment',
  'serviceComments.deleteConfirmation': 'Are you sure you want to delete this comment? This action cannot be undone.',
  'serviceComments.editComment': 'Edit Comment',
  'serviceComments.internal': 'Internal',
  'serviceComments.external': 'External',
  'serviceComments.addCommentTo': 'Add Comment to',
  'serviceComments.template': 'Template',
  'serviceComments.selectTemplate': 'Select a template...',
  'serviceComments.commentText': 'Comment Text',
  'serviceComments.visibility': 'Visibility',
  'serviceComments.internalOnly': 'Internal Only',

  // Module fulfillment
  'module.fulfillment.title': 'Fulfillment Services',
  'module.fulfillment.description': 'Manage outsourced order fulfillment',
  'module.fulfillment.email': 'Email',
  'module.fulfillment.notes': 'Notes',
  'module.fulfillment.middleName': 'Middle Name',
  'module.fulfillment.submitted': 'Submitted',
  'module.fulfillment.processing': 'Processing',
  'module.fulfillment.pending': 'Pending',
  'module.fulfillment.firstName': 'First Name',
  'module.fulfillment.lastName': 'Last Name',
  'module.fulfillment.dateOfBirth': 'Date of Birth',
  'module.fulfillment.phone': 'Phone',
  'module.fulfillment.ssn': 'SSN',
  'module.fulfillment.orderNumber': 'Order Number',
  'module.fulfillment.orderInformation': 'Order Information',
  'module.fulfillment.subjectInformation': 'Subject Information',
  'module.fulfillment.orderItems': 'Order Items',
  'module.fulfillment.customerDetails': 'Customer Details',
  'module.fulfillment.created': 'Created',

  // Order details
  'order.subject.firstName': 'First Name',
  'order.subject.lastName': 'Last Name',
  'order.subject.dateOfBirth': 'Date of Birth',
  'order.subject.email': 'Email',
  'order.subject.phone': 'Phone',
  'order.subject.ssn': 'SSN',

  // Status labels
  'status.pending': 'Pending',
  'status.processing': 'Processing',
  'status.completed': 'Completed',
  'status.failed': 'Failed',
  'status.submitted': 'Submitted',
};

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => testTranslations[key] || key,  // Return translation or key if not found
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  }),
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
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