// /GlobalRX_v2/src/app/api/services/[id]/__tests__/uuid-storage-regression.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as uploadAttachment } from '../attachments/route';
import { PUT as updateResults } from '../results/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// REGRESSION TEST: Verify that attachment creation and results updates store
// session.user.id (UUID string), not an integer userId.
// These tests guard against any future regression back to the old workaround
// pattern where prisma.user.findUnique was called to get an integer userId.

vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn().mockReturnValue(true)
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn()
    },
    servicesFulfillment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    serviceAttachment: {
      create: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  default: {},
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

// Only declare what the production code actually uses from 'fs'.
// Using importOriginal + spreading in Vitest 4 ESM mode does not reliably
// override named exports — the production import stays bound to the real function.
vi.mock('fs', () => ({
  default: {},
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('crypto', () => ({
  default: {},
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234')
}));

vi.mock('@/types/service-results', () => ({
  isTerminalStatus: vi.fn().mockReturnValue(false),
  updateResultsSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { results: 'Test results content' }
    })
  }
}));

// Helper: creates a mock POST request that bypasses real FormData/Blob/File parsing.
// In the Node.js/Vitest environment, creating a Request with a FormData body and then
// calling request.formData() produces a File object whose arrayBuffer() method is not
// reliably supported. This helper provides a properly mocked file with a working
// arrayBuffer() so the production code can proceed past the file-read step.
function makeMockPdfRequest(fileName = 'test.pdf', fileSize = 1024) {
  const mockFile = {
    name: fileName,
    type: 'application/pdf',
    size: fileSize,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(fileSize))
  };
  return {
    formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(mockFile) })
  } as unknown as Request;
}

describe('UUID Storage Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ServiceAttachment.uploadedBy', () => {
    it('REGRESSION TEST: should store session.user.id (UUID) in uploadedBy field, not integer userId', async () => {
      // Arrange
      const userUuid = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: userUuid,
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: 'order-item-uuid-123',
        orderId: 'order-uuid-456',
        status: 'Processing',
        serviceFulfillment: {
          id: 'fulfillment-uuid-789'
        }
      };
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem);

      // Capture what gets saved to the database
      let savedAttachmentData: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: {
            create: vi.fn().mockImplementation((args) => {
              savedAttachmentData = args.data;
              return Promise.resolve({
                id: 1,
                ...args.data,
                uploadedAt: new Date()
              });
            })
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({})
          }
        };
        return await callback(tx);
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest('test.pdf', 1024);

      // Act
      const response = await uploadAttachment(request, { params: { id: 'order-item-uuid-123' } });

      // Assert
      expect(response.status).toBe(201);
      expect(savedAttachmentData).toBeDefined();

      // REGRESSION: uploadedBy must be the UUID string, never an integer
      expect(savedAttachmentData.uploadedBy).toBe(userUuid);
      expect(typeof savedAttachmentData.uploadedBy).toBe('string');
      expect(savedAttachmentData.uploadedBy).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('ServicesFulfillment.resultsAddedBy and resultsLastModifiedBy', () => {
    it('REGRESSION TEST: should store session.user.id (UUID) in resultsAddedBy when adding results for first time', async () => {
      // Arrange
      const userUuid = '660e8400-e29b-41d4-a716-446655440001';
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: userUuid,
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: 'order-item-uuid-123',
        status: 'Processing',
        serviceFulfillment: {
          id: 'fulfillment-uuid-789',
          results: null,       // No existing results
          resultsAddedBy: null // Never had results before
        }
      };
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem);

      // Capture what gets saved to the database
      let savedData: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          servicesFulfillment: {
            update: vi.fn().mockImplementation((args) => {
              savedData = args.data;
              return Promise.resolve({ id: 'fulfillment-uuid-789', ...args.data });
            })
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({})
          }
        };
        return await callback(tx);
      });

      // Mock the follow-up findUnique that fetches user relations for the response
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: 'fulfillment-uuid-789',
        results: 'Test results content',
        resultsAddedBy: userUuid,
        resultsAddedAt: new Date(),
        resultsLastModifiedBy: userUuid,
        resultsLastModifiedAt: new Date(),
        resultsAddedByUser: { email: 'user@test.com', firstName: 'Test', lastName: 'User' },
        resultsModifiedByUser: { email: 'user@test.com', firstName: 'Test', lastName: 'User' }
      });

      const request = new Request('http://localhost/api/services/order-item-uuid-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test results content' })
      });

      // Act
      const response = await updateResults(request, { params: { id: 'order-item-uuid-123' } });

      // Assert
      expect(response.status).toBe(200);
      expect(savedData).toBeDefined();

      // REGRESSION: resultsAddedBy must be UUID, never integer
      expect(savedData.resultsAddedBy).toBe(userUuid);
      expect(savedData.resultsLastModifiedBy).toBe(userUuid);
      expect(typeof savedData.resultsAddedBy).toBe('string');
      expect(typeof savedData.resultsLastModifiedBy).toBe('string');
      expect(savedData.resultsAddedBy).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('REGRESSION TEST: should store session.user.id (UUID) in resultsLastModifiedBy when updating existing results', async () => {
      // Arrange
      const originalUserUuid = '770e8400-e29b-41d4-a716-446655440002';
      const updatingUserUuid = '880e8400-e29b-41d4-a716-446655440003';
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: updatingUserUuid,
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: 'order-item-uuid-123',
        status: 'Processing',
        serviceFulfillment: {
          id: 'fulfillment-uuid-789',
          results: 'Original results',       // Has existing results
          resultsAddedBy: originalUserUuid,  // Set by a different user
          resultsAddedAt: new Date('2024-01-01')
        }
      };
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem);

      // Capture what gets saved to the database
      let savedData: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          servicesFulfillment: {
            update: vi.fn().mockImplementation((args) => {
              savedData = args.data;
              return Promise.resolve({ id: 'fulfillment-uuid-789', ...args.data });
            })
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({})
          }
        };
        return await callback(tx);
      });

      // Mock the follow-up findUnique that fetches user relations for the response
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: 'fulfillment-uuid-789',
        results: 'Updated test results',
        resultsAddedBy: originalUserUuid,
        resultsAddedAt: new Date('2024-01-01'),
        resultsLastModifiedBy: updatingUserUuid,
        resultsLastModifiedAt: new Date(),
        resultsAddedByUser: { email: 'original@test.com', firstName: 'Original', lastName: 'User' },
        resultsModifiedByUser: { email: 'updating@test.com', firstName: 'Updating', lastName: 'User' }
      });

      const request = new Request('http://localhost/api/services/order-item-uuid-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Updated test results' })
      });

      // Act
      const response = await updateResults(request, { params: { id: 'order-item-uuid-123' } });

      // Assert
      expect(response.status).toBe(200);
      expect(savedData).toBeDefined();

      // REGRESSION: original author must not be overwritten on subsequent edits
      expect(savedData.resultsAddedBy).toBeUndefined();

      // REGRESSION: resultsLastModifiedBy must be updating user's UUID, never integer
      expect(savedData.resultsLastModifiedBy).toBe(updatingUserUuid);
      expect(typeof savedData.resultsLastModifiedBy).toBe('string');
      expect(savedData.resultsLastModifiedBy).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('No integer userId lookup should occur', () => {
    it('REGRESSION TEST: should NOT query User table for userId when uploading attachment', async () => {
      // Arrange
      const userUuid = '990e8400-e29b-41d4-a716-446655440004';
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: userUuid,
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: 'order-item-uuid-123',
        orderId: 'order-uuid-456',
        status: 'Processing',
        serviceFulfillment: { id: 'fulfillment-uuid-789' }
      };
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem);

      // Transaction mock intentionally omits user.findUnique —
      // if production code tried to access tx.user, it would throw a TypeError,
      // failing the test and alerting us to the regression
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: {
            create: vi.fn().mockResolvedValue({
              id: 1,
              serviceFulfillmentId: 'fulfillment-uuid-789',
              fileName: 'test.pdf',
              filePath: 'uploads/test.pdf',
              fileSize: 1024,
              uploadedBy: userUuid,
              uploadedAt: new Date()
            })
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({})
          }
          // Intentionally no 'user' property — regression guard
        };
        return await callback(tx);
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest('test.pdf', 1024);

      // Act
      const response = await uploadAttachment(request, { params: { id: 'order-item-uuid-123' } });

      // Assert — if we get 201, the code did not try to access tx.user
      expect(response.status).toBe(201);
    });

    it('REGRESSION TEST: should NOT query User table for userId when updating results', async () => {
      // Arrange
      const userUuid = 'aa0e8400-e29b-41d4-a716-446655440005';
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: userUuid,
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: 'order-item-uuid-123',
        status: 'Processing',
        serviceFulfillment: {
          id: 'fulfillment-uuid-789',
          results: null,
          resultsAddedBy: null
        }
      };
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem);

      // Transaction mock intentionally omits user.findUnique —
      // regression guard (see attachment test above for explanation)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          servicesFulfillment: {
            update: vi.fn().mockResolvedValue({
              id: 'fulfillment-uuid-789',
              results: 'Test results',
              resultsAddedBy: userUuid,
              resultsLastModifiedBy: userUuid
            })
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({})
          }
          // Intentionally no 'user' property — regression guard
        };
        return await callback(tx);
      });

      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: 'fulfillment-uuid-789',
        results: 'Test results',
        resultsAddedBy: userUuid,
        resultsLastModifiedBy: userUuid,
        resultsAddedByUser: { email: 'user@test.com', firstName: 'Test', lastName: 'User' },
        resultsModifiedByUser: { email: 'user@test.com', firstName: 'Test', lastName: 'User' }
      });

      const request = new Request('http://localhost/api/services/order-item-uuid-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test results' })
      });

      // Act
      const response = await updateResults(request, { params: { id: 'order-item-uuid-123' } });

      // Assert — if we get 200, the code did not try to access tx.user
      expect(response.status).toBe(200);
    });
  });
});
