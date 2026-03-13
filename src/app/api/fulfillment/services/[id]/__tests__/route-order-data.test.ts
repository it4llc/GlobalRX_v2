// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/__tests__/route-order-data.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { ServiceOrderDataService } from '@/lib/services/service-order-data.service';
import { prisma } from '@/lib/prisma';

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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendorOrganization: {
      findUnique: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    }
  }
}));

describe('GET /api/fulfillment/services/[id] - Order Data Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('orderData inclusion', () => {
    const mockServiceWithoutOrderData = {
      id: 'srv_123',
      orderId: 'ord_456',
      orderItemId: 'item_789',
      serviceId: 'svc_001',
      locationId: 'loc_001',
      status: 'processing',
      order: {
        id: 'ord_456',
        orderNumber: '20250312-ABC-0001',
        customerId: 'cust_123',
        subject: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      },
      assignedVendorId: null
    };

    it('should include orderData field in response for internal users', async () => {
      // Business Rule 7: Order data returned as part of existing service response
      // Business Rule 6: All users who can view a service can see all its order data fields
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockServiceWithoutOrderData);

      const mockOrderData = {
        'School Name': 'University of Michigan',
        'Degree Type': 'Bachelor\'s',
        'Graduation Date': '2020-05-15'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('orderData');
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for vendor users viewing their assigned services', async () => {
      // Business Rule 6: All users who can view a service can see all its order data fields
      const vendorService = {
        ...mockServiceWithoutOrderData,
        assignedVendorId: 'vendor_123'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor_user',
          userType: 'vendor',
          vendorId: 'vendor_123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(vendorService);

      const mockOrderData = {
        'Company Name': 'Tech Corp',
        'Position': 'Software Engineer',
        'Employment Dates': '2018-2022'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('orderData');
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for customer users viewing their own services', async () => {
      // Business Rule 6: All users who can view a service can see all its order data fields
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer_user',
          userType: 'customer',
          customerId: 'cust_123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockServiceWithoutOrderData);

      const mockOrderData = {
        'Reference Name': 'Jane Smith',
        'Reference Phone': '555-0123',
        'Relationship': 'Former Manager'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('orderData');
      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should return empty object when no order data exists', async () => {
      // Edge Case 1: No order data exists
      // Business Rule 8: If no order data exists, orderData should be empty object
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockServiceWithoutOrderData);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce({});

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual({});
    });

    it('should handle service without orderItemId gracefully', async () => {
      // Edge Case 3: OrderItem not found for service
      const serviceWithoutOrderItem = {
        ...mockServiceWithoutOrderData,
        orderItemId: null
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(serviceWithoutOrderItem);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce({});

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.orderData).toEqual({});
      expect(ServiceOrderDataService.getOrderDataForService).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('should handle order data service failure gracefully', async () => {
      // Edge Case 4: Database query fails
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockServiceWithoutOrderData);
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockRejectedValueOnce(
        new Error('Database error')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200); // Should still return service data

      const data = await response.json();
      expect(data).toHaveProperty('id', 'srv_123');
      expect(data.orderData).toEqual({}); // Empty object on failure
    });
  });

  describe('orderData with excluded subject fields', () => {
    it('should not include subject fields in orderData', async () => {
      // Business Rule 3: Subject Information fields must NOT be included
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      const mockService = {
        id: 'srv_123',
        orderItemId: 'item_789',
        order: {
          subject: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-1234'
          }
        }
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);

      // Service should have already filtered these out
      const mockOrderData = {
        'School Name': 'MIT',
        'Degree': 'Computer Science'
        // No firstName, lastName, email, phone fields
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData).not.toHaveProperty('firstName');
      expect(data.orderData).not.toHaveProperty('First Name');
      expect(data.orderData).not.toHaveProperty('email');
      expect(data.orderData).not.toHaveProperty('Email');
      expect(data.orderData).toHaveProperty('School Name', 'MIT');
    });
  });

  describe('orderData with special values', () => {
    it('should handle very long field values', async () => {
      // Edge Case 6: Very long field values
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_123',
        orderItemId: 'item_789'
      });

      const longValue = 'A'.repeat(5000);
      const mockOrderData = {
        'Description': longValue
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData.Description).toHaveLength(5000);
    });

    it('should handle special characters in field values', async () => {
      // Edge Case 7: Special characters in field values
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_123',
        orderItemId: 'item_789'
      });

      const mockOrderData = {
        'Company': 'O\'Reilly & Associates',
        'Notes': 'Contains "quotes" and <html> tags',
        'International': '� � -�'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData.Company).toBe('O\'Reilly & Associates');
      expect(data.orderData.Notes).toBe('Contains "quotes" and <html> tags');
      expect(data.orderData.International).toBe('� � -�');
    });

    it('should preserve original data types as strings', async () => {
      // Business Rule 9: Field values returned exactly as stored
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_123',
        orderItemId: 'item_789'
      });

      const mockOrderData = {
        'Date Field': '2020-05-15', // Date as string
        'Number Field': '42', // Number as string
        'Boolean Field': 'true', // Boolean as string
        'Null Field': null
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(typeof data.orderData['Date Field']).toBe('string');
      expect(data.orderData['Date Field']).toBe('2020-05-15');
      expect(typeof data.orderData['Number Field']).toBe('string');
      expect(data.orderData['Number Field']).toBe('42');
      expect(typeof data.orderData['Boolean Field']).toBe('string');
      expect(data.orderData['Boolean Field']).toBe('true');
      expect(data.orderData['Null Field']).toBeNull();
    });
  });

  describe('orderData for all service types', () => {
    it('should include orderData for education verification service', async () => {
      // Business Rule 1: Order data must be included for ALL service types
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_edu',
        serviceId: 'education_verification',
        orderItemId: 'item_edu'
      });

      const mockOrderData = {
        'School Name': 'Harvard',
        'Degree': 'MBA'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_edu');
      const params = { params: { id: 'srv_edu' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for employment verification service', async () => {
      // Business Rule 1: Order data must be included for ALL service types
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_emp',
        serviceId: 'employment_verification',
        orderItemId: 'item_emp'
      });

      const mockOrderData = {
        'Company': 'Google',
        'Position': 'Senior Engineer'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_emp');
      const params = { params: { id: 'srv_emp' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData).toEqual(mockOrderData);
    });

    it('should include orderData for criminal background check', async () => {
      // Business Rule 1: Order data must be included for ALL service types
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user_internal',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce({
        id: 'srv_criminal',
        serviceId: 'criminal_background',
        orderItemId: 'item_criminal'
      });

      const mockOrderData = {
        'Counties': 'Los Angeles, Orange County',
        'Years to Search': '7'
      };
      vi.mocked(ServiceOrderDataService.getOrderDataForService).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_criminal');
      const params = { params: { id: 'srv_criminal' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.orderData).toEqual(mockOrderData);
    });
  });

  describe('permission validation with orderData', () => {
    it('should return 403 when vendor tries to access unassigned service with orderData', async () => {
      // Existing permission rules still apply
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor_user',
          userType: 'vendor',
          vendorId: 'vendor_123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockRejectedValueOnce(
        new Error('Access denied')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      // Should not call getOrderDataForService
      expect(ServiceOrderDataService.getOrderDataForService).not.toHaveBeenCalled();
    });

    it('should return 403 when customer tries to access another customer\'s service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer_user',
          userType: 'customer',
          customerId: 'cust_123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockRejectedValueOnce(
        new Error('Access denied')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/srv_123');
      const params = { params: { id: 'srv_123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      // Should not call getOrderDataForService
      expect(ServiceOrderDataService.getOrderDataForService).not.toHaveBeenCalled();
    });
  });
});