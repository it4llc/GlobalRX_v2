import { renderHook, act, waitFor } from '@testing-library/react';
import { useServiceComments } from '@/hooks/useServiceComments';
import { AuthContext } from '@/contexts/AuthContext';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('useServiceComments - OrderItem vs ServiceFulfillment ID handling', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    userType: 'internal' as const,
    permissions: { fulfillment: true }
  };

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthContext.Provider, {
      value: {
        user: mockUser,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false
      }
    }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as typeof vi.fn).mockClear();
  });

  describe('Critical Bug Fix: ServiceFulfillment ID for API calls in order mode', () => {
    it('should use ServiceFulfillment ID for API calls, not OrderItem ID', async () => {
      // This test ensures we're using the correct ID type for API calls
      // The API expects ServiceFulfillment IDs, not OrderItem IDs

      const orderItemId = 'order-item-123';
      const serviceFulfillmentId = '456e4567-e89b-12d3-a456-426614174000';

      // Mock the order comments fetch
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: []
            }
          }
        })
      });

      // Render hook in order mode (serviceId is null)
      const { result } = renderHook(
        () => useServiceComments(null, '550e8400-e29b-41d4-a716-446655440001', 'SERVICE_TYPE', 'pending'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock successful comment creation
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'comment-1',
            text: 'Test comment',
            createdAt: new Date().toISOString()
          }
        })
      });

      // Create a comment, passing ServiceFulfillment ID as serviceId
      await act(async () => {
        await result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test comment',
          isInternalOnly: true,
          serviceId: serviceFulfillmentId // This should be used for the API call
        });
      });

      // Verify the API was called with ServiceFulfillment ID, not OrderItem ID
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/services/${serviceFulfillmentId}/comments`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test comment')
        })
      );

      // Verify the comment was added to the correct service in commentsByService
      expect(result.current.commentsByService[serviceFulfillmentId]).toBeDefined();
      expect(result.current.commentsByService[serviceFulfillmentId].comments).toHaveLength(1);
    });

    it('should update commentsByService state correctly after creating comment in order mode', async () => {
      const serviceFulfillmentId = '789e4567-e89b-12d3-a456-426614174000';
      const existingComment = {
        id: 'existing-comment',
        text: 'Existing comment',
        createdAt: '2024-01-01T00:00:00Z'
      };

      // Mock initial fetch with existing comment
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: [existingComment]
            }
          }
        })
      });

      const { result } = renderHook(
        () => useServiceComments(null, '550e8400-e29b-41d4-a716-446655440001', 'SERVICE_TYPE', 'pending'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify initial state
      expect(result.current.commentsByService[serviceFulfillmentId].comments).toHaveLength(1);

      // Mock comment creation
      const newComment = {
        id: 'new-comment',
        text: 'New comment',
        createdAt: new Date().toISOString()
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comment: newComment })
      });

      // Create comment
      await act(async () => {
        await result.current.createComment({
          templateId: 'template-1',
          finalText: 'New comment',
          isInternalOnly: true,
          serviceId: serviceFulfillmentId
        });
      });

      // Verify the state was updated correctly
      expect(result.current.commentsByService[serviceFulfillmentId].comments).toHaveLength(2);
      expect(result.current.commentsByService[serviceFulfillmentId].comments[0].id).toBe('new-comment');
      expect(result.current.commentsByService[serviceFulfillmentId].comments[1].id).toBe('existing-comment');
    });

    it('should handle delete with ServiceFulfillment ID in order mode', async () => {
      const serviceFulfillmentId = '999e4567-e89b-12d3-a456-426614174000';

      // Mock initial state
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: [
                { id: 'comment-to-delete', text: 'Delete me', createdAt: '2024-01-01T00:00:00Z' }
              ]
            }
          }
        })
      });

      const { result } = renderHook(
        () => useServiceComments(null, '550e8400-e29b-41d4-a716-446655440001', 'SERVICE_TYPE', 'pending'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock delete call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      // Mock refetch after delete
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: []
            }
          }
        })
      });

      // Delete comment using ServiceFulfillment ID
      await act(async () => {
        await result.current.deleteComment(serviceFulfillmentId, 'comment-to-delete');
      });

      // Verify the API was called with ServiceFulfillment ID
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/services/${serviceFulfillmentId}/comments/comment-to-delete`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should handle update with ServiceFulfillment ID in order mode', async () => {
      const serviceFulfillmentId = '888e4567-e89b-12d3-a456-426614174000';

      // Mock initial state
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: [
                { id: 'comment-to-update', text: 'Original text', createdAt: '2024-01-01T00:00:00Z' }
              ]
            }
          }
        })
      });

      const { result } = renderHook(
        () => useServiceComments(null, '550e8400-e29b-41d4-a716-446655440001', 'SERVICE_TYPE', 'pending'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock update call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      // Mock refetch after update
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          commentsByService: {
            [serviceFulfillmentId]: {
              comments: [
                { id: 'comment-to-update', text: 'Updated text', createdAt: '2024-01-01T00:00:00Z' }
              ]
            }
          }
        })
      });

      // Update comment using ServiceFulfillment ID
      await act(async () => {
        await result.current.updateComment('comment-to-update', {
          finalText: 'Updated text',
          serviceId: serviceFulfillmentId
        });
      });

      // Verify the API was called with ServiceFulfillment ID
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/services/${serviceFulfillmentId}/comments/comment-to-update`,
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('Updated text')
        })
      );
    });
  });

  describe('Single service mode should still work', () => {
    it('should use serviceId directly when not in order mode', async () => {
      const serviceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';

      // Mock fetch for single service
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          service: { id: serviceId }
        })
      });

      const { result } = renderHook(
        () => useServiceComments(serviceId, undefined, 'SERVICE_TYPE', 'pending'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock comment creation
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: { id: 'new-comment', text: 'Test', createdAt: new Date().toISOString() }
        })
      });

      // Create comment in single service mode
      await act(async () => {
        await result.current.createComment({
          templateId: 'template-1',
          finalText: 'Test comment',
          isInternalOnly: true
        });
      });

      // Should use the serviceId from hook initialization
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/services/${serviceId}/comments`,
        expect.objectContaining({
          method: 'POST'
        })
      );

      // Should update comments array, not commentsByService
      expect(result.current.comments).toHaveLength(1);
      expect(Object.keys(result.current.commentsByService)).toHaveLength(0);
    });
  });
});