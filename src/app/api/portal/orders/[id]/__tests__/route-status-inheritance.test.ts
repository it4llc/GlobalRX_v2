// /GlobalRX_v2/src/app/api/portal/orders/[id]/__tests__/route-status-inheritance.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '../route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    orderData: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    servicesFulfillment: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/services/field-resolver.service', () => ({
  FieldResolverService: {
    resolveFieldValues: vi.fn((values) => Promise.resolve(values)),
  },
}));

vi.mock('@/lib/services/order-validation.service', () => ({
  OrderValidationService: {
    validateOrderRequirements: vi.fn().mockResolvedValue({
      isValid: false,
      missingRequirements: ['Some missing field'],
    }),
  },
}));

describe('PUT /api/portal/orders/[id] - Order Item Status Inheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REGRESSION TEST: proves bug fix for order items showing pending status
  it('REGRESSION TEST: order items added via PUT should inherit draft status from draft order, not hardcoded pending', async () => {
    // This test MUST FAIL before the fix is applied (expects 'draft' but gets 'pending')
    // and PASS after the fix is applied
    // Never delete this test - it prevents the bug from coming back

    const orderId = 'order-put-draft';
    const customerId = 'customer-put-1';
    const userId = 'user-put-1';

    // Mock session
    (getServerSession as any).mockResolvedValue({
      user: {
        id: userId,
        email: 'test@example.com',
        customerId: customerId,
        userType: 'customer', // Required for authorization check
      },
    });

    // Mock existing draft order
    const mockOrder = {
      id: orderId,
      orderNumber: 'ORD-PUT-001',
      customerId: customerId,
      statusCode: 'draft', // Order is in draft status
      subject: { firstName: 'John', lastName: 'Doe' },
      notes: 'Original notes',
    };

    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

    // Prepare request body with new service items
    const requestBody = {
      serviceItems: [
        {
          serviceId: 'service-put-1',
          serviceName: 'Service PUT 1',
          locationId: 'location-put-1',
          locationName: 'Location PUT 1',
          itemId: 'item-put-1',
        },
        {
          serviceId: 'service-put-2',
          serviceName: 'Service PUT 2',
          locationId: 'location-put-2',
          locationName: 'Location PUT 2',
          itemId: 'item-put-2',
        },
      ],
      subject: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
      },
      subjectFieldValues: {
        'field-1': 'value1',
        'field-2': 'value2',
      },
      searchFieldValues: {
        'item-put-1': {
          'search-field-1': 'search-value-1',
        },
        'item-put-2': {
          'search-field-2': 'search-value-2',
        },
      },
      notes: 'Updated notes',
      status: 'draft',
    };

    // Mock transaction
    const mockTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...mockOrder,
          items: [], // Existing order has no items yet
        }),
        update: vi.fn().mockResolvedValue({
          ...mockOrder,
          subject: requestBody.subject,
          notes: requestBody.notes,
          customer: { id: customerId, name: 'Test Customer' },
          user: { id: userId, email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        }),
      },
      orderItem: {
        deleteMany: vi.fn(),
        create: vi.fn()
          .mockResolvedValueOnce({
            id: 'new-item-1',
            orderId: orderId,
            serviceId: 'service-put-1',
            locationId: 'location-put-1',
            status: 'draft', // We expect draft status
          })
          .mockResolvedValueOnce({
            id: 'new-item-2',
            orderId: orderId,
            serviceId: 'service-put-2',
            locationId: 'location-put-2',
            status: 'draft', // We expect draft status
          }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'new-item-1', // Return the first created item for field associations
        }),
      },
      orderData: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      servicesFulfillment: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/portal/orders/' + orderId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const params = { params: Promise.resolve({ id: orderId }) };

    // Execute the PUT handler
    const response = await PUT(request, params);
    const result = await response.json();

    // Check if the response is successful
    if (response.status !== 200) {
      console.log('Response not OK:', response.status, result);
    }

    // CRITICAL ASSERTION: Order items for draft orders MUST have status='draft'
    // This assertion will FAIL before the fix (because code hardcodes 'pending' on line 204)
    // and will PASS after the fix (when code uses order.statusCode)
    expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(1, {
      data: {
        orderId: orderId,
        serviceId: 'service-put-1',
        locationId: 'location-put-1',
        status: 'draft', // NOT 'pending'
      },
    });

    expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(2, {
      data: {
        orderId: orderId,
        serviceId: 'service-put-2',
        locationId: 'location-put-2',
        status: 'draft', // NOT 'pending'
      },
    });

    expect(response.status).toBe(200);
  });

  it('should add order items with status="draft" when updating a draft order', async () => {
    const orderId = 'order-update-draft';
    const customerId = 'customer-update-1';
    const userId = 'user-update-1';

    // Mock session
    (getServerSession as any).mockResolvedValue({
      user: {
        id: userId,
        email: 'update@example.com',
        customerId: customerId,
        userType: 'customer', // Required for authorization check
      },
    });

    // Mock existing draft order
    const mockOrder = {
      id: orderId,
      orderNumber: 'ORD-UPDATE-001',
      customerId: customerId,
      statusCode: 'draft',
      subject: { firstName: 'Jane', lastName: 'Smith' },
      notes: 'Draft order to update',
    };

    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

    // Prepare request body
    const requestBody = {
      serviceItems: [
        {
          serviceId: 'service-update-1',
          serviceName: 'Updated Service',
          locationId: 'location-update-1',
          locationName: 'Updated Location',
          itemId: 'item-update-1',
        },
      ],
      subject: {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1985-05-15',
      },
      notes: 'Updated draft order',
      status: 'draft',
    };

    // Mock transaction
    const mockTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...mockOrder,
          items: [], // Existing order has no items yet
        }),
        update: vi.fn().mockResolvedValue({
          ...mockOrder,
          subject: requestBody.subject,
          notes: requestBody.notes,
          customer: { id: customerId, name: 'Test Customer' },
          user: { id: userId, email: 'update@example.com', firstName: 'Update', lastName: 'User' },
        }),
      },
      orderItem: {
        deleteMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'first-item' }),
        create: vi.fn().mockResolvedValue({
          id: 'updated-item-1',
          orderId: orderId,
          serviceId: 'service-update-1',
          locationId: 'location-update-1',
          status: 'draft',
        }),
      },
      orderData: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      servicesFulfillment: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/portal/orders/' + orderId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const params = { params: Promise.resolve({ id: orderId }) };

    // Execute the PUT handler
    const response = await PUT(request, params);
    const result = await response.json();

    // Verify order item was created with draft status
    expect(mockTx.orderItem.create).toHaveBeenCalledWith({
      data: {
        orderId: orderId,
        serviceId: 'service-update-1',
        locationId: 'location-update-1',
        status: 'draft',
      },
    });

    // Verify ServicesFulfillment was also created
    expect(mockTx.servicesFulfillment.create).toHaveBeenCalledWith({
      data: {
        orderId: orderId,
        orderItemId: 'updated-item-1',
        serviceId: 'service-update-1',
        locationId: 'location-update-1',
        assignedVendorId: null,
      },
    });

    expect(response.status).toBe(200);
  });

  it.skip('should add order items with status="submitted" when updating a submitted order', async () => {
    // SKIPPED: This test is invalid - submitted orders cannot be edited per business rules
    const orderId = 'order-update-submitted';
    const customerId = 'customer-update-2';
    const userId = 'user-update-2';

    // Mock session
    (getServerSession as any).mockResolvedValue({
      user: {
        id: userId,
        email: 'submit@example.com',
        customerId: customerId,
        userType: 'customer', // Required for authorization check
      },
    });

    // Mock existing submitted order (though normally you can't edit submitted orders)
    // This tests that IF we allow editing submitted orders, items should inherit the status
    const mockOrder = {
      id: orderId,
      orderNumber: 'ORD-SUBMIT-001',
      customerId: customerId,
      statusCode: 'submitted',
      subject: { firstName: 'Bob', lastName: 'Johnson' },
      notes: 'Submitted order',
    };

    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

    // Prepare request body
    const requestBody = {
      serviceItems: [
        {
          serviceId: 'service-submit-1',
          serviceName: 'Submitted Service',
          locationId: 'location-submit-1',
          locationName: 'Submitted Location',
          itemId: 'item-submit-1',
        },
      ],
      subject: {
        firstName: 'Bob',
        lastName: 'Johnson',
        dateOfBirth: '1975-08-20',
      },
      notes: 'Updated submitted order',
      status: 'submitted',
    };

    // Mock validation to pass for submitted status
    const { OrderValidationService } = await import('@/lib/services/order-validation.service');
    (OrderValidationService.validateOrderRequirements as any).mockResolvedValueOnce({
      isValid: true,
      missingRequirements: [],
    });

    // Mock transaction
    const mockTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...mockOrder,
          items: [], // Existing order has no items yet
        }),
        update: vi.fn().mockResolvedValue({
          ...mockOrder,
          subject: requestBody.subject,
          notes: requestBody.notes,
          customer: { id: customerId, name: 'Test Customer' },
          user: { id: userId, email: 'submit@example.com', firstName: 'Submit', lastName: 'User' },
        }),
      },
      orderItem: {
        deleteMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'first-item' }),
        create: vi.fn().mockResolvedValue({
          id: 'submitted-item-1',
          orderId: orderId,
          serviceId: 'service-submit-1',
          locationId: 'location-submit-1',
          status: 'submitted',
        }),
      },
      orderData: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      servicesFulfillment: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/portal/orders/' + orderId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const params = { params: Promise.resolve({ id: orderId }) };

    // Execute the PUT handler
    const response = await PUT(request, params);
    const result = await response.json();

    // Verify order item was created with submitted status (not pending)
    expect(mockTx.orderItem.create).toHaveBeenCalledWith({
      data: {
        orderId: orderId,
        serviceId: 'service-submit-1',
        locationId: 'location-submit-1',
        status: 'submitted', // NOT 'pending'
      },
    });

    expect(response.status).toBe(200);
  });

  it('should handle multiple service items all inheriting the correct status', async () => {
    const orderId = 'order-multiple-items';
    const customerId = 'customer-multiple';
    const userId = 'user-multiple';

    // Mock session
    (getServerSession as any).mockResolvedValue({
      user: {
        id: userId,
        email: 'multiple@example.com',
        customerId: customerId,
        userType: 'customer', // Required for authorization check
      },
    });

    // Mock existing draft order
    const mockOrder = {
      id: orderId,
      orderNumber: 'ORD-MULTI-001',
      customerId: customerId,
      statusCode: 'draft',
      subject: { firstName: 'Multi', lastName: 'User' },
      notes: 'Order with multiple items',
    };

    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

    // Prepare request body with many items
    const requestBody = {
      serviceItems: [
        { serviceId: 'svc-1', serviceName: 'Service 1', locationId: 'loc-1', locationName: 'Location 1', itemId: 'itm-1' },
        { serviceId: 'svc-2', serviceName: 'Service 2', locationId: 'loc-2', locationName: 'Location 2', itemId: 'itm-2' },
        { serviceId: 'svc-3', serviceName: 'Service 3', locationId: 'loc-3', locationName: 'Location 3', itemId: 'itm-3' },
        { serviceId: 'svc-4', serviceName: 'Service 4', locationId: 'loc-4', locationName: 'Location 4', itemId: 'itm-4' },
      ],
      subject: {
        firstName: 'Multi',
        lastName: 'User',
        dateOfBirth: '1995-12-25',
      },
      notes: 'Testing multiple items',
      status: 'draft',
    };

    // Mock transaction
    const mockTx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...mockOrder,
          items: [], // Existing order has no items yet
        }),
        update: vi.fn().mockResolvedValue({
          ...mockOrder,
          subject: requestBody.subject,
          notes: requestBody.notes,
          customer: { id: customerId, name: 'Test Customer' },
          user: { id: userId, email: 'multiple@example.com', firstName: 'Multi', lastName: 'User' },
        }),
      },
      orderItem: {
        deleteMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: 'first-item' }),
        create: vi.fn()
          .mockResolvedValueOnce({ id: 'multi-item-1', orderId, serviceId: 'svc-1', locationId: 'loc-1', status: 'draft' })
          .mockResolvedValueOnce({ id: 'multi-item-2', orderId, serviceId: 'svc-2', locationId: 'loc-2', status: 'draft' })
          .mockResolvedValueOnce({ id: 'multi-item-3', orderId, serviceId: 'svc-3', locationId: 'loc-3', status: 'draft' })
          .mockResolvedValueOnce({ id: 'multi-item-4', orderId, serviceId: 'svc-4', locationId: 'loc-4', status: 'draft' }),
      },
      orderData: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      servicesFulfillment: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/portal/orders/' + orderId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const params = { params: Promise.resolve({ id: orderId }) };

    // Execute the PUT handler
    const response = await PUT(request, params);

    // Verify ALL order items were created with draft status
    expect(mockTx.orderItem.create).toHaveBeenCalledTimes(4);

    for (let i = 1; i <= 4; i++) {
      expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(i, {
        data: {
          orderId: orderId,
          serviceId: `svc-${i}`,
          locationId: `loc-${i}`,
          status: 'draft', // ALL items should have draft status
        },
      });
    }

    expect(response.status).toBe(200);
  });
});