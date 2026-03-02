// /GlobalRX_v2/src/app/api/customers/[id]/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from './route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    customerService: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('GET /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BUG: Permission system mismatch', () => {
    it('FAILING TEST: should allow access with NEW customer_config permission format', async () => {
      // THIS TEST PROVES THE BUG EXISTS
      // Users have been migrated to the new module-based permission system
      // but the route still checks for old 'customers' permission

      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',
        permissions: {
          customer_config: '*'  // NEW permission format
          // Note: No 'customers' key - that's the old format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      const mockCustomer = {
        id: 'cust-123',
        name: 'Test Customer',
        services: [],
        masterAccount: null,
        billingAccount: null,
        subaccounts: [],
        billedAccounts: [],
        packages: []
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      // EXPECTED: 200 (should work with new permission format)
      // ACTUAL: 403 (fails because route checks for old 'customers' permission)
      expect(response.status).toBe(200); // This will FAIL before the fix
    });

    it('FAILING TEST: should allow access with NEW global_config permission format', async () => {
      // THIS TEST ALSO PROVES THE BUG
      // global_config should grant customer management access

      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',  // Required for canManageCustomers to work
        permissions: {
          global_config: '*'  // NEW permission format that includes customer management
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      const mockCustomer = {
        id: 'cust-123',
        name: 'Test Customer',
        services: [],
        masterAccount: null,
        billingAccount: null,
        subaccounts: [],
        billedAccounts: [],
        packages: []
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      // EXPECTED: 200 (should work with global_config permission)
      // ACTUAL: 403 (fails because route doesn't recognize global_config)
      expect(response.status).toBe(200); // This will FAIL before the fix
    });

    it('shows that OLD permission format still works (for backwards compatibility)', async () => {
      // This test shows the current implementation only works with old format

      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        permissions: {
          customers: ['*']  // OLD permission format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      const mockCustomer = {
        id: 'cust-123',
        name: 'Test Customer',
        services: [],
        masterAccount: null,
        billingAccount: null,
        subaccounts: [],
        billedAccounts: [],
        packages: []
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(200); // This PASSES with current broken code
    });
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks any customer permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'user@test.com',
          permissions: {
            fulfillment: '*'  // Has other permissions but not customer-related
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should deny access for vendor users even with customer_config permission', async () => {
      // Vendor users should never be able to manage customers
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'vendor@test.com',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {
            customer_config: '*'  // Should be ignored for vendor users
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(403);
    });

    it('should deny access for customer users even with customer_config permission', async () => {
      // Customer users should never be able to manage other customers
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'customer@test.com',
          userType: 'customer',
          customerId: 'customer-456',
          permissions: {
            customer_config: '*'  // Should be ignored for customer users
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(403);
    });
  });

  describe('customer retrieval', () => {
    beforeEach(() => {
      // Default to authorized user for these tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'admin@test.com',
          userType: 'internal',
          permissions: {
            customer_config: '*'  // Using new format with proper userType
          }
        }
      });
    });

    it('should return customer with all related data', async () => {
      const mockCustomer = {
        id: 'cust-123',
        name: 'Test Customer',
        address: '123 Main St',
        contactName: 'John Doe',
        contactEmail: 'john@test.com',
        contactPhone: '555-1234',
        masterAccount: {
          id: 'master-123',
          name: 'Master Account'
        },
        billingAccount: {
          id: 'billing-123',
          name: 'Billing Account'
        },
        services: [
          {
            service: {
              id: 'service-1',
              name: 'Background Check',
              category: 'screening',
              description: 'Standard background check',
              functionalityType: 'basic'
            }
          }
        ],
        subaccounts: [
          { id: 'sub-1', name: 'Subaccount 1', disabled: false }
        ],
        billedAccounts: [
          { id: 'billed-1', name: 'Billed Account 1', disabled: false }
        ],
        packages: [
          { id: 'pkg-1', name: 'Package 1', description: 'Test package' }
        ]
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.id).toBe('cust-123');
      expect(data.name).toBe('Test Customer');
      expect(data.masterAccount).toEqual({ id: 'master-123', name: 'Master Account' });
      expect(data.billingAccount).toEqual({ id: 'billing-123', name: 'Billing Account' });
      expect(data.serviceIds).toEqual(['service-1']);
      expect(data.services).toHaveLength(1);
      expect(data.services[0]).toEqual({
        id: 'service-1',
        name: 'Background Check',
        category: 'screening',
        description: 'Standard background check',
        functionalityType: 'basic'
      });
      expect(data.subaccounts).toHaveLength(1);
      expect(data.billedAccounts).toHaveLength(1);
      expect(data.packages).toHaveLength(1);
    });

    it('should return 404 when customer not found', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Customer with ID nonexistent not found');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.customer.findUnique).mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new Request('http://localhost:3000/api/customers/cust-123');
      const response = await GET(request, { params: { id: 'cust-123' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('An error occurred while processing your request');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('PUT /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BUG: Permission system mismatch', () => {
    it('FAILING TEST: should allow updates with NEW customer_config permission', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',  // Required for canManageCustomers to work
        permissions: {
          customer_config: '*'  // NEW permission format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Old Name'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });

      // EXPECTED: Should proceed with update (status 200 or validation error)
      // ACTUAL: 403 (fails because route checks for old 'customers' permission)
      expect(response.status).not.toBe(403); // This will FAIL before the fix
    });

    it('FAILING TEST: should allow updates with NEW global_config permission', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',
        permissions: {
          global_config: '*'  // NEW permission format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Old Name'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });

      expect(response.status).not.toBe(403); // This will FAIL before the fix
    });
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks edit permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'user@test.com',
          permissions: {
            fulfillment: '*'
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(403);
    });

    it('should deny updates from vendor users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'vendor@test.com',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {
            customer_config: '*'  // Should be ignored for vendor users
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      // Default to authorized user for validation tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'admin@test.com',
          userType: 'internal',
          permissions: {
            customer_config: '*'  // Using new format with proper userType
          }
        }
      });
    });

    it('should return 404 when customer not found', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'nonexistent' } });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Customer with ID nonexistent not found');
    });

    it('should return 400 when customer name is empty', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Old Name'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: ''  // Empty name should fail validation
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 when email is invalid', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          contactEmail: 'not-an-email'  // Invalid email format
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 when customer tries to be its own master account', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          masterAccountId: 'cust-123'  // Self-reference
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('A customer cannot be its own master account');
    });

    it('should return 400 when customer tries to be its own billing account', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer'
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          billingAccountId: 'cust-123'  // Self-reference
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('A customer cannot be its own billing account');
    });

    it('should return 400 when master account does not exist', async () => {
      vi.mocked(prisma.customer.findUnique)
        .mockResolvedValueOnce({ id: 'cust-123', name: 'Test Customer' })  // Target customer exists
        .mockResolvedValueOnce(null);  // Master account does not exist

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          masterAccountId: 'nonexistent-master'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Master account not found');
    });

    it('should return 400 when billing account does not exist', async () => {
      vi.mocked(prisma.customer.findUnique)
        .mockResolvedValueOnce({ id: 'cust-123', name: 'Test Customer' })  // Target customer exists
        .mockResolvedValueOnce(null);  // Billing account does not exist

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          billingAccountId: 'nonexistent-billing'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Billing account not found');
    });
  });

  describe('successful updates', () => {
    beforeEach(() => {
      // Default to authorized user for update tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'admin@test.com',
          userType: 'internal',
          permissions: {
            customer_config: '*'  // Using new format with proper userType
          }
        }
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Old Name'
      });
    });

    it('should successfully update customer basic info', async () => {
      const updatedCustomer = {
        id: 'cust-123',
        name: 'Updated Customer',
        address: '456 New St',
        contactName: 'Jane Doe',
        contactEmail: 'jane@test.com',
        contactPhone: '555-5678',
        services: [],
        masterAccount: null,
        billingAccount: null,
        subaccounts: [],
        billedAccounts: []
      };

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback({
          customer: {
            update: vi.fn().mockResolvedValueOnce(updatedCustomer)
          },
          customerService: {
            deleteMany: vi.fn(),
            create: vi.fn()
          }
        });
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(updatedCustomer);

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer',
          address: '456 New St',
          contactName: 'Jane Doe',
          contactEmail: 'jane@test.com',
          contactPhone: '555-5678'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('Updated Customer');
      expect(data.address).toBe('456 New St');
      expect(data.contactName).toBe('Jane Doe');
    });

    it('should handle transaction errors gracefully', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Transaction failed'));

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Customer'
        })
      });

      const response = await PUT(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Transaction failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BUG: Permission system mismatch', () => {
    it('FAILING TEST: should allow deletion with NEW customer_config permission', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',  // Required for canManageCustomers to work
        permissions: {
          customer_config: '*'  // NEW permission format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer',
        _count: {
          subaccounts: 0,
          billedAccounts: 0
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });

      // EXPECTED: Should proceed with deletion
      // ACTUAL: 403 (fails because route checks for old 'customers' permission)
      expect(response.status).not.toBe(403); // This will FAIL before the fix
    });

    it('FAILING TEST: should allow deletion with NEW global_config permission', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@test.com',
        userType: 'internal',
        permissions: {
          global_config: '*'  // NEW permission format
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer',
        _count: {
          subaccounts: 0,
          billedAccounts: 0
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });

      expect(response.status).not.toBe(403); // This will FAIL before the fix
    });
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks delete permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'user@test.com',
          permissions: {
            fulfillment: '*'
          }
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(403);
    });
  });

  describe('deletion logic', () => {
    beforeEach(() => {
      // Default to authorized user for deletion tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          email: 'admin@test.com',
          userType: 'internal',
          permissions: {
            customer_config: '*'  // Using new format with proper userType
          }
        }
      });
    });

    it('should return 404 when customer not found', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/customers/nonexistent', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'nonexistent' } });
      expect(response.status).toBe(404);
    });

    it('should return 400 when customer has subaccounts', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer',
        _count: {
          subaccounts: 3,
          billedAccounts: 0
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Cannot delete customer with 3 subaccounts');
    });

    it('should return 400 when customer has billed accounts', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer',
        _count: {
          subaccounts: 0,
          billedAccounts: 2
        }
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Cannot delete customer with 2 billed accounts');
    });

    it('should successfully soft delete customer', async () => {
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
        id: 'cust-123',
        name: 'Test Customer',
        _count: {
          subaccounts: 0,
          billedAccounts: 0
        }
      });

      vi.mocked(prisma.customer.update).mockResolvedValueOnce({
        id: 'cust-123',
        disabled: true
      });

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.message).toBe('Customer deleted successfully');

      // Verify soft delete was called
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-123' },
        data: { disabled: true }
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.customer.findUnique).mockRejectedValueOnce(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/customers/cust-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'cust-123' } });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('An error occurred while processing your request');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});