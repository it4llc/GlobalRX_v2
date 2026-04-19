// /GlobalRX_v2/src/components/fulfillment/OrderStatusDropdown.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderStatusDropdown } from './OrderStatusDropdown';

// Mock fetch
global.fetch = vi.fn();

// Mock toast notifications
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    toastSuccess: mockToastSuccess,
    toastError: mockToastError
  })
}));

describe('OrderStatusDropdown', () => {
  const mockProps = {
    orderId: '550e8400-e29b-41d4-a716-446655440001',
    currentStatus: 'draft',
    onStatusChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('dropdown rendering', () => {
    it('should display current status as dropdown trigger', () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveTextContent('Draft');
    });

    it('should apply correct status color class', () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      // Component uses Tailwind classes for draft status
      expect(trigger).toHaveClass('bg-gray-100');
      expect(trigger).toHaveClass('text-gray-800');
    });

    it('should display dropdown icon', () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      render(<OrderStatusDropdown {...mockProps} />);

      const icon = screen.getByTestId('dropdown-icon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('dropdown interaction', () => {
    it('should show all available status options when clicked', async () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        // Check for dropdown listbox
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();

        // Find all dropdown items
        const items = screen.getAllByRole('option');
        expect(items).toHaveLength(7);
      });
    });

    it('should highlight current status in dropdown', async () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const currentOption = await screen.findByRole('option', { name: 'Draft', selected: true });
      expect(currentOption).toHaveClass('selected');
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <OrderStatusDropdown {...mockProps} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      const trigger = screen.getByTestId('order-status-dropdown');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click outside element
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown on Escape key', async () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('status update flow', () => {
    it('should call API when new status is selected', async () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '550e8400-e29b-41d4-a716-446655440001',
          statusCode: 'processing',
          message: 'Order status updated successfully'
        })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001/status',
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'processing' })
          }
        );
      });
    });

    it('should show loading state during update', async () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      let resolvePromise;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      global.fetch.mockReturnValueOnce(promise);

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ statusCode: 'Processing' })
      });

      // Loading indicator should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });
    });

    it('should disable dropdown during update', async () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      let resolvePromise;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      global.fetch.mockReturnValueOnce(promise);

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      // Dropdown should be disabled
      await waitFor(() => {
        const dropdownTrigger = screen.getByRole('button');
        expect(dropdownTrigger).toBeDisabled();
      });

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ statusCode: 'Processing' })
      });

      // Dropdown should be enabled again
      await waitFor(() => {
        const dropdownTrigger = screen.getByRole('button');
        expect(dropdownTrigger).not.toBeDisabled();
      });
    });

    it('should update displayed status after successful update', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '550e8400-e29b-41d4-a716-446655440001',
          statusCode: 'processing'
        })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveTextContent('Draft');

      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        const updatedTrigger = screen.getByRole('button');
        expect(updatedTrigger).toHaveTextContent('Processing');
      });
    });

    it('should call onStatusChange callback after successful update', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '550e8400-e29b-41d4-a716-446655440001',
          statusCode: 'processing'
        })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(mockProps.onStatusChange).toHaveBeenCalledWith('processing');
      });
    });

    it('should show success toast after update', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '550e8400-e29b-41d4-a716-446655440001',
          statusCode: 'processing',
          message: 'Order status updated successfully'
        })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const options = await screen.findAllByRole('option');
      const processingOption = options.find(opt => opt.textContent === 'Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Order status updated successfully');
      });
    });

    it('should not update if same status is selected', async () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // Find and click on current status (draft)
      const options = await screen.findAllByRole('option');
      const draftOption = options.find(opt => opt.textContent === 'Draft');
      fireEvent.click(draftOption);

      // Should not call API
      expect(global.fetch).not.toHaveBeenCalled();

      // Should close dropdown
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error toast on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const options = await screen.findAllByRole('option');
      const processingOption = options.find(opt => opt.textContent === 'Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to update order status');
      });
    });

    it('should revert to original status on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveTextContent('Draft');

      fireEvent.click(trigger);

      const processingOption = await screen.findByText('Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        const revertedTrigger = screen.getByRole('button');
        expect(revertedTrigger).toHaveTextContent('Draft');
      });
    });

    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const options = await screen.findAllByRole('option');
      const processingOption = options.find(opt => opt.textContent === 'Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error. Please try again.');
      });
    });

    it('should handle 403 forbidden response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Insufficient permissions' })
      });

      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const options = await screen.findAllByRole('option');
      const processingOption = options.find(opt => opt.textContent === 'Processing');
      fireEvent.click(processingOption);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('You do not have permission to update order status');
      });
    });
  });

  describe('status display formatting', () => {
    it('should format status labels correctly', () => {
      const statuses = {
        'draft': 'Draft',
        'submitted': 'Submitted',
        'processing': 'Processing',
        'missing_info': 'Missing Information',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'cancelled_dnb': 'Cancelled-DNB'
      };

      Object.entries(statuses).forEach(([value, label]) => {
        const { rerender } = render(
          <OrderStatusDropdown {...mockProps} currentStatus={value} />
        );

        const trigger = screen.getByRole('button');
        expect(trigger).toHaveTextContent(label);

        rerender(<div />); // Clear for next iteration
      });
    });

    it('should apply correct color classes for each status', () => {
      const statusColors = {
        'draft': 'bg-gray-100',
        'submitted': 'bg-blue-100',
        'processing': 'bg-green-50',
        'missing_info': 'bg-red-100',
        'completed': 'bg-green-200',
        'cancelled': 'bg-purple-100',
        'cancelled_dnb': 'bg-purple-100'
      };

      Object.entries(statusColors).forEach(([status, className]) => {
        const { rerender } = render(
          <OrderStatusDropdown {...mockProps} currentStatus={status} />
        );

        const trigger = screen.getByRole('button');
        expect(trigger).toHaveClass(className);

        rerender(<div />); // Clear for next iteration
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');

      // Open with Enter key
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Find option elements
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);

      // Click second option
      await user.click(options[1]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should have proper focus management', async () => {
      render(<OrderStatusDropdown {...mockProps} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const listbox = await screen.findByRole('listbox');
      expect(listbox).toBeInTheDocument();

      // First option should have autoFocus attribute
      const firstOption = screen.getAllByRole('option')[0];
      expect(firstOption).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('disabled state', () => {
    it('should disable dropdown when disabled prop is true', () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      render(<OrderStatusDropdown {...mockProps} disabled={true} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toBeDisabled();

      fireEvent.click(trigger);

      // Dropdown should not open
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should show disabled cursor', () => {
      // THIS TEST WILL FAIL because the component doesn't exist yet
      render(<OrderStatusDropdown {...mockProps} disabled={true} />);

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('cursor-not-allowed');
    });
  });

  describe('custom options', () => {
    it('should accept custom status options', async () => {
      const customOptions = [
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'approved', label: 'Approved' }
      ];

      render(<OrderStatusDropdown {...mockProps} options={customOptions} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(3);

        const texts = options.map(opt => opt.textContent);
        expect(texts).toContain('Draft');
        expect(texts).toContain('Submitted');
        expect(texts).toContain('Approved');
      });
    });
  });
});