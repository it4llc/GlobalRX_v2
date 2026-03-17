// Tests for the fixed order service comments API endpoint
// Verifies that all required fields for styling are included in response
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

const mockValidateOrderAccess = vi.fn();
const mockGetOrderServiceComments = vi.fn();

vi.mock('@/services/service-comment-service', () => ({
  ServiceCommentService: vi.fn().mockImplementation(function() {
    return {
      validateOrderAccess: mockValidateOrderAccess,
      getOrderServiceComments: mockGetOrderServiceComments
    };
  })
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

describe('GET /api/orders/[id]/services/comments - Fixed Response', () => {
  const mockOrderId = '544abc19-d99c-4797-b930-ea0efd884e00';
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include all styling fields in comment response', async () => {
    // Mock session
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: mockUserId,
        userType: 'internal',
        email: 'admin@example.com'
      }
    } as any);

    // Mock service response with all fields
    mockValidateOrderAccess.mockResolvedValue(true);
    mockGetOrderServiceComments.mockResolvedValue({
      '123e4567-e89b-12d3-a456-426614174001': {
        serviceName: 'Criminal History',
        serviceStatus: 'processing',
        comments: [
          {
            id: 'comment-1',
            serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderItemId: 'order-item-1',
            templateId: 'template-1',
            finalText: 'Processing the background check',
            isInternalOnly: true,
            isStatusChange: false,
            statusChangedFrom: null,
            statusChangedTo: null,
            createdBy: 'user-1',
            createdAt: new Date('2024-03-01T10:00:00Z'),
            updatedBy: null,
            updatedAt: null,
            template: {
              id: 'template-1',
              shortName: 'PROC',
              longName: 'Processing'
            },
            createdByUser: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Admin',
              email: 'john@example.com'
            },
            updatedByUser: null
          },
          {
            id: 'comment-2',
            serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderItemId: 'order-item-1',
            templateId: 'template-2',
            finalText: 'Status changed to Completed',
            isInternalOnly: false,
            isStatusChange: true,
            statusChangedFrom: 'Processing',
            statusChangedTo: 'Completed',
            createdBy: 'user-2',
            createdAt: new Date('2024-03-02T10:00:00Z'),
            updatedBy: null,
            updatedAt: null,
            template: {
              id: 'template-2',
              shortName: 'STATUS',
              longName: 'Status Change'
            },
            createdByUser: {
              id: 'user-2',
              firstName: 'System',
              lastName: '',
              email: 'system@example.com'
            },
            updatedByUser: null
          }
        ],
        total: 2
      }
    });

    // Create request
    const request = new NextRequest(`http://localhost:3000/api/orders/${mockOrderId}/services/comments`);

    // Call API
    const response = await GET(request, { params: { id: mockOrderId } });
    const data = await response.json();

    // Verify response structure
    expect(response.status).toBe(200);
    expect(data.commentsByService).toBeDefined();
    expect(data.commentsByService['123e4567-e89b-12d3-a456-426614174001']).toBeDefined();

    const comments = data.commentsByService['123e4567-e89b-12d3-a456-426614174001'].comments;
    expect(comments).toHaveLength(2);

    // Verify regular comment has all fields
    const regularComment = comments[0];
    expect(regularComment).toMatchObject({
      id: 'comment-1',
      finalText: 'Processing the background check',
      isInternalOnly: true,
      isStatusChange: false,
      statusChangedFrom: null,
      statusChangedTo: null,
      template: {
        shortName: 'PROC',
        longName: 'Processing',
        name: 'Processing' // Added field for display
      },
      createdByUser: {
        name: 'John Admin',
        email: 'john@example.com'
      },
      createdByName: 'John Admin' // Added field for display
    });

    // Verify status change comment has all fields
    const statusComment = comments[1];
    expect(statusComment).toMatchObject({
      id: 'comment-2',
      finalText: 'Status changed to Completed',
      isInternalOnly: false,
      isStatusChange: true,
      statusChangedFrom: 'Processing',
      statusChangedTo: 'Completed',
      template: {
        shortName: 'STATUS',
        longName: 'Status Change',
        name: 'Status Change'
      },
      createdByUser: {
        name: 'System',
        email: 'system@example.com'
      },
      createdByName: 'System'
    });
  });

  it('should handle updated comments with updatedByName field', async () => {
    // Mock session
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: mockUserId,
        userType: 'internal',
        email: 'admin@example.com'
      }
    } as any);

    mockValidateOrderAccess.mockResolvedValue(true);
    mockGetOrderServiceComments.mockResolvedValue({
      'f47ac10b-58cc-4372-a567-0e02b2c3d479': {
        serviceName: 'Test Service',
        serviceStatus: 'processing',
        comments: [
          {
            id: 'comment-1',
            serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderItemId: 'order-item-1',
            templateId: 'template-1',
            finalText: 'Updated comment text',
            isInternalOnly: false,
            isStatusChange: false,
            statusChangedFrom: null,
            statusChangedTo: null,
            createdBy: 'user-1',
            createdAt: new Date('2024-03-01T10:00:00Z'),
            updatedBy: 'user-2',
            updatedAt: new Date('2024-03-02T10:00:00Z'),
            template: {
              id: 'template-1',
              shortName: 'NOTE',
              longName: 'Note'
            },
            createdByUser: {
              id: 'user-1',
              firstName: 'Original',
              lastName: 'Author',
              email: 'original@example.com'
            },
            updatedByUser: {
              id: 'user-2',
              firstName: 'Editor',
              lastName: 'User',
              email: 'editor@example.com'
            }
          }
        ],
        total: 1
      }
    });

    const request = new NextRequest(`http://localhost:3000/api/orders/${mockOrderId}/services/comments`);
    const response = await GET(request, { params: { id: mockOrderId } });
    const data = await response.json();

    const comment = data.commentsByService['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments[0];

    // Verify both created and updated user names are included
    expect(comment.createdByName).toBe('Original Author');
    expect(comment.updatedByName).toBe('Editor User');
    expect(comment.updatedByUser).toMatchObject({
      name: 'Editor User',
      email: 'editor@example.com'
    });
  });

  it('should handle users with no names gracefully', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: mockUserId,
        userType: 'internal',
        email: 'admin@example.com'
      }
    } as any);

    mockValidateOrderAccess.mockResolvedValue(true);
    mockGetOrderServiceComments.mockResolvedValue({
      'f47ac10b-58cc-4372-a567-0e02b2c3d479': {
        serviceName: 'Test Service',
        serviceStatus: 'draft',
        comments: [
          {
            id: 'comment-1',
            serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderItemId: 'order-item-1',
            templateId: 'template-1',
            finalText: 'Comment from user with no name',
            isInternalOnly: false,
            isStatusChange: false,
            statusChangedFrom: null,
            statusChangedTo: null,
            createdBy: 'user-1',
            createdAt: new Date('2024-03-01T10:00:00Z'),
            updatedBy: null,
            updatedAt: null,
            template: {
              id: 'template-1',
              shortName: 'NOTE',
              longName: 'Note'
            },
            createdByUser: {
              id: 'user-1',
              firstName: '',
              lastName: '',
              email: 'noname@example.com'
            },
            updatedByUser: null
          }
        ],
        total: 1
      }
    });

    const request = new NextRequest(`http://localhost:3000/api/orders/${mockOrderId}/services/comments`);
    const response = await GET(request, { params: { id: mockOrderId } });
    const data = await response.json();

    const comment = data.commentsByService['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments[0];

    // Should fall back to email when name is empty
    expect(comment.createdByName).toBe('noname@example.com');
    expect(comment.createdByUser.name).toBe('noname@example.com');
  });
});