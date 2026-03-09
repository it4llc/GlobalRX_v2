// /GlobalRX_v2/src/hooks/__tests__/useServiceComments-deprecation-fix.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useServiceComments } from '@/hooks/useServiceComments';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'user-123',
      userType: 'internal',
      email: 'test@example.com'
    }
  }))
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('useServiceComments - Works Without Deprecated Schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockReset();
  });

  describe('Schema Independence', () => {
    it('should successfully initialize without bulkCommentsResponseSchema', () => {
      // The hook should work fine even though bulkCommentsResponseSchema will be removed
      // This proves the deprecated import is not needed

      const { result } = renderHook(() =>
        useServiceComments('service-123', undefined, 'background_check', 'pending')
      );

      // Hook should initialize successfully
      expect(result.current).toBeDefined();
      expect(result.current.comments).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should not use deprecated schemas for response validation', async () => {
      // The hook doesn't actually validate responses with the deprecated schemas
      // It just processes the JSON response directly

      const mockResponse = {
        comments: [
          {
            id: 'comment-1',
            serviceId: 'service-123',
            templateId: 'template-1',
            finalText: 'Test comment',
            isInternalOnly: true,
            createdBy: 'user-123',
            createdAt: new Date().toISOString(),
            updatedBy: null,
            updatedAt: null,
            template: {
              shortName: 'TEST',
              longName: 'Test Template'
            },
            createdByUser: {
              name: 'Test User',
              email: 'test@example.com'
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const { result } = renderHook(() =>
        useServiceComments('service-123', undefined, 'background_check', 'pending')
      );

      // Wait for the hook to fetch data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The hook processes the response without using bulkCommentsResponseSchema
      expect(result.current.comments).toHaveLength(1);
      expect(result.current.comments[0].id).toBe('comment-1');
    });

    it('should handle bulk order comments without deprecated schema', async () => {
      // Test that order comments work without bulkOrderCommentsResponseSchema

      const mockOrderResponse = {
        commentsByService: {
          'service-1': [
            {
              id: 'comment-1',
              serviceId: 'service-1',
              templateId: 'template-1',
              finalText: 'Service 1 comment',
              isInternalOnly: false,
              createdBy: 'user-123',
              createdAt: new Date().toISOString(),
              updatedBy: null,
              updatedAt: null,
              template: {
                shortName: 'S1',
                longName: 'Service 1 Template'
              },
              createdByUser: {
                name: 'User 1',
                email: 'user1@example.com'
              }
            }
          ],
          'service-2': [
            {
              id: 'comment-2',
              serviceId: 'service-2',
              templateId: 'template-2',
              finalText: 'Service 2 comment',
              isInternalOnly: true,
              createdBy: 'user-456',
              createdAt: new Date().toISOString(),
              updatedBy: null,
              updatedAt: null,
              template: {
                shortName: 'S2',
                longName: 'Service 2 Template'
              },
              createdByUser: {
                name: 'User 2',
                email: 'user2@example.com'
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderResponse
      });

      const { result } = renderHook(() =>
        useServiceComments(null, 'order-123')
      );

      // Wait for the hook to fetch data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The hook processes order comments without using deprecated schema
      expect(result.current.commentsByService).toBeDefined();
      expect(Object.keys(result.current.commentsByService || {}).length).toBe(2);
      expect(result.current.comments).toHaveLength(2);
    });
  });

  describe('Schema Usage - Only Create and Update', () => {
    it('should use createServiceCommentSchema for validation', async () => {
      // The hook DOES use createServiceCommentSchema for input validation

      const { result } = renderHook(() =>
        useServiceComments('service-123')
      );

      // Test with invalid data - missing templateId
      await expect(async () => {
        await result.current.createComment({
          templateId: '',  // Invalid - empty string
          finalText: 'Test comment',
          isInternalOnly: true
        });
      }).rejects.toThrow('Template selection is required');

      // Test with invalid data - empty text
      await expect(async () => {
        await result.current.createComment({
          templateId: 'template-123',
          finalText: '',  // Invalid - empty text
          isInternalOnly: true
        });
      }).rejects.toThrow('Comment text cannot be empty');
    });

    it('should use updateServiceCommentSchema for validation', async () => {
      // The hook DOES use updateServiceCommentSchema for input validation

      const { result } = renderHook(() =>
        useServiceComments('service-123')
      );

      // Mock initial comments
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] })
      });

      // Test with invalid update data - empty text
      await expect(async () => {
        await result.current.updateComment('comment-123', {
          finalText: '   ',  // Invalid - only whitespace
          isInternalOnly: false
        });
      }).rejects.toThrow('Comment text cannot be empty');

      // Test with invalid update data - text too long
      const longText = 'a'.repeat(1001);
      await expect(async () => {
        await result.current.updateComment('comment-123', {
          finalText: longText,  // Invalid - exceeds 1000 chars
          isInternalOnly: false
        });
      }).rejects.toThrow('Comment cannot exceed 1000 characters');
    });

    it('should NOT use bulkCommentsResponseSchema anywhere', () => {
      // Search through the hook's code to verify bulkCommentsResponseSchema is never used
      // This is a meta-test that proves the import can be safely removed

      const hookCode = useServiceComments.toString();

      // The schema name should not appear in the function body
      // (except potentially in the import statement which we're removing)
      const usageCount = (hookCode.match(/bulkCommentsResponseSchema/g) || []).length;

      // Since we're testing the actual function, it won't contain the import statement
      // So the count should be 0
      expect(usageCount).toBe(0);
    });
  });

  describe('Functionality Preservation', () => {
    it('should maintain all hook functionality after removing deprecated imports', async () => {
      // Comprehensive test to ensure all hook features work

      const { result } = renderHook(() =>
        useServiceComments('service-123', undefined, 'background_check', 'pending')
      );

      // Test all return values are present
      expect(result.current.comments).toBeDefined();
      expect(result.current.commentsByService).toBeDefined();
      expect(result.current.loading).toBeDefined();
      expect(result.current.error).toBeDefined();
      expect(result.current.createComment).toBeDefined();
      expect(result.current.updateComment).toBeDefined();
      expect(result.current.deleteComment).toBeDefined();
      expect(result.current.refetch).toBeDefined();
      expect(result.current.getCommentCount).toBeDefined();
      expect(result.current.checkVisibilityChangeWarning).toBeDefined();
      expect(result.current.canCreateComment).toBeDefined();
      expect(result.current.canEditComment).toBeDefined();
      expect(result.current.canDeleteComment).toBeDefined();
      expect(result.current.getAvailableTemplates).toBeDefined();
      expect(result.current.applyTemplate).toBeDefined();
      expect(result.current.extractPlaceholders).toBeDefined();
      expect(result.current.getVisibleComments).toBeDefined();
      expect(result.current.getSortedComments).toBeDefined();
      expect(result.current.availableTemplates).toBeDefined();
      expect(result.current.hasUnreplacedPlaceholders).toBeDefined();
      expect(result.current.requiresDeleteConfirmation).toBeDefined();

      // Test permission functions work
      expect(result.current.canCreateComment()).toBe(true); // internal user can create
      expect(result.current.canEditComment()).toBe(true); // internal user can edit
      expect(result.current.canDeleteComment()).toBe(true); // internal user can delete

      // Test utility functions work
      expect(result.current.hasUnreplacedPlaceholders('Test [placeholder] text')).toBe(true);
      expect(result.current.hasUnreplacedPlaceholders('Test text without placeholders')).toBe(false);
      expect(result.current.extractPlaceholders('Test [name] and [date]')).toEqual(['name', 'date']);
      expect(result.current.requiresDeleteConfirmation()).toBe(true);
    });

    it('should handle errors correctly without deprecated schemas', async () => {
      // Test error handling still works

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useServiceComments('service-123')
      );

      // Wait for the hook to handle the error
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load comments');
      expect(result.current.comments).toEqual([]);
    });
  });
});