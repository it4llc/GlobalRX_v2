// /GlobalRX_v2/src/components/services/__tests__/ServiceCommentSection.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceCommentSection } from '../ServiceCommentSection';
import { useServiceComments } from '@/hooks/useServiceComments';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/hooks/useServiceComments', () => ({
  useServiceComments: vi.fn()
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock HTMLDialogElement if not available in test environment
if (typeof HTMLDialogElement === 'undefined') {
  global.HTMLDialogElement = class extends HTMLElement {
    constructor() {
      super();
      this.open = false;
    }
    showModal() {
      this.open = true;
      this.style.display = 'block';
    }
    close() {
      this.open = false;
      this.style.display = 'none';
    }
  };
}

describe('ServiceCommentSection', () => {
  const mockServiceId = 'service-123';
  const mockServiceName = 'Criminal Background Check';
  const mockServiceType = 'BACKGROUND_CHECK';
  const mockServiceStatus = 'PROCESSING';

  const defaultMockHook = {
    comments: [],
    loading: false,
    error: null,
    getVisibleComments: vi.fn(() => []),
    getSortedComments: vi.fn(() => []),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    canCreateComment: vi.fn(() => true),
    canEditComment: vi.fn(() => true),
    canDeleteComment: vi.fn(() => true),
    availableTemplates: [],
    hasUnreplacedPlaceholders: vi.fn(() => false),
    extractPlaceholders: vi.fn(() => []),
    checkVisibilityChangeWarning: vi.fn(),
    requiresDeleteConfirmation: vi.fn(() => true)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServiceComments).mockReturnValue(defaultMockHook);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123', userType: 'internal' }
    } as any);
  });

  describe('comment display', () => {
    it('should show empty state when no comments exist', () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.getByText('No comments yet. Add the first comment.')).toBeInTheDocument();
    });

    it('should display comments list when comments exist', () => {
      const mockComments = [
        {
          id: 'comment-1',
          finalText: 'Document verification in progress',
          templateName: 'Processing Update',
          isInternalOnly: true,
          createdByName: 'John Doe',
          createdAt: '2024-03-01T10:00:00Z',
          updatedBy: null,
          updatedByName: null,
          updatedAt: null
        },
        {
          id: 'comment-2',
          finalText: 'Need additional documentation',
          templateName: 'Document Request',
          isInternalOnly: false,
          createdByName: 'Jane Smith',
          createdAt: '2024-03-02T14:00:00Z',
          updatedBy: 'user-456',
          updatedByName: 'Mike Johnson',
          updatedAt: '2024-03-02T16:00:00Z'
        }
      ];

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: mockComments,
        getVisibleComments: vi.fn(() => mockComments),
        getSortedComments: vi.fn(() => mockComments)
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      // Check header with count
      expect(screen.getByText('Comments (2)')).toBeInTheDocument();

      // Check first comment
      expect(screen.getByText('Document verification in progress')).toBeInTheDocument();
      expect(screen.getByText('Processing Update')).toBeInTheDocument();
      expect(screen.getByText('Internal')).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();

      // Check second comment with edit history
      expect(screen.getByText('Need additional documentation')).toBeInTheDocument();
      expect(screen.getByText('Document Request')).toBeInTheDocument();
      expect(screen.getByText('External')).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      expect(screen.getByText(/Edited by Mike Johnson/)).toBeInTheDocument();
    });

    it('should show loading state while fetching comments', () => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        loading: true
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.getByText('Loading comments...')).toBeInTheDocument();
    });

    it('should show error state when loading fails', () => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        error: 'Failed to load comments'
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.getByText('Failed to load comments')).toBeInTheDocument();
    });

    it('should visually distinguish internal comments', () => {
      const mockComments = [
        {
          id: 'comment-1',
          finalText: 'Internal note',
          isInternalOnly: true,
          createdByName: 'User',
          createdAt: new Date().toISOString()
        }
      ];

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: mockComments,
        getVisibleComments: vi.fn(() => mockComments),
        getSortedComments: vi.fn(() => mockComments)
      });

      const { container } = render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCard = container.querySelector('[data-testid="comment-card-comment-1"]');
      expect(commentCard).toHaveClass('bg-gray-50'); // Gray background for internal

      const lockIcon = within(commentCard as HTMLElement).getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();
    });
  });

  describe('add comment functionality', () => {
    it('should show Add Comment button when user has permission', () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.getByRole('button', { name: /add comment/i })).toBeInTheDocument();
    });

    it('should hide Add Comment button when user lacks permission', () => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        canCreateComment: vi.fn(() => false)
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.queryByRole('button', { name: /add comment/i })).not.toBeInTheDocument();
    });

    it('should open comment creation modal when Add Comment clicked', async () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const addButton = screen.getByRole('button', { name: /add comment/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(`Add Comment to ${mockServiceName}`)).toBeInTheDocument();
      });
    });

    it('should disable Add Comment when no templates available', () => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        availableTemplates: []
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const addButton = screen.getByRole('button', { name: /add comment/i });
      expect(addButton).toBeDisabled();
      expect(addButton).toHaveAttribute('title', 'No templates available for this service');
    });
  });

  describe('edit comment functionality', () => {
    const mockComment = {
      id: 'comment-1',
      finalText: 'Original comment text',
      isInternalOnly: true,
      createdByName: 'John Doe',
      createdAt: new Date().toISOString()
    };

    beforeEach(() => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: [mockComment],
        getVisibleComments: vi.fn(() => [mockComment]),
        getSortedComments: vi.fn(() => [mockComment])
      });
    });

    it('should show Edit button for internal users', () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCard = screen.getByTestId('comment-card-comment-1');
      expect(within(commentCard).getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should not show Edit button for vendors', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'vendor-123', userType: 'vendor' }
      } as any);

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: [mockComment],
        getVisibleComments: vi.fn(() => [mockComment]),
        getSortedComments: vi.fn(() => [mockComment]),
        canEditComment: vi.fn(() => false)
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCard = screen.getByTestId('comment-card-comment-1');
      expect(within(commentCard).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should open edit modal with current values when Edit clicked', async () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Comment')).toBeInTheDocument();
        const textInput = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
        expect(textInput.value).toBe('Original comment text');
        const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
        expect(internalCheckbox.checked).toBe(true);
      });
    });
  });

  describe('delete comment functionality', () => {
    const mockComment = {
      id: 'comment-1',
      finalText: 'Comment to delete',
      isInternalOnly: true,
      createdByName: 'John Doe',
      createdAt: new Date().toISOString()
    };

    beforeEach(() => {
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: [mockComment],
        getVisibleComments: vi.fn(() => [mockComment]),
        getSortedComments: vi.fn(() => [mockComment])
      });
    });

    it('should show Delete button for internal users', () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCard = screen.getByTestId('comment-card-comment-1');
      expect(within(commentCard).getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not show Delete button for vendors', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'vendor-123', userType: 'vendor' }
      } as any);

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: [mockComment],
        getVisibleComments: vi.fn(() => [mockComment]),
        getSortedComments: vi.fn(() => [mockComment]),
        canDeleteComment: vi.fn(() => false)
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCard = screen.getByTestId('comment-card-comment-1');
      expect(within(commentCard).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should show confirmation dialog when Delete clicked', async () => {
      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to delete this comment? This action cannot be undone.')).toBeInTheDocument();
      });
    });

    it('should call deleteComment when deletion is confirmed', async () => {
      const mockDelete = vi.fn();
      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: [mockComment],
        getVisibleComments: vi.fn(() => [mockComment]),
        getSortedComments: vi.fn(() => [mockComment]),
        deleteComment: mockDelete
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
        fireEvent.click(confirmButton);
      });

      expect(mockDelete).toHaveBeenCalledWith('comment-1');
    });
  });

  describe('visibility filtering', () => {
    it('should show only external comments to customers', () => {
      const mockComments = [
        {
          id: 'comment-1',
          finalText: 'Internal comment',
          isInternalOnly: true,
          createdByName: 'John',
          createdAt: new Date().toISOString()
        },
        {
          id: 'comment-2',
          finalText: 'External comment',
          isInternalOnly: false,
          createdByName: 'Jane',
          createdAt: new Date().toISOString()
        }
      ];

      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'customer-123', userType: 'customer' }
      } as any);

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: mockComments,
        getVisibleComments: vi.fn(() => [mockComments[1]]), // Only external
        getSortedComments: vi.fn(() => [mockComments[1]])
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      expect(screen.getByText('External comment')).toBeInTheDocument();
      expect(screen.queryByText('Internal comment')).not.toBeInTheDocument();
      expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('should display comments in chronological order (newest first)', () => {
      const mockComments = [
        {
          id: 'comment-1',
          finalText: 'Oldest comment',
          createdAt: '2024-01-01T10:00:00Z',
          createdByName: 'User',
          isInternalOnly: false
        },
        {
          id: 'comment-2',
          finalText: 'Middle comment',
          createdAt: '2024-01-02T10:00:00Z',
          createdByName: 'User',
          isInternalOnly: false
        },
        {
          id: 'comment-3',
          finalText: 'Newest comment',
          createdAt: '2024-01-03T10:00:00Z',
          createdByName: 'User',
          isInternalOnly: false
        }
      ];

      const sortedComments = [...mockComments].reverse(); // Newest first

      vi.mocked(useServiceComments).mockReturnValue({
        ...defaultMockHook,
        comments: mockComments,
        getVisibleComments: vi.fn(() => mockComments),
        getSortedComments: vi.fn(() => sortedComments)
      });

      render(
        <ServiceCommentSection
          serviceId={mockServiceId}
          serviceName={mockServiceName}
          serviceType={mockServiceType}
          serviceStatus={mockServiceStatus}
        />
      );

      const commentCards = screen.getAllByTestId(/comment-card-/);
      expect(commentCards[0]).toHaveTextContent('Newest comment');
      expect(commentCards[1]).toHaveTextContent('Middle comment');
      expect(commentCards[2]).toHaveTextContent('Oldest comment');
    });
  });
});