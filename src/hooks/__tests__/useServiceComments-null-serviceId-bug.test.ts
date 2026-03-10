// /GlobalRX_v2/src/hooks/__tests__/useServiceComments-null-serviceId-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useServiceComments } from '../useServiceComments';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('useServiceComments - null serviceId bug fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock for useAuth - internal user with permissions
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        userType: 'internal',
        permissions: { fulfillment: true }
      },
      loading: false,
      error: null
    } as any);
  });

  describe('Bug: API calls with null serviceId in order mode', () => {
    /**
     * THIS TEST PROVES THE BUG EXISTS
     *
     * When ServiceCommentSection uses the hook in order mode (from order details page),
     * it passes null as serviceId to indicate order mode. However, the CRUD operations
     * (createComment, updateComment, deleteComment) still try to use this null serviceId
     * to construct API paths, resulting in calls to /api/services/null/comments
     */
    it('should FAIL: createComment calls API with null serviceId in order mode (CURRENT BUG)', async () => {
      const mockOrderId = 'order-123';

      // Mock successful API response for initial fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            'service-fulfillment-123': {
              serviceName: 'Background Check',
              serviceStatus: 'Processing',
              comments: [],
              total: 0
            }
          }
        })
      } as Response);

      // Render hook in order mode (serviceId is null)
      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId, 'BACKGROUND_CHECK', 'PROCESSING')
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear fetch calls from initial load
      vi.mocked(fetch).mockClear();

      // Mock response for create comment
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment',
            templateId: 'template-1',
            finalText: 'Test comment',
            isInternalOnly: true,
            createdAt: new Date().toISOString()
          }
        })
      } as Response);

      // Attempt to create a comment
      await act(async () => {
        await result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test comment',
          isInternalOnly: true
        });
      });

      // BUG: This will call /api/services/null/comments instead of /api/services/{actualServiceId}/comments
      expect(fetch).toHaveBeenCalledWith(
        '/api/services/null/comments', // ❌ BUG: null in URL!
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: 'template-1',
            finalText: 'Test comment',
            isInternalOnly: true
          })
        })
      );
    });

    it('should FAIL: updateComment calls API with null serviceId in order mode (CURRENT BUG)', async () => {
      const mockOrderId = 'order-123';
      const mockCommentId = 'comment-456';

      // Mock successful API response for initial fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            'service-fulfillment-123': {
              comments: [{
                id: mockCommentId,
                templateId: 'template-1',
                finalText: 'Original comment',
                isInternalOnly: true
              }]
            }
          }
        })
      } as Response);

      // Render hook in order mode (serviceId is null)
      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(fetch).mockClear();

      // Mock response for update
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Attempt to update the comment
      await act(async () => {
        await result.current.updateComment(mockCommentId, {
          finalText: 'Updated comment',
          isInternalOnly: false
        });
      });

      // BUG: This will call /api/services/null/comments/{commentId}
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/null/comments/${mockCommentId}`, // ❌ BUG: null in URL!
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            finalText: 'Updated comment',
            isInternalOnly: false
          })
        })
      );
    });

    it('should FAIL: deleteComment calls API with null serviceId in order mode (CURRENT BUG)', async () => {
      const mockOrderId = 'order-123';
      const mockCommentId = 'comment-789';

      // Mock successful API response for initial fetch
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            'service-fulfillment-123': {
              comments: [{
                id: mockCommentId,
                templateId: 'template-1',
                finalText: 'Comment to delete',
                isInternalOnly: true
              }]
            }
          }
        })
      } as Response);

      // Render hook in order mode
      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(fetch).mockClear();

      // Mock response for delete
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // Attempt to delete the comment
      await act(async () => {
        await result.current.deleteComment(mockCommentId);
      });

      // BUG: This will call /api/services/null/comments/{commentId}
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/null/comments/${mockCommentId}`, // ❌ BUG: null in URL!
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });
  });

  describe('Expected behavior after fix: CRUD operations accept serviceId as parameter', () => {
    /**
     * These tests show the expected behavior after the fix:
     * CRUD operations should accept serviceId as a parameter so that
     * ServiceCommentSection can pass the actual serviceId when needed
     */

    it('should PASS: createComment accepts serviceId parameter for order mode (AFTER FIX)', async () => {
      const mockOrderId = 'order-123';
      const actualServiceId = 'service-456'; // The actual OrderItem ID

      // Initial fetch for order comments
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {}
        })
      } as Response);

      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(fetch).mockClear();

      // Mock response for create
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment',
            templateId: 'template-1',
            finalText: 'Test comment'
          }
        })
      } as Response);

      // After fix: createComment should accept serviceId as first parameter
      // This allows ServiceCommentSection to pass the actual serviceId
      await act(async () => {
        // NOTE: This signature change is the proposed fix
        // Current: createComment(data)
        // Fixed: createComment(serviceId, data) or createComment(data) where data includes serviceId
        await result.current.createComment({
          serviceId: actualServiceId, // Pass serviceId in data object
          templateId: 'template-1',
          finalText: 'Test comment',
          isInternalOnly: true
        });
      });

      // After fix: Should use the provided serviceId, not null
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/${actualServiceId}/comments`, // ✅ Correct serviceId in URL
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should PASS: updateComment accepts serviceId parameter for order mode (AFTER FIX)', async () => {
      const mockOrderId = 'order-123';
      const actualServiceId = 'service-456';
      const mockCommentId = 'comment-789';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentsByService: {} })
      } as Response);

      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(fetch).mockClear();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // After fix: updateComment should accept serviceId parameter
      await act(async () => {
        // NOTE: Proposed signature change
        // Current: updateComment(commentId, data)
        // Fixed: updateComment(serviceId, commentId, data) or data includes serviceId
        await result.current.updateComment(mockCommentId, {
          serviceId: actualServiceId, // Pass serviceId in data
          finalText: 'Updated comment',
          isInternalOnly: false
        });
      });

      // Should use the provided serviceId
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/${actualServiceId}/comments/${mockCommentId}`, // ✅ Correct serviceId
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    it('should PASS: deleteComment accepts serviceId parameter for order mode (AFTER FIX)', async () => {
      const mockOrderId = 'order-123';
      const actualServiceId = 'service-456';
      const mockCommentId = 'comment-789';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commentsByService: {} })
      } as Response);

      const { result } = renderHook(() =>
        useServiceComments(null, mockOrderId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.mocked(fetch).mockClear();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);

      // After fix: deleteComment should accept serviceId parameter
      await act(async () => {
        // NOTE: Proposed signature change
        // Current: deleteComment(commentId)
        // Fixed: deleteComment(serviceId, commentId)
        await result.current.deleteComment(actualServiceId, mockCommentId);
      });

      // Should use the provided serviceId
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/${actualServiceId}/comments/${mockCommentId}`, // ✅ Correct serviceId
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Single service mode should continue working (no regression)', () => {
    it('should work correctly when serviceId is provided (single service mode)', async () => {
      const mockServiceId = 'service-123';

      // Mock fetch for initial load
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] })
      } as Response);

      const { result } = renderHook(() =>
        useServiceComments(mockServiceId) // Single service mode
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify initial fetch used correct serviceId
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/${mockServiceId}/comments`,
        expect.objectContaining({
          method: 'GET'
        })
      );

      vi.mocked(fetch).mockClear();

      // Test create in single service mode
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment',
            templateId: 'template-1',
            finalText: 'Test comment'
          }
        })
      } as Response);

      await act(async () => {
        await result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test comment'
        });
      });

      // Should still work correctly in single service mode
      expect(fetch).toHaveBeenCalledWith(
        `/api/services/${mockServiceId}/comments`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('Edge cases and validation', () => {
    it('should validate serviceId format when provided', async () => {
      const invalidServiceId = 'not-a-uuid';
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      // Test with invalid format - should still attempt the call (validation is informational)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid service ID format' })
      } as Response);

      const { result: invalidResult } = renderHook(() =>
        useServiceComments(invalidServiceId)
      );

      await waitFor(() => {
        expect(invalidResult.current.error).toBeTruthy();
      });

      // Test with valid UUID
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] })
      } as Response);

      const { result: validResult } = renderHook(() =>
        useServiceComments(validUuid)
      );

      await waitFor(() => {
        expect(validResult.current.loading).toBe(false);
        expect(validResult.current.error).toBeNull();
      });
    });

    it('should handle missing serviceId gracefully in CRUD operations', async () => {
      // If neither serviceId is provided in hook nor in operation, should throw meaningful error
      const { result } = renderHook(() =>
        useServiceComments(null, null) // No serviceId, no orderId
      );

      // Should not fetch initially when both are null
      expect(fetch).not.toHaveBeenCalled();

      // Attempting CRUD without serviceId should fail gracefully
      await expect(
        result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test'
        })
      ).rejects.toThrow(); // Should throw an error about missing serviceId
    });

    it('should handle network errors during CRUD operations', async () => {
      const mockServiceId = 'service-123';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] })
      } as Response);

      const { result } = renderHook(() =>
        useServiceComments(mockServiceId)
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate network error
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test comment'
        })
      ).rejects.toThrow('Failed to create comment');
    });
  });

  describe('Permission checks with null serviceId', () => {
    it('should still enforce permission checks regardless of serviceId', async () => {
      // Customer cannot create comments
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'customer-123',
          userType: 'customer'
        }
      } as any);

      const { result } = renderHook(() =>
        useServiceComments(null, 'order-123')
      );

      await expect(
        result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test'
        })
      ).rejects.toThrow('Customers cannot create comments');

      // Vendor cannot edit comments
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-123',
          userType: 'vendor'
        }
      } as any);

      const { result: vendorResult } = renderHook(() =>
        useServiceComments(null, 'order-123')
      );

      await expect(
        vendorResult.current.updateComment('comment-123', {
          finalText: 'Updated'
        })
      ).rejects.toThrow('Vendors cannot edit comments');
    });
  });
});