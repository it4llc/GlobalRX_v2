import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceCommentSection } from '../ServiceCommentSection';
import { AuthContext } from '@/contexts/AuthContext';
import { TranslationContext } from '@/contexts/TranslationContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the useServiceComments hook
vi.mock('@/hooks/useServiceComments', () => ({
  useServiceComments: vi.fn(() => ({
    comments: [],
    commentsByService: {},
    loading: false,
    error: null,
    fetchComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    canCreateComment: vi.fn(() => false),
    canEditComment: vi.fn(() => false),
    canDeleteComment: vi.fn(() => false),
    checkCanCreate: vi.fn(() => true),
    getAvailableTemplates: vi.fn(() => []),
    availableTemplates: [],
    getSortedComments: vi.fn(() => [])
  }))
}));

// Mock clientLogger
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('ServiceCommentSection - ID Type Bug Prevention', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    userType: 'internal' as const,
    permissions: { fulfillment: true }
  };

  const mockTranslations = {
    t: (key: string) => key,
    language: 'en'
  };

  const renderComponent = (props: any = {}) => {
    return render(
      React.createElement(AuthContext.Provider, {
        value: {
          user: mockUser,
          login: vi.fn(),
          logout: vi.fn(),
          isLoading: false
        }
      },
        React.createElement(TranslationContext.Provider, {
          value: mockTranslations
        },
          React.createElement(ServiceCommentSection, props)
        )
      )
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Critical: Correct ID Usage for API Calls', () => {
    it('should use serviceFulfillmentId for API calls when in order mode', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const mockCreateComment = vi.fn().mockResolvedValue({ id: 'new-comment' });

      (useServiceComments as any).mockReturnValue({
        comments: [],
        commentsByService: {
          'service-fulfillment-123': {
            comments: []
          }
        },
        loading: false,
        error: null,
        fetchComments: vi.fn(),
        createComment: mockCreateComment,
        updateComment: vi.fn(),
        deleteComment: vi.fn(),
        canCreateComment: vi.fn(() => false),
        canEditComment: vi.fn(() => false),
        canDeleteComment: vi.fn(() => false),
        checkCanCreate: vi.fn(() => true),
        getAvailableTemplates: vi.fn(() => [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ]),
        availableTemplates: [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ],
        getSortedComments: vi.fn(() => [])
      });

      renderComponent({
        serviceId: 'order-item-456', // OrderItem ID
        orderId: '550e8400-e29b-41d4-a716-446655440003',
        serviceFulfillmentId: 'service-fulfillment-123', // ServiceFulfillment ID
        serviceName: 'Test Service'
      });

      // Open the create modal
      const addButton = screen.getByRole('button', { name: /add comment/i });
      fireEvent.click(addButton);

      // Wait for modal and interact with it
      await waitFor(() => {
        const textArea = screen.getByPlaceholderText(/enter your comment/i);
        fireEvent.change(textArea, { target: { value: 'Test comment' } });
      });

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /save comment/i });
      fireEvent.click(submitButton);

      // CRITICAL ASSERTION: Verify the correct ID is passed
      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceId: 'service-fulfillment-123' // Should use ServiceFulfillment ID, not OrderItem ID
          })
        );
      });

      // Ensure it was NOT called with the OrderItem ID
      expect(mockCreateComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'order-item-456'
        })
      );
    });

    it('should use serviceId directly when NOT in order mode', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const mockCreateComment = vi.fn().mockResolvedValue({ id: 'new-comment' });

      (useServiceComments as any).mockReturnValue({
        comments: [],
        commentsByService: {},
        loading: false,
        error: null,
        fetchComments: vi.fn(),
        createComment: mockCreateComment,
        updateComment: vi.fn(),
        deleteComment: vi.fn(),
        canCreateComment: vi.fn(() => false),
        canEditComment: vi.fn(() => false),
        canDeleteComment: vi.fn(() => false),
        checkCanCreate: vi.fn(() => true),
        getAvailableTemplates: vi.fn(() => [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ]),
        availableTemplates: [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ],
        getSortedComments: vi.fn(() => [])
      });

      renderComponent({
        serviceId: 'service-direct-123',
        // No orderId or serviceFulfillmentId - single service mode
        serviceName: 'Test Service'
      });

      // Open the create modal
      const addButton = screen.getByRole('button', { name: /add comment/i });
      fireEvent.click(addButton);

      // Wait for modal and interact with it
      await waitFor(() => {
        const textArea = screen.getByPlaceholderText(/enter your comment/i);
        fireEvent.change(textArea, { target: { value: 'Test comment' } });
      });

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /save comment/i });
      fireEvent.click(submitButton);

      // Verify serviceId is used directly in single service mode
      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceId: 'service-direct-123'
          })
        );
      });
    });

    it('should handle update with correct ID in order mode', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const mockUpdateComment = vi.fn().mockResolvedValue({ success: true });

      const existingComment = {
        id: 'comment-1',
        templateId: 'template-1',
        finalText: 'Original comment',
        isInternalOnly: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: mockUser,
        createdById: mockUser.id,
        orderItem: null,
        orderItemId: 'order-item-456',
        template: { id: 'template-1', name: 'Test Template' }
      };

      (useServiceComments as any).mockReturnValue({
        comments: [existingComment],
        commentsByService: {
          'service-fulfillment-123': {
            comments: [existingComment]
          }
        },
        loading: false,
        error: null,
        fetchComments: vi.fn(),
        createComment: vi.fn(),
        updateComment: mockUpdateComment,
        deleteComment: vi.fn(),
        canCreateComment: vi.fn(() => false),
        canEditComment: vi.fn(() => true),
        canDeleteComment: vi.fn(() => false),
        checkCanCreate: vi.fn(() => false),
        getAvailableTemplates: vi.fn(() => []),
        availableTemplates: [],
        getSortedComments: vi.fn(() => [existingComment])
      });

      renderComponent({
        serviceId: 'order-item-456',
        orderId: '550e8400-e29b-41d4-a716-446655440003',
        serviceFulfillmentId: 'service-fulfillment-123',
        serviceName: 'Test Service'
      });

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      // Update the comment
      await waitFor(() => {
        const textArea = screen.getByDisplayValue('Original comment');
        fireEvent.change(textArea, { target: { value: 'Updated comment' } });
      });

      // Save the update
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      // Verify update was called with ServiceFulfillment ID
      await waitFor(() => {
        expect(mockUpdateComment).toHaveBeenCalledWith(
          'comment-1',
          expect.objectContaining({
            serviceId: 'service-fulfillment-123'
          })
        );
      });
    });

    it('should handle delete with correct ID in order mode', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const mockDeleteComment = vi.fn().mockResolvedValue({ success: true });

      const existingComment = {
        id: 'comment-to-delete',
        templateId: 'template-1',
        finalText: 'Delete me',
        isInternalOnly: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: mockUser,
        createdById: mockUser.id,
        orderItem: null,
        orderItemId: 'order-item-456',
        template: { id: 'template-1', name: 'Test Template' }
      };

      (useServiceComments as any).mockReturnValue({
        comments: [existingComment],
        commentsByService: {
          'service-fulfillment-123': {
            comments: [existingComment]
          }
        },
        loading: false,
        error: null,
        fetchComments: vi.fn(),
        createComment: vi.fn(),
        updateComment: vi.fn(),
        deleteComment: mockDeleteComment,
        canCreateComment: vi.fn(() => false),
        canEditComment: vi.fn(() => false),
        canDeleteComment: vi.fn(() => true),
        checkCanCreate: vi.fn(() => false),
        getAvailableTemplates: vi.fn(() => []),
        availableTemplates: [],
        getSortedComments: vi.fn(() => [existingComment]),
        requiresDeleteConfirmation: vi.fn(() => true)
      });

      renderComponent({
        serviceId: 'order-item-456',
        orderId: '550e8400-e29b-41d4-a716-446655440003',
        serviceFulfillmentId: 'service-fulfillment-123',
        serviceName: 'Test Service'
      });

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Verify delete was called with ServiceFulfillment ID
      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith(
          'service-fulfillment-123',
          'comment-to-delete'
        );
      });
    });
  });

  describe('Regression Prevention', () => {
    it('should NEVER pass null as serviceId to CRUD operations', async () => {
      const { useServiceComments } = await import('@/hooks/useServiceComments');
      const mockCreateComment = vi.fn().mockResolvedValue({ id: 'new-comment' });

      (useServiceComments as any).mockReturnValue({
        comments: [],
        commentsByService: {},
        loading: false,
        error: null,
        fetchComments: vi.fn(),
        createComment: mockCreateComment,
        updateComment: vi.fn(),
        deleteComment: vi.fn(),
        canCreateComment: vi.fn(() => false),
        canEditComment: vi.fn(() => false),
        canDeleteComment: vi.fn(() => false),
        checkCanCreate: vi.fn(() => true),
        getAvailableTemplates: vi.fn(() => [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ]),
        availableTemplates: [
          { id: 'template-1', name: 'Test Template', content: 'Test content' }
        ],
        getSortedComments: vi.fn(() => [])
      });

      // Render with all IDs provided
      renderComponent({
        serviceId: 'order-item-999',
        orderId: 'order-999',
        serviceFulfillmentId: '999e4567-e89b-12d3-a456-426614174000',
        serviceName: 'Test Service'
      });

      // Trigger comment creation
      const addButton = screen.getByRole('button', { name: /add comment/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        const textArea = screen.getByPlaceholderText(/enter your comment/i);
        fireEvent.change(textArea, { target: { value: 'Test comment' } });
      });

      const submitButton = screen.getByRole('button', { name: /save comment/i });
      fireEvent.click(submitButton);

      // CRITICAL: Ensure null is NEVER passed as serviceId
      await waitFor(() => {
        expect(mockCreateComment).toHaveBeenCalled();
        const callArgs = mockCreateComment.mock.calls[0][0];
        expect(callArgs.serviceId).not.toBeNull();
        expect(callArgs.serviceId).not.toBeUndefined();
        expect(callArgs.serviceId).toBeTruthy();
      });
    });
  });
});