// /GlobalRX_v2/src/components/fulfillment/__tests__/ServiceFulfillmentTable.expandable.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceFulfillmentTable } from '../ServiceFulfillmentTable';
import { useServiceComments } from '@/hooks/useServiceComments';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/hooks/useServiceComments', () => ({
  useServiceComments: vi.fn()
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
}));

// Mock fetch
global.fetch = vi.fn();

describe('ServiceFulfillmentTable - Expandable Rows for Comments', () => {
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440001';

  const mockServices = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: mockOrderId,
      orderItemId: '660e8400-e29b-41d4-a716-446655440001',
      serviceId: 'service-type-1',
      locationId: 'location-1',
      status: 'pending',
      service: {
        id: 'service-type-1',
        name: 'Criminal Background Check',
        category: 'Background'
      },
      location: {
        id: 'location-1',
        name: 'National',
        code2: 'US'
      }
    },
    {
      id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: mockOrderId,
      orderItemId: '660e8400-e29b-41d4-a716-446655440002',
      serviceId: 'service-type-2',
      locationId: 'location-2',
      status: 'processing',
      service: {
        id: 'service-type-2',
        name: 'Drug Test',
        category: 'Medical'
      },
      location: {
        id: 'location-2',
        name: 'California',
        code2: 'CA'
      }
    }
  ];

  const mockCommentsMap = {
    'f47ac10b-58cc-4372-a567-0e02b2c3d479': [
      { id: 'comment-1', finalText: 'Comment 1', isInternalOnly: true },
      { id: 'comment-2', finalText: 'Comment 2', isInternalOnly: false },
      { id: 'comment-3', finalText: 'Comment 3', isInternalOnly: true }
    ],
    'a47ac10b-58cc-4372-a567-0e02b2c3d479': [
      { id: 'comment-4', finalText: 'Comment 4', isInternalOnly: false }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123', userType: 'internal' }
    } as any);

    vi.mocked(useServiceComments).mockReturnValue({
      commentsByService: mockCommentsMap,
      getCommentCount: vi.fn((serviceId) => mockCommentsMap[serviceId]?.length || 0),
      loading: false,
      error: null
    } as any);
  });

  describe('comment count badges', () => {
    it('should display comment count badge on service rows', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      // Find the first service row
      const firstRow = screen.getByTestId('service-row-service-1');
      const firstBadge = within(firstRow).getByTestId('comment-count-badge');
      expect(firstBadge).toHaveTextContent('3 comments');

      // Find the second service row
      const secondRow = screen.getByTestId('service-row-service-2');
      const secondBadge = within(secondRow).getByTestId('comment-count-badge');
      expect(secondBadge).toHaveTextContent('1 comment');
    });

    it('should not show badge when no comments exist', () => {
      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: {},
        getCommentCount: vi.fn(() => 0),
        loading: false,
        error: null
      } as any);

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      expect(within(firstRow).queryByTestId('comment-count-badge')).not.toBeInTheDocument();
    });

    it('should show lock icon for services with internal comments', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      const lockIcon = within(firstRow).getByTestId('lock-icon');
      expect(lockIcon).toBeInTheDocument();
      expect(lockIcon).toHaveAttribute('title', 'Has internal comments');
    });

    it('should highlight rows with comments', () => {
      const { container } = render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = container.querySelector('[data-testid="service-row-service-1"]');
      expect(firstRow).toHaveClass('has-comments');

      const noCommentsService = {
        id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: mockOrderId,
        service: { name: 'Education Verification' }
      };

      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: {},
        getCommentCount: vi.fn(() => 0),
        loading: false,
        error: null
      } as any);

      render(
        <ServiceFulfillmentTable
          services={[noCommentsService]}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const noCommentsRow = container.querySelector('[data-testid="service-row-service-3"]');
      expect(noCommentsRow).not.toHaveClass('has-comments');
    });
  });

  describe('row expansion', () => {
    it('should expand row when clicked to show comments', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      // Comments section should not be visible initially
      expect(screen.queryByTestId('comments-section-service-1')).not.toBeInTheDocument();

      // Click the row to expand
      await user.click(firstRow);

      // Comments section should now be visible
      await waitFor(() => {
        const commentsSection = screen.getByTestId('comments-section-service-1');
        expect(commentsSection).toBeInTheDocument();
        expect(within(commentsSection).getByText('Comments (3)')).toBeInTheDocument();
      });
    });

    it('should show expand/collapse icon that rotates', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      const expandIcon = within(firstRow).getByTestId('expand-icon');

      // Icon should point right initially (collapsed)
      expect(expandIcon).toHaveClass('rotate-0');

      // Click to expand
      await user.click(firstRow);

      // Icon should rotate down (expanded)
      await waitFor(() => {
        expect(expandIcon).toHaveClass('rotate-90');
      });

      // Click again to collapse
      await user.click(firstRow);

      // Icon should rotate back
      await waitFor(() => {
        expect(expandIcon).toHaveClass('rotate-0');
      });
    });

    it('should collapse row when clicked again', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      // Expand
      await user.click(firstRow);
      expect(screen.getByTestId('comments-section-service-1')).toBeInTheDocument();

      // Collapse
      await user.click(firstRow);
      await waitFor(() => {
        expect(screen.queryByTestId('comments-section-service-1')).not.toBeInTheDocument();
      });
    });

    it('should allow multiple rows to be expanded simultaneously', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      const secondRow = screen.getByTestId('service-row-service-2');

      // Expand first row
      await user.click(firstRow);
      expect(screen.getByTestId('comments-section-service-1')).toBeInTheDocument();

      // Expand second row - first should stay expanded
      await user.click(secondRow);
      expect(screen.getByTestId('comments-section-service-1')).toBeInTheDocument();
      expect(screen.getByTestId('comments-section-service-2')).toBeInTheDocument();
    });

    it('should not interfere with action dropdown clicks', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={mockUpdate}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      const actionButton = within(firstRow).getByRole('button', { name: /actions/i });

      // Click action button should not expand row
      await user.click(actionButton);

      // Comments section should not be visible
      expect(screen.queryByTestId('comments-section-service-1')).not.toBeInTheDocument();

      // Action menu should be visible
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should expand row with keyboard navigation (Enter/Space)', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      // Focus the row
      firstRow.focus();

      // Press Enter to expand
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('comments-section-service-1')).toBeInTheDocument();

      // Press Space to collapse
      await user.keyboard(' ');

      await waitFor(() => {
        expect(screen.queryByTestId('comments-section-service-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('comments section display', () => {
    it('should show Add Comment button when expanded', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      await user.click(firstRow);

      const commentsSection = screen.getByTestId('comments-section-service-1');
      expect(within(commentsSection).getByRole('button', { name: /add comment/i })).toBeInTheDocument();
    });

    it('should pass service context to comment section', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      await user.click(firstRow);

      const commentsSection = screen.getByTestId('comments-section-service-1');

      // Should pass service name
      expect(within(commentsSection).getByText(/criminal background check/i)).toBeInTheDocument();

      // Should pass service status for template filtering
      expect(commentsSection).toHaveAttribute('data-service-status', 'pending');
    });

    it('should show empty state when no comments exist', async () => {
      const user = userEvent.setup();

      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: { 'f47ac10b-58cc-4372-a567-0e02b2c3d479': [] },
        getCommentCount: vi.fn(() => 0),
        loading: false,
        error: null
      } as any);

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      await user.click(firstRow);

      const commentsSection = screen.getByTestId('comments-section-service-1');
      expect(within(commentsSection).getByText('No comments yet. Add the first comment.')).toBeInTheDocument();
    });

    it('should show loading state while fetching comments', async () => {
      const user = userEvent.setup();

      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: {},
        getCommentCount: vi.fn(() => 0),
        loading: true,
        error: null
      } as any);

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      await user.click(firstRow);

      const commentsSection = screen.getByTestId('comments-section-service-1');
      expect(within(commentsSection).getByText('Loading comments...')).toBeInTheDocument();
    });
  });

  describe('bulk loading optimization', () => {
    it('should load all comments for order on mount', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      // Hook should be called with orderId for bulk loading
      expect(useServiceComments).toHaveBeenCalledWith(
        null, // No specific serviceId
        mockOrderId, // Load for entire order
        expect.anything(),
        expect.anything()
      );
    });

    it('should not make additional API calls when expanding rows', async () => {
      const user = userEvent.setup();

      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      // Reset fetch mock after initial load
      mockFetch.mockClear();

      // Expand multiple rows
      const firstRow = screen.getByTestId('service-row-service-1');
      const secondRow = screen.getByTestId('service-row-service-2');

      await user.click(firstRow);
      await user.click(secondRow);

      // No additional API calls should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should update comment counts when comments are added', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      // Initial count
      const firstRow = screen.getByTestId('service-row-service-1');
      expect(within(firstRow).getByTestId('comment-count-badge')).toHaveTextContent('3 comments');

      // Update mock to simulate new comment
      const updatedCommentsMap = {
        ...mockCommentsMap,
        'f47ac10b-58cc-4372-a567-0e02b2c3d479': [
          ...mockCommentsMap['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
          { id: 'comment-new', finalText: 'New comment', isInternalOnly: true }
        ]
      };

      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: updatedCommentsMap,
        getCommentCount: vi.fn((serviceId) => updatedCommentsMap[serviceId]?.length || 0),
        loading: false,
        error: null
      } as any);

      rerender(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      // Count should update
      expect(within(firstRow).getByTestId('comment-count-badge')).toHaveTextContent('4 comments');
    });
  });

  describe('visibility and permissions', () => {
    it('should not show expand controls in read-only mode', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={true}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      expect(within(firstRow).queryByTestId('expand-icon')).not.toBeInTheDocument();
      expect(within(firstRow).queryByTestId('comment-count-badge')).not.toBeInTheDocument();
    });

    it('should filter comments based on user type', async () => {
      const user = userEvent.setup();

      // Set user as customer
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'customer-123', userType: 'customer' }
      } as any);

      // Mock filtered comments (only external)
      vi.mocked(useServiceComments).mockReturnValue({
        commentsByService: {
          'f47ac10b-58cc-4372-a567-0e02b2c3d479': [
            { id: 'comment-2', finalText: 'Comment 2', isInternalOnly: false }
          ]
        },
        getCommentCount: vi.fn(() => 1),
        loading: false,
        error: null
      } as any);

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      // Should show filtered count
      expect(within(firstRow).getByTestId('comment-count-badge')).toHaveTextContent('1 comment');

      // Expand to verify filtered comments
      await user.click(firstRow);

      const commentsSection = screen.getByTestId('comments-section-service-1');
      expect(within(commentsSection).getByText('Comments (1)')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes for expandable rows', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      expect(firstRow).toHaveAttribute('aria-expanded', 'false');
      expect(firstRow).toHaveAttribute('aria-controls', 'comments-section-service-1');
      expect(firstRow).toHaveAttribute('role', 'button');
      expect(firstRow).toHaveAttribute('tabindex', '0');
    });

    it('should update ARIA expanded state when expanded', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');

      await user.click(firstRow);

      expect(firstRow).toHaveAttribute('aria-expanded', 'true');
    });

    it('should announce comment count to screen readers', () => {
      render(
        <ServiceFulfillmentTable
          services={mockServices}
          orderId={mockOrderId}
          onServiceUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const firstRow = screen.getByTestId('service-row-service-1');
      const badge = within(firstRow).getByTestId('comment-count-badge');

      expect(badge).toHaveAttribute('aria-label', '3 comments available. Click row to expand.');
    });
  });
});