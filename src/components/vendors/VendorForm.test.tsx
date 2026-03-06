// /GlobalRX_v2/src/components/vendors/VendorForm.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VendorForm } from './VendorForm';

// Mock fetch
global.fetch = vi.fn();

describe('VendorForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create mode', () => {
    it('should render all required fields', () => {
      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={vi.fn()} />);

      expect(screen.getByLabelText(/vendor name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/primary vendor/i)).toBeInTheDocument();
    });

    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={vi.fn()} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
        expect(screen.getByText(/phone is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();

      // Mock fetch to fail - form should not reach this point if validation works
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Should not reach API'));

      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={vi.fn()} />);

      // Fill in required fields with valid values, except email
      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor');
      await user.type(screen.getByLabelText(/contact phone/i), '555-1234');
      await user.type(screen.getByLabelText(/contact email/i), 'clearly.invalid.email');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // The validation should prevent submission, showing error message
      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-vendor', name: 'Test Vendor' })
      } as Response);

      render(<VendorForm mode="create" onSuccess={onSuccess} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor');
      await user.type(screen.getByLabelText(/contact email/i), 'test@vendor.com');
      await user.type(screen.getByLabelText(/contact phone/i), '555-1234');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/vendors', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }));

        // Parse the body to check content without worrying about field order
        const callArgs = fetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        expect(requestBody).toEqual({
          name: 'Test Vendor',
          contactEmail: 'test@vendor.com',
          contactPhone: '555-1234',
          isActive: true,
          isPrimary: false,
          address: '',
          notes: ''
        });
        expect(onSuccess).toHaveBeenCalledWith({
          id: 'new-vendor',
          name: 'Test Vendor'
        });
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor');
      await user.type(screen.getByLabelText(/contact email/i), 'test@vendor.com');
      await user.type(screen.getByLabelText(/contact phone/i), '555-1234');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(saveButton).toBeDisabled();
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('should handle API errors', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Vendor name already exists' })
      } as Response);

      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={vi.fn()} />);

      await user.type(screen.getByLabelText(/vendor name/i), 'Existing Vendor');
      await user.type(screen.getByLabelText(/contact email/i), 'test@vendor.com');
      await user.type(screen.getByLabelText(/contact phone/i), '555-1234');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/vendor name already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('edit mode', () => {
    const existingVendor = {
      id: 'vendor-123',
      name: 'Existing Vendor',
      contactEmail: 'existing@vendor.com',
      contactPhone: '555-9999',
      isActive: true,
      isPrimary: false,
      address: '123 Main St',
      notes: 'Important vendor'
    };

    it('should populate form with existing vendor data', () => {
      render(
        <VendorForm
          mode="edit"
          vendor={existingVendor}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByDisplayValue('Existing Vendor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing@vendor.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-9999')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Important vendor')).toBeInTheDocument();
    });


    it('should submit only changed fields', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...existingVendor, name: 'Updated Vendor' })
      } as Response);

      render(
        <VendorForm
          mode="edit"
          vendor={existingVendor}
          onSuccess={onSuccess}
          onCancel={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/vendor name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Vendor');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/vendors/vendor-123', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Vendor'
          })
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should show warning when setting as primary vendor', async () => {
      const user = userEvent.setup();

      render(
        <VendorForm
          mode="edit"
          vendor={existingVendor}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const primaryCheckbox = screen.getByLabelText(/primary vendor/i);
      await user.click(primaryCheckbox);

      expect(screen.getByText(/only one vendor can be marked as primary/i)).toBeInTheDocument();
    });
  });

  describe('cancel action', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={onCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should show confirmation if form has unsaved changes', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(<VendorForm mode="create" onSuccess={vi.fn()} onCancel={onCancel} />);

      // Make a change
      await user.type(screen.getByLabelText(/vendor name/i), 'Test');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /discard/i });
      await user.click(confirmButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });
});