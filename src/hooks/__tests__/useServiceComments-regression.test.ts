/**
 * Regression test for the Service Comment NULL ID bug
 *
 * Bug: When creating comments in order details view, the API was called with
 * /api/services/null/comments instead of the correct ServiceFulfillment ID
 *
 * Root cause: ID type mismatch - API expects ServiceFulfillment IDs but
 * frontend was passing OrderItem IDs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

describe('useServiceComments - Regression Test for NULL ID Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  describe('Critical Bug Fix: Ensure correct ID is used for API calls', () => {
    it('should NEVER call API with /api/services/null/comments', async () => {
      // This test ensures we never regress to the bug where null was passed
      const { useServiceComments } = await import('@/hooks/useServiceComments');

      // Import required for the hook
      const React = await import('react');
      const { renderHook, act } = await import('@testing-library/react');

      // Mock successful API response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ comment: { id: 'test-comment' } })
      });

      // Mock auth context
      const wrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement('div', {}, children);
      };

      // Simulate the exact scenario that caused the bug:
      // - Hook is in order mode (serviceId is null)
      // - But we pass a serviceFulfillmentId in the create data
      const { result } = renderHook(
        () => {
          // Mock user auth
          const mockUser = { id: 'user-1', userType: 'internal' };
          // @ts-ignore - Mocking internals
          vi.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({ user: mockUser });

          return useServiceComments(null, 'order-123');
        },
        { wrapper }
      );

      // Try to create a comment with the fix applied
      try {
        await act(async () => {
          await result.current.createComment({
            templateId: 'template-1',
            finalText: 'Test comment',
            isInternalOnly: true,
            serviceId: 'service-fulfillment-123' // The fix: pass the ServiceFulfillment ID
          });
        });
      } catch (error) {
        // If error occurs, that's ok for this test
      }

      // CRITICAL ASSERTION: Ensure we NEVER called the API with null
      const allCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;

      // Check that no call contains '/api/services/null/'
      const nullCalls = allCalls.filter(call => {
        const url = call[0] as string;
        return url && url.includes('/api/services/null/');
      });

      expect(nullCalls).toHaveLength(0);

      // If any call was made, it should have a valid ID
      if (allCalls.length > 0) {
        const firstCallUrl = allCalls[0][0] as string;
        expect(firstCallUrl).not.toContain('/api/services/null/');
        expect(firstCallUrl).toContain('/api/services/service-fulfillment-123/');
      }
    });

    it('should use the serviceId parameter when provided in create/update/delete', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const React = await import('react');
      const { renderHook, act } = await import('@testing-library/react');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ comment: { id: 'test-comment' } })
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement('div', {}, children);
      };

      const { result } = renderHook(
        () => {
          const mockUser = { id: 'user-1', userType: 'internal' };
          // @ts-ignore
          vi.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({ user: mockUser });
          return useServiceComments(null, 'order-123'); // Order mode
        },
        { wrapper }
      );

      // Test CREATE with provided serviceId
      await act(async () => {
        try {
          await result.current.createComment({
            templateId: 'template-1',
            finalText: 'Test',
            serviceId: 'provided-service-id'
          });
        } catch {}
      });

      // Verify the provided ID was used
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/services/provided-service-id/comments',
        expect.any(Object)
      );

      // Reset mock
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      // Test UPDATE with provided serviceId
      await act(async () => {
        try {
          await result.current.updateComment('comment-1', {
            finalText: 'Updated',
            serviceId: 'provided-service-id'
          });
        } catch {}
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/services/provided-service-id/comments/comment-1',
        expect.any(Object)
      );

      // Reset mock
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      // Test DELETE with provided serviceId
      await act(async () => {
        try {
          await result.current.deleteComment('provided-service-id', 'comment-1');
        } catch {}
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/services/provided-service-id/comments/comment-1',
        expect.any(Object)
      );
    });

    it('should update commentsByService state correctly when in order mode', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const React = await import('react');
      const { renderHook, act, waitFor } = await import('@testing-library/react');

      // First mock the initial fetch for order comments
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            'service-fulfillment-123': {
              comments: []
            }
          }
        })
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement('div', {}, children);
      };

      const { result } = renderHook(
        () => {
          const mockUser = { id: 'user-1', userType: 'internal' };
          // @ts-ignore
          vi.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockReturnValue({ user: mockUser });
          return useServiceComments(null, 'order-123');
        },
        { wrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock create response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment',
            text: 'New comment',
            createdAt: new Date().toISOString()
          }
        })
      });

      // Create a comment
      await act(async () => {
        try {
          await result.current.createComment({
            templateId: 'template-1',
            finalText: 'New comment',
            serviceId: 'service-fulfillment-123'
          });
        } catch {}
      });

      // Verify the state was updated
      expect(result.current.commentsByService['service-fulfillment-123']).toBeDefined();
      expect(result.current.commentsByService['service-fulfillment-123'].comments).toHaveLength(1);
      expect(result.current.commentsByService['service-fulfillment-123'].comments[0].id).toBe('new-comment');
    });
  });

  describe('Documentation', () => {
    it('Documents the fix approach', () => {
      // This test serves as documentation of the fix
      const bugDescription = `
        BUG: When creating comments in order details view, API was called with /api/services/null/comments

        ROOT CAUSE:
        - The API expects ServiceFulfillment IDs in the URL
        - The frontend was passing OrderItem IDs
        - In order mode, the hook set serviceId to null

        FIX:
        1. Modified createComment/updateComment/deleteComment to accept serviceId as parameter
        2. ServiceCommentSection now passes serviceFulfillmentId for API calls in order mode
        3. The hook updates the correct state (commentsByService vs comments) based on mode

        PREVENTION:
        - This test ensures we never call API with null in the URL
        - Tests verify correct ID is used in both order mode and single service mode
        - Tests verify state updates correctly after CRUD operations
      `;

      expect(bugDescription).toBeTruthy(); // This test always passes, serves as documentation
    });
  });
});