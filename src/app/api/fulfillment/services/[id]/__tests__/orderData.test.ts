// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/__tests__/orderData.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { ServiceOrderDataService } from '@/lib/services/service-order-data.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    getServiceById: vi.fn()
  }
}));

vi.mock('@/lib/services/service-order-data.service', () => ({
  ServiceOrderDataService: {
    getOrderDataForService: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/lib/i18n/server-translations', () => ({
  getServerTranslations: vi.fn(() => (key: string) => key)
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn()
    }
  }
}));

describe('GET /api/fulfillment/services/[id] - Order Data Integration', () => {
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockOrderItemId = 'order-item-456';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440003';

  const mockService = {
    id: mockServiceId,
    orderId: mockOrderId,
    orderItemId: mockOrderItemId,
    serviceId: 'edu-verification',
    locationId: 'location-1',
    status: 'Processing',
    assignedVendorId: null,
    vendorNotes: null,
    internalNotes: null,
    assignedAt: null,
    assignedBy: null,
    completedAt: null,
    createdAt: new Date('2024-03-01T09:00:00Z'),
    updatedAt: new Date('2024-03-01T09:00:00Z'),
    order: {
      id: mockOrderId,
      orderNumber: 'ORD-2024-001',
      customerId: 'customer-123',
      subject: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        ssn: '123-45-6789'
      }
    },
    orderItem: {
      id: mockOrderItemId,
      serviceId: 'edu-verification',
      locationId: 'location-1'
    },
    service: {
      id: 'edu-verification',
      name: 'Education Verification',
      code: 'EDU'
    },
    location: {
      id: 'location-1',
      name: 'National',
      code2: 'US'
    }
  };

  const mockOrderData = {
    'School Name': 'University of Michigan',
    'Degree Type': 'Bachelor of Science',
    'Graduation Year': '2020',
    'Major': 'Computer Science',
    'Student ID': '12345678'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Data Inclusion', () => {
    it('should include orderData in the response for authenticated users', async () => {
      // Business Rule 7: Order data returned as part of existing service response
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('orderData');
      expect(data.orderData).toEqual(mockOrderData);

      // Verify the service data is included too
      expect(data.id).toBe(mockServiceId);
      expect(data.service.name).toBe('Education Verification');
    });

    it('should call ServiceOrderDataService with correct parameters', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      await GET(request, { params: { id: mockServiceId } });

      // Business Rule 8: Subject information fields must not be duplicated
      expect(ServiceOrderDataService.getOrderDataForService).toHaveBeenCalledWith(
        mockOrderItemId,
        mockService.order.subject
      );
    });

    it('should return empty orderData object when no data exists', async () => {
      // Business Rule 8: If no order data exists, orderData should be empty object
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce({});

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual({});
    });

    it('should return empty orderData when ServiceOrderDataService returns null', async () => {
      // Edge Case 3: API returns null for orderData
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(null as any);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual({});
    });

    it('should handle error in ServiceOrderDataService gracefully', async () => {
      // Edge Case 4: Database query fails
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      // Should still return 200 with empty orderData
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual({});

      // Service data should still be included
      expect(data.id).toBe(mockServiceId);
    });

    it('should fetch order subject separately if not included in service response', async () => {
      // When service doesn't include order.subject
      const serviceWithoutSubject = {
        ...mockService,
        order: {
          id: mockOrderId,
          orderNumber: 'ORD-2024-001',
          customerId: 'customer-123'
          // No subject field
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(serviceWithoutSubject);

      // Mock Prisma to return subject when fetched separately
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        subject: mockService.order.subject
      } as any);

      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      // Verify Prisma was called to fetch subject
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        select: { subject: true }
      });

      // Verify ServiceOrderDataService was called with the fetched subject
      expect(ServiceOrderDataService.getOrderDataForService).toHaveBeenCalledWith(
        mockOrderItemId,
        mockService.order.subject
      );

      const data = await response.json();
      expect(data.orderData).toEqual(mockOrderData);
    });
  });

  describe('User Type Access to Order Data', () => {
    it('should include orderData for internal users with fulfillment permission', async () => {
      // Business Rule 6: All users who can view a service can see all its order data fields
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'internal-user',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for vendor users viewing assigned services', async () => {
      const vendorService = {
        ...mockService,
        assignedVendorId: 'vendor-123'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123'
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(vendorService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for customer users viewing their own orders', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123'
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderData).toEqual(mockOrderData);
    });
  });

  describe('Order Data for Different Service Types', () => {
    it('should include orderData for education verification service', async () => {
      // Business Rule 1: Order data must be included for ALL service types
      const educationData = {
        'School Name': 'Harvard University',
        'Degree Type': 'Master of Business Administration',
        'Graduation Year': '2018',
        'Major': 'Finance',
        'GPA': '3.8'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(educationData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      const data = await response.json();
      expect(data.orderData).toEqual(educationData);
    });

    it('should include orderData for employment verification service', async () => {
      const employmentService = {
        ...mockService,
        service: {
          id: 'emp-verification',
          name: 'Employment Verification',
          code: 'EMP'
        }
      };

      const employmentData = {
        'Company Name': 'Tech Corp',
        'Position': 'Software Engineer',
        'Employment Start Date': '2018-01-15',
        'Employment End Date': '2022-12-31',
        'Supervisor Name': 'Jane Smith',
        'Reason for Leaving': 'Career advancement'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(employmentService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(employmentData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      const data = await response.json();
      expect(data.orderData).toEqual(employmentData);
    });

    it('should include orderData for criminal background check service', async () => {
      const backgroundService = {
        ...mockService,
        service: {
          id: 'criminal-check',
          name: 'Criminal Background Check',
          code: 'CBC'
        }
      };

      const backgroundData = {
        'Consent Given': 'true',
        'Search Jurisdictions': 'National, State, County',
        'Years to Search': '7',
        'Include Aliases': 'true',
        'Aliases': 'John Smith, J. Doe'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(backgroundService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(backgroundData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      const data = await response.json();
      expect(data.orderData).toEqual(backgroundData);
    });
  });

  describe('Performance', () => {
    it('should not block response if orderData fetch is slow', async () => {
      // Business Rule 10: No performance degradation
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);

      // Simulate slow orderData fetch
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockOrderData), 100))
      );

      const startTime = Date.now();
      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });
      const endTime = Date.now();

      expect(response.status).toBe(200);

      // Response should complete even with slow orderData fetch
      expect(endTime - startTime).toBeLessThan(200);

      const data = await response.json();
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should handle large orderData objects efficiently', async () => {
      const largeOrderData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeOrderData[`Field_${i}`] = `Value_${i}`.repeat(100);
      }

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(largeOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Object.keys(data.orderData)).toHaveLength(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle orderData with special characters in field names', async () => {
      const specialOrderData = {
        'Field & Name': 'Value 1',
        'Field<Name>': 'Value 2',
        'Field "Name"': 'Value 3',
        'Field\\Name': 'Value 4',
        "Field'Name": 'Value 5'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(specialOrderData);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual(specialOrderData);
    });

    it('should prevent customers from accessing other customers services', async () => {
      // Security test: Customer should not be able to access another customer's service
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-456',
          userType: 'customer',
          customerId: 'different-customer',
          permissions: {}
        }
      });

      // Mock a service that belongs to a different customer
      const otherCustomerService = {
        ...mockService,
        order: {
          ...mockService.order,
          customerId: 'customer-123' // Different from session customer
        }
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(otherCustomerService);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(404); // Should return 404 to not reveal existence
    });

    it('should handle orderData with various data types', async () => {
      const mixedTypeData = {
        'String Field': 'text value',
        'Number Field': 12345,
        'Boolean Field': true,
        'Date Field': new Date('2024-03-15').toISOString(),
        'Null Field': null,
        'Array Field': ['item1', 'item2']
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mixedTypeData as any);

      const request = new Request(`http://localhost:3000/api/fulfillment/services/${mockServiceId}`);
      const response = await GET(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual(mixedTypeData);
    });
  });
});