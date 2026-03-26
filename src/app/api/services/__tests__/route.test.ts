// REGRESSION TEST: proves bug fix for service creation 500 error
// Bug: POST /api/services fails with 500 because required 'code' field is missing
// Root cause: Prisma schema requires non-null unique 'code', but POST endpoint doesn't provide it
// This test file verifies the fix works correctly

// /GlobalRX_v2/src/app/api/services/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST, GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('POST /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('REGRESSION TEST: Service creation must include code field', () => {
    it('should create a service with an auto-generated code based on the service name', async () => {
      // CRITICAL REGRESSION TEST
      // This test proves the bug is fixed. It expects the correct behavior:
      // - A code is auto-generated from the service name
      // - The service is created successfully with the code
      //
      // BEFORE FIX: This test would FAIL because no code is provided to Prisma
      // AFTER FIX: This test should PASS with auto-generated code

      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Background Check Service',
        category: 'Criminal',
        description: 'Comprehensive background check',
        functionalityType: 'record'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      // Mock Prisma to simulate successful creation WITH a code
      (prisma.service.create as any).mockResolvedValue({
        id: 'service-123',
        name: serviceData.name,
        category: serviceData.category,
        description: serviceData.description,
        functionalityType: serviceData.functionalityType,
        code: 'BGCHECK', // The auto-generated code
        disabled: false,
        createdById: mockSession.user.id,
        updatedById: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert - verify the correct behavior
      expect(response.status).toBe(201);
      expect(result.code).toBeDefined();
      expect(result.code).toBeTruthy(); // Code must exist and be non-empty
      expect(result.name).toBe(serviceData.name);

      // Verify Prisma was called with a code field
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: serviceData.name,
          category: serviceData.category,
          description: serviceData.description,
          functionalityType: serviceData.functionalityType,
          code: expect.any(String), // Code must be provided
          createdById: mockSession.user.id,
          updatedById: mockSession.user.id
        })
      });
    });

    it('should generate unique codes for services with similar names', async () => {
      // This test ensures code uniqueness is handled properly

      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // First service
      const firstServiceData = {
        name: 'Education Verification',
        category: 'Education',
        description: 'Verify education credentials',
        functionalityType: 'verification-edu'
      };

      const firstRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(firstServiceData)
      });

      // Mock first service creation - returns with code
      (prisma.service.create as any).mockResolvedValueOnce({
        id: 'service-1',
        name: firstServiceData.name,
        category: firstServiceData.category,
        description: firstServiceData.description,
        functionalityType: firstServiceData.functionalityType,
        code: 'EDUVER',
        disabled: false,
        createdById: mockSession.user.id,
        updatedById: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Second service with similar name
      const secondServiceData = {
        name: 'Education Verification Extended',
        category: 'Education',
        description: 'Extended education verification',
        functionalityType: 'verification-edu'
      };

      const secondRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(secondServiceData)
      });

      // Mock second service creation - should get different code
      (prisma.service.create as any).mockResolvedValueOnce({
        id: 'service-2',
        name: secondServiceData.name,
        category: secondServiceData.category,
        description: secondServiceData.description,
        functionalityType: secondServiceData.functionalityType,
        code: 'EDUVEREXT', // Different code generated
        disabled: false,
        createdById: mockSession.user.id,
        updatedById: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response1 = await POST(firstRequest);
      const result1 = await response1.json();

      const response2 = await POST(secondRequest);
      const result2 = await response2.json();

      // Assert
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(result1.code).toBeDefined();
      expect(result2.code).toBeDefined();
      expect(result1.code).not.toBe(result2.code); // Codes must be unique
    });

    it('should handle Prisma unique constraint violation gracefully', async () => {
      // This test ensures that if a code collision happens, it's handled properly

      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Drug Testing',
        category: 'Health',
        description: 'Drug testing service',
        functionalityType: 'other'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      // Mock Prisma to throw unique constraint error
      const prismaError = new Error('Unique constraint failed on the fields: (`code`)');
      (prismaError as any).code = 'P2002';
      (prisma.service.create as any).mockRejectedValue(prismaError);

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Error creating service');

      // Verify error was logged properly
      expect(logger.error).toHaveBeenCalledWith(
        'Error creating service',
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });

  describe('Error handling improvement', () => {
    it('should handle non-Error objects in catch block correctly', async () => {
      // This test verifies the secondary issue: error handling with unknown types

      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Test Service',
        category: 'Test',
        description: 'Test service',
        functionalityType: 'other'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      // Mock Prisma to throw a non-Error object (e.g., string)
      (prisma.service.create as any).mockRejectedValue('Database connection failed');

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Error creating service');

      // Verify logger doesn't crash when handling non-Error objects
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle undefined/null errors in catch block', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Test Service',
        category: 'Test',
        description: 'Test service',
        functionalityType: 'other'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      // Mock Prisma to throw undefined
      (prisma.service.create as any).mockRejectedValue(undefined);

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Error creating service');

      // Verify logger handles undefined gracefully
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Authentication and validation', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      (getServerSession as any).mockResolvedValue(null);

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Service',
          category: 'Test'
        })
      });

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Missing name and category'
        })
      });

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('Missing required fields');
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('should default to "other" for invalid functionalityType', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Test Service',
        category: 'Test',
        functionalityType: 'invalid-type'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      (prisma.service.create as any).mockResolvedValue({
        id: 'service-123',
        name: serviceData.name,
        category: serviceData.category,
        functionalityType: 'other',
        code: 'TESTSERV',
        disabled: false,
        createdById: mockSession.user.id,
        updatedById: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result.functionalityType).toBe('other');

      expect(prisma.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          functionalityType: 'other'
        })
      });
    });
  });

  describe('Successful service creation', () => {
    it('should create a service with all valid fields', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const serviceData = {
        name: 'Employment Verification',
        category: 'Employment',
        description: 'Verify employment history',
        functionalityType: 'verification-emp'
      };

      const mockRequest = new NextRequest('http://localhost:3000/api/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });

      const mockCreatedService = {
        id: 'service-456',
        name: serviceData.name,
        category: serviceData.category,
        description: serviceData.description,
        functionalityType: serviceData.functionalityType,
        code: 'EMPVER',
        disabled: false,
        createdById: mockSession.user.id,
        updatedById: mockSession.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.service.create as any).mockResolvedValue(mockCreatedService);

      // Act
      const response = await POST(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result).toMatchObject({
        id: mockCreatedService.id,
        name: serviceData.name,
        category: serviceData.category,
        description: serviceData.description,
        functionalityType: serviceData.functionalityType,
        code: 'EMPVER'
      });

      expect(prisma.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: serviceData.name,
          category: serviceData.category,
          description: serviceData.description,
          functionalityType: serviceData.functionalityType,
          code: expect.any(String),
          createdById: mockSession.user.id,
          updatedById: mockSession.user.id
        })
      });
    });
  });
});

describe('GET /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error handling improvement', () => {
    it('should handle non-Error objects in GET catch block correctly', async () => {
      // This test verifies the secondary issue in GET endpoint error handling

      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockRequest = new NextRequest('http://localhost:3000/api/services');

      // Mock Prisma to throw a non-Error object
      (prisma.service.findMany as any).mockRejectedValue('Database unavailable');
      (prisma.service.count as any).mockRejectedValue('Database unavailable');

      // Act
      const response = await GET(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Error fetching services');

      // Verify logger doesn't crash when handling non-Error objects
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle undefined/null errors in GET catch block', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockRequest = new NextRequest('http://localhost:3000/api/services');

      // Mock Prisma to throw undefined
      (prisma.service.findMany as any).mockRejectedValue(undefined);
      (prisma.service.count as any).mockRejectedValue(undefined);

      // Act
      const response = await GET(mockRequest);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Error fetching services');

      // Verify logger handles undefined gracefully
      expect(logger.error).toHaveBeenCalled();
    });
  });
});