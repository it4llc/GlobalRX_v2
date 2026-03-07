// /GlobalRX_v2/src/components/services/__tests__/CommentCreateModal.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentCreateModal } from '../CommentCreateModal';

// Mock dependencies
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
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

describe('CommentCreateModal', () => {
  const mockServiceName = 'Criminal Background Check';
  const mockOnCreate = vi.fn();
  const mockOnCancel = vi.fn();
  const mockDialogRef = { current: { showModal: vi.fn(), close: vi.fn() } };

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Document Request',
      templateText: 'Please provide [document type] by [date] for verification purposes.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: 'template-2',
      name: 'Processing Update',
      templateText: 'Your background check is currently being processed.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: 'template-3',
      name: 'Additional Info Required',
      templateText: 'We need [information] to complete the [service type] verification.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('modal display', () => {
    it('should display modal title with service name', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(`Add Comment to ${mockServiceName}`)).toBeInTheDocument();
    });

    it('should show template dropdown with all available templates', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i) as HTMLSelectElement;
      expect(templateSelect).toBeInTheDocument();

      // Check that all templates are in dropdown
      const options = within(templateSelect).getAllByRole('option');
      expect(options).toHaveLength(mockTemplates.length + 1); // +1 for placeholder option

      expect(within(templateSelect).getByText('Document Request')).toBeInTheDocument();
      expect(within(templateSelect).getByText('Processing Update')).toBeInTheDocument();
      expect(within(templateSelect).getByText('Additional Info Required')).toBeInTheDocument();
    });

    it('should show Internal Only checkbox checked by default', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
      expect(internalCheckbox).toBeChecked();
    });

    it('should show character count as 0/1000 initially', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('0/1000 characters')).toBeInTheDocument();
    });
  });

  describe('template selection and preview', () => {
    it('should show template text when template is selected', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      const preview = screen.getByTestId('template-preview');
      expect(preview).toHaveTextContent('Please provide [document type] by [date] for verification purposes.');
    });

    it('should highlight placeholders in template preview', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      const preview = screen.getByTestId('template-preview');
      const placeholders = within(preview).getAllByTestId('placeholder');

      expect(placeholders).toHaveLength(2);
      expect(placeholders[0]).toHaveTextContent('[document type]');
      expect(placeholders[1]).toHaveTextContent('[date]');
      expect(placeholders[0]).toHaveClass('bg-yellow-100');
    });

    it('should show placeholder form fields for each placeholder', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      expect(screen.getByLabelText(/document type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    });

    it('should show template without placeholders directly in text area', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const textArea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textArea.value).toBe('Your background check is currently being processed.');

      // No placeholder fields should be shown
      expect(screen.queryByTestId('placeholder-form')).not.toBeInTheDocument();
    });
  });

  describe('live preview functionality', () => {
    it('should update preview as user fills placeholder fields', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Select template with placeholders
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      // Fill placeholder fields
      const docTypeField = screen.getByLabelText(/document type/i);
      await user.type(docTypeField, 'driver license');

      const dateField = screen.getByLabelText(/date/i);
      await user.type(dateField, 'March 15, 2024');

      // Check live preview
      const livePreview = screen.getByTestId('live-preview');
      expect(livePreview).toHaveTextContent('Please provide driver license by March 15, 2024 for verification purposes.');
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Select template without placeholders
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const textArea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textArea);
      await user.type(textArea, 'This is a test comment.');

      expect(screen.getByText('23/1000 characters')).toBeInTheDocument();
    });

    it('should show warning when character limit is exceeded', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const textArea = screen.getByLabelText(/comment text/i);
      const longText = 'a'.repeat(1001);
      await user.clear(textArea);
      await user.type(textArea, longText);

      expect(screen.getByText('1001/1000 characters')).toBeInTheDocument();
      expect(screen.getByText('1001/1000 characters')).toHaveClass('text-red-600');
      expect(screen.getByText(/comment exceeds maximum length/i)).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should require template selection', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      expect(screen.getByText(/template is required/i)).toBeInTheDocument();
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should require comment text', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Select template
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      // Clear text
      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);

      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      expect(screen.getByText(/comment text is required/i)).toBeInTheDocument();
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should prevent saving with unreplaced placeholders', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Select template with placeholders
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      // Fill only one placeholder
      const docTypeField = screen.getByLabelText(/document type/i);
      await user.type(docTypeField, 'driver license');

      // Leave date empty

      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      expect(screen.getByText(/all placeholders must be replaced/i)).toBeInTheDocument();
      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should prevent saving when text exceeds 1000 characters', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const textArea = screen.getByLabelText(/comment text/i);
      const longText = 'a'.repeat(1001);
      await user.clear(textArea);
      await user.type(textArea, longText);

      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      expect(screen.getByText(/cannot exceed 1000 characters/i)).toBeInTheDocument();
      expect(mockOnCreate).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call onCreateComment with correct data when form is valid', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Select template and fill placeholders
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      const docTypeField = screen.getByLabelText(/document type/i);
      await user.type(docTypeField, 'driver license');

      const dateField = screen.getByLabelText(/date/i);
      await user.type(dateField, 'March 15, 2024');

      // Uncheck internal only
      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox);

      // Submit
      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      expect(mockOnCreate).toHaveBeenCalledWith({
        templateId: 'template-1',
        finalText: 'Please provide driver license by March 15, 2024 for verification purposes.',
        isInternalOnly: false
      });
    });

    it('should close modal and reset form after successful submission', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Fill and submit form
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      // Check modal closed
      expect(mockDialogRef.current.close).toHaveBeenCalled();

      // Re-open modal to check form is reset
      mockDialogRef.current.showModal();

      const templateSelectAfter = screen.getByLabelText(/template/i) as HTMLSelectElement;
      expect(templateSelectAfter.value).toBe('');

      const textArea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textArea.value).toBe('');

      const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
      expect(internalCheckbox.checked).toBe(true);
    });

    it('should disable form while submitting', async () => {
      const user = userEvent.setup();

      // Mock a slow async create function
      const slowCreate = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={slowCreate}
          onCancel={mockOnCancel}
        />
      );

      // Fill form
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      // Submit
      const saveButton = screen.getByRole('button', { name: /add comment/i });
      await user.click(saveButton);

      // Check form is disabled
      expect(templateSelect).toBeDisabled();
      expect(screen.getByLabelText(/comment text/i)).toBeDisabled();
      expect(screen.getByLabelText(/internal only/i)).toBeDisabled();
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveTextContent(/adding/i);

      await waitFor(() => {
        expect(slowCreate).toHaveBeenCalled();
      });
    });
  });

  describe('cancellation', () => {
    it('should call onCancel when Cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockDialogRef.current.close).toHaveBeenCalled();
    });

    it('should warn about unsaved changes when cancelling', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Make changes
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-2');

      const textArea = screen.getByLabelText(/comment text/i);
      await user.type(textArea, ' Additional text');

      // Try to cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should show warning
      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument();
    });

    it('should close without warning if no changes made', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockDialogRef.current.close).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByLabelText(/template/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/comment text/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/template/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/comment text/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/internal only/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /add comment/i })).toHaveFocus();
    });
  });
});