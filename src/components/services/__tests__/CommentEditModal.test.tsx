// /GlobalRX_v2/src/components/services/__tests__/CommentEditModal.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentEditModal } from '../CommentEditModal';

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

describe('CommentEditModal', () => {
  const mockComment = {
    id: 'comment-123',
    templateId: 'template-1',
    templateName: 'Document Request',
    finalText: 'Please provide driver license by March 15, 2024',
    isInternalOnly: true,
    createdBy: 'user-1',
    createdByName: 'John Doe',
    createdAt: '2024-03-01T10:00:00Z',
    updatedBy: null,
    updatedByName: null,
    updatedAt: null
  };

  const mockOnUpdate = vi.fn();
  const mockOnCancel = vi.fn();
  const mockDialogRef = { current: { showModal: vi.fn(), close: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('modal display', () => {
    it('should display Edit Comment title', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Edit Comment')).toBeInTheDocument();
    });

    it('should pre-fill current comment text', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textArea.value).toBe('Please provide driver license by March 15, 2024');
    });

    it('should pre-fill current visibility setting', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
      expect(internalCheckbox.checked).toBe(true);
    });

    it('should show template name as read-only', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Template: Document Request')).toBeInTheDocument();
      // Template should not be editable
      expect(screen.queryByLabelText(/template/i)).not.toBeInTheDocument();
    });

    it('should show character count based on current text', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const charCount = mockComment.finalText.length;
      expect(screen.getByText(`${charCount}/1000 characters`)).toBeInTheDocument();
    });

    it('should show edit history if comment was previously edited', () => {
      const editedComment = {
        ...mockComment,
        updatedBy: 'user-2',
        updatedByName: 'Jane Smith',
        updatedAt: '2024-03-02T14:00:00Z'
      };

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={editedComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/previously edited by Jane Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/March 2, 2024/i)).toBeInTheDocument();
    });
  });

  describe('visibility change warning', () => {
    it('should show warning when changing from internal to external', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox); // Uncheck to make external

      expect(screen.getByText(/warning/i)).toBeInTheDocument();
      expect(screen.getByText(/this will make the comment visible to customers/i)).toBeInTheDocument();
    });

    it('should not show warning when changing from external to internal', async () => {
      const user = userEvent.setup();

      const externalComment = {
        ...mockComment,
        isInternalOnly: false
      };

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={externalComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox); // Check to make internal

      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
    });

    it('should allow user to cancel visibility change', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox); // Uncheck to make external

      // Warning appears
      expect(screen.getByText(/warning/i)).toBeInTheDocument();

      // Click "Keep Internal" button
      const keepInternalButton = screen.getByRole('button', { name: /keep internal/i });
      await user.click(keepInternalButton);

      // Checkbox should be re-checked
      expect(internalCheckbox).toBeChecked();
      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
    });

    it('should allow user to proceed with visibility change', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox); // Uncheck to make external

      // Warning appears
      expect(screen.getByText(/warning/i)).toBeInTheDocument();

      // Click "Make External" button
      const makeExternalButton = screen.getByRole('button', { name: /make external/i });
      await user.click(makeExternalButton);

      // Checkbox should remain unchecked
      expect(internalCheckbox).not.toBeChecked();
      expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
    });
  });

  describe('text editing', () => {
    it('should update character count as user types', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);
      await user.type(textArea, 'Updated comment text');

      expect(screen.getByText('20/1000 characters')).toBeInTheDocument();
    });

    it('should show error when text is empty', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByText(/comment text is required/i)).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('should show error when text exceeds 1000 characters', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      const longText = 'a'.repeat(1001);
      await user.clear(textArea);
      await user.type(textArea, longText);

      expect(screen.getByText('1001/1000 characters')).toBeInTheDocument();
      expect(screen.getByText('1001/1000 characters')).toHaveClass('text-red-600');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByText(/cannot exceed 1000 characters/i)).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('should detect and prevent unreplaced placeholders', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);
      await user.type(textArea, 'Please provide [document type] by tomorrow');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByText(/placeholders must be replaced/i)).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call onUpdateComment with only changed fields', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      // Only change the text
      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);
      await user.type(textArea, 'Updated comment text');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('comment-123', {
        finalText: 'Updated comment text',
        isInternalOnly: true
      });
    });

    it('should detect when no changes are made', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByText(/no changes detected/i)).toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('should close modal after successful save', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);
      await user.type(textArea, 'Updated text');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockDialogRef.current.close).toHaveBeenCalled();
    });

    it('should disable form while saving', async () => {
      const user = userEvent.setup();

      // Mock a slow async update function
      const slowUpdate = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={slowUpdate}
          onCancel={mockOnCancel}
        />
      );

      const textArea = screen.getByLabelText(/comment text/i);
      await user.clear(textArea);
      await user.type(textArea, 'Updated text');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(textArea).toBeDisabled();
      expect(screen.getByLabelText(/internal only/i)).toBeDisabled();
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveTextContent(/saving/i);

      await waitFor(() => {
        expect(slowUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('cancellation', () => {
    it('should call onCancel when Cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
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
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      // Make changes
      const textArea = screen.getByLabelText(/comment text/i);
      await user.type(textArea, ' Additional text');

      // Try to cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure you want to discard/i)).toBeInTheDocument();
    });

    it('should close without warning if no changes made', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockDialogRef.current.close).toHaveBeenCalled();
    });

    it('should discard changes when user confirms cancellation', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      // Make changes
      const textArea = screen.getByLabelText(/comment text/i);
      await user.type(textArea, ' Additional text');

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Confirm discard
      const discardButton = screen.getByRole('button', { name: /discard changes/i });
      await user.click(discardButton);

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockDialogRef.current.close).toHaveBeenCalled();
    });

    it('should keep modal open when user cancels discard', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      // Make changes
      const textArea = screen.getByLabelText(/comment text/i);
      await user.type(textArea, ' Additional text');

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Cancel discard
      const keepEditingButton = screen.getByRole('button', { name: /keep editing/i });
      await user.click(keepEditingButton);

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockDialogRef.current.close).not.toHaveBeenCalled();

      // Modal should still be open with changes preserved
      expect(textArea.value).toContain('Additional text');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
      expect(screen.getByLabelText(/comment text/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/comment text/i)).toHaveAttribute('aria-describedby');
    });

    it('should announce visibility change warning to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <CommentEditModal
          ref={mockDialogRef}
          comment={mockComment}
          onUpdateComment={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      await user.click(internalCheckbox);

      const warning = screen.getByRole('alert');
      expect(warning).toHaveTextContent(/this will make the comment visible to customers/i);
    });
  });
});