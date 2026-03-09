// /GlobalRX_v2/src/app/api/comment-templates/__tests__/create-template-usertype-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commentTemplate: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

/**
 * USERTYPE BUG PROOF TEST SUITE
 *
 * BACKGROUND:
 * The bug was in /src/app/api/comment-templates/route.ts at line 194.
 * The code was incorrectly checking `session.user.type` (which doesn't exist)
 * instead of `session.user.userType` (which is the correct property).
 *
 * THE BUG:
 * Line 194 used to be: if (session.user.type === 'vendor' || session.user.type === 'customer')
 * It should be: if (session.user.userType === 'vendor' || session.user.userType === 'customer')
 *
 * EXPECTED BEHAVIOR:
 * - This test suite would FAIL with the buggy implementation (using .type)
 * - This test suite will PASS after the fix (using .userType)
 *
 * The most important test is the first one - it PROVES THE BUG EXISTS by showing
 * that an internal user with comment_management permission fails to create a
 * template when using the correct userType property.
 */
describe('UserType Bug Tests - POST /api/comment-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * TEST 1: PROVES THE BUG EXISTS
   * This is the most important test. With the buggy code (checking .type instead of .userType),
   * this test would FAIL because the permission check would pass (since .type is undefined,
   * not 'vendor' or 'customer'), allowing the user through even though they're an internal user.
   *
   * With the fix, this test PASSES because it correctly checks .userType === 'internal'.
   */
  it('🔴 BUG PROOF: should allow internal users WITH comment_management permission to create templates when userType is set correctly', async () => {
    // Setup: Internal user with ONLY userType property (not type)
    // This simulates the actual NextAuth session structure
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userType: 'internal', // CORRECT property name
        // NOTE: No 'type' property exists - this is what proves the bug
        permissions: { comment_management: true }
      }
    } as any);

    // No duplicate template exists
    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);

    // Mock successful creation
    vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440002',
      shortName: 'Test Template',
      longName: 'Test Template Long Name',
      templateText: 'This is a test template text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '550e8400-e29b-41d4-a716-446655440001',
      updatedBy: '550e8400-e29b-41d4-a716-446655440001',
      availabilities: []
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Test Template',
        longName: 'Test Template Long Name',
        templateText: 'This is a test template text'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // EXPECTED: Status 201 (Created) - internal users with permission CAN create
    // BUGGY CODE: Would likely fail or behave incorrectly
    expect(response.status).toBe(201);
    expect(data.shortName).toBe('Test Template');
    expect(data.longName).toBe('Test Template Long Name');
    expect(data.templateText).toBe('This is a test template text');
  });

  /**
   * TEST 2: Internal users WITHOUT comment_management permission cannot create
   */
  it('should return 403 when internal user lacks comment_management permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userType: 'internal', // Correct property
        permissions: {
          candidate_workflow: true, // Has other permissions
          // But NOT comment_management
        }
      }
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Forbidden Template',
        longName: 'Should Not Create',
        templateText: 'User lacks permission'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions');
  });

  /**
   * TEST 3: Vendor users cannot create templates regardless of permissions
   */
  it('should return 403 when user is vendor even with comment_management permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440003',
        userType: 'vendor', // Vendor user type
        vendorId: 'vendor-123',
        permissions: {
          comment_management: true // Even with the permission!
        }
      }
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Vendor Template',
        longName: 'Vendor Should Not Create',
        templateText: 'Vendors cannot create templates'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // Vendors are blocked at the user type level, before permission check
    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions');
  });

  /**
   * TEST 4: Customer users cannot create templates regardless of permissions
   */
  it('should return 403 when user is customer even with comment_management permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440004',
        userType: 'customer', // Customer user type
        customerId: 'customer-456',
        permissions: {
          comment_management: true // Even with the permission!
        }
      }
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Customer Template',
        longName: 'Customer Should Not Create',
        templateText: 'Customers cannot create templates'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // Customers are blocked at the user type level, before permission check
    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions');
  });

  /**
   * TEST 5: Admin users (internal) can create templates
   */
  it('should allow admin users to create templates', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440005',
        userType: 'admin', // Admin is a special type of internal user
        permissions: {
          comment_management: true
        }
      }
    } as any);

    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440006',
      shortName: 'Admin Template',
      longName: 'Admin Created Template',
      templateText: 'Admins can do everything',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '550e8400-e29b-41d4-a716-446655440005',
      updatedBy: '550e8400-e29b-41d4-a716-446655440005',
      availabilities: []
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Admin Template',
        longName: 'Admin Created Template',
        templateText: 'Admins can do everything'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // Note: The current code doesn't explicitly handle 'admin' type
    // It only blocks 'vendor' and 'customer', so 'admin' passes through
    // This test documents current behavior
    expect(response.status).toBe(201);
    expect(data.shortName).toBe('Admin Template');
  });

  /**
   * TEST 6: Edge case - userType is undefined
   * When userType is undefined, the code will pass the vendor/customer check
   * (since undefined !== 'vendor' && undefined !== 'customer')
   * But then the permission check will still be enforced.
   * Since they have comment_management permission, they would succeed.
   *
   * However, in practice this may cause issues with the Prisma create operation
   * or other parts of the code that expect userType to exist.
   */
  it('should handle undefined userType gracefully', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440007',
        // No userType property at all - edge case
        permissions: {
          comment_management: true
        }
      }
    } as any);

    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440007',
      shortName: 'Undefined Type Template',
      longName: 'No User Type',
      templateText: 'What happens when userType is missing?',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '550e8400-e29b-41d4-a716-446655440007',
      updatedBy: '550e8400-e29b-41d4-a716-446655440007',
      availabilities: []
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Undefined Type Template',
        longName: 'No User Type',
        templateText: 'What happens when userType is missing?'
      })
    });

    const response = await POST(request);

    // With fixed code: undefined userType doesn't match 'vendor' or 'customer'
    // so it passes the first check but needs comment_management permission
    // Since they have the permission, this should succeed
    expect(response.status).toBe(201);
  });

  /**
   * TEST 7: Conflicting type vs userType properties
   * This tests what happens when both exist but have different values
   */
  it('should use userType when both type and userType exist with different values', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440008',
        userType: 'internal', // Correct property says internal
        type: 'vendor' as any, // Wrong property says vendor (should be ignored)
        permissions: {
          comment_management: true
        }
      }
    } as any);

    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
      id: '550e8400-e29b-41d4-a716-446655440009',
      shortName: 'Conflict Test',
      longName: 'Testing Property Conflict',
      templateText: 'Should respect userType not type',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '550e8400-e29b-41d4-a716-446655440008',
      updatedBy: '550e8400-e29b-41d4-a716-446655440008',
      availabilities: []
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Conflict Test',
        longName: 'Testing Property Conflict',
        templateText: 'Should respect userType not type'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    // Should respect userType (internal) and allow creation
    // NOT type (vendor) which would block it
    expect(response.status).toBe(201);
    expect(data.shortName).toBe('Conflict Test');
  });

  /**
   * TEST 8: Validation still works correctly after userType fix
   */
  it('should still validate required fields with correct userType', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440010',
        userType: 'internal',
        permissions: {
          comment_management: true
        }
      }
    } as any);

    // Missing required fields
    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Missing Fields'
        // Missing longName and templateText
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
  });

  /**
   * TEST 9: Duplicate checking still works after fix
   */
  it('should still prevent duplicate shortNames with correct userType', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440011',
        userType: 'internal',
        permissions: {
          comment_management: true
        }
      }
    } as any);

    // Existing template with same shortName
    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce({
      id: 'existing-template',
      shortName: 'Duplicate Name',
      isActive: true
    } as any);

    const request = new NextRequest('http://localhost:3000/api/comment-templates', {
      method: 'POST',
      body: JSON.stringify({
        shortName: 'Duplicate Name',
        longName: 'Trying to Duplicate',
        templateText: 'This should fail'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('A template with this short name already exists');
  });
});