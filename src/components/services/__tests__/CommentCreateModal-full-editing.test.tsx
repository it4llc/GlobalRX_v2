// /GlobalRX_v2/src/components/services/__tests__/CommentCreateModal-full-editing.test.tsx

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

describe('CommentCreateModal - Full Text Editing Feature', () => {
  const mockServiceName = 'Criminal Background Check';
  const mockOnCreate = vi.fn();
  const mockOnCancel = vi.fn();
  const mockDialogRef = { current: { showModal: vi.fn(), close: vi.fn() } };

  const mockTemplates = [
    {
      id: 'template-1',
      shortName: 'DocReq',
      longName: 'Document Request',
      templateText: 'Please provide [document type] by [date] for verification purposes.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: 'template-2',
      shortName: 'ProcUpdate',
      longName: 'Processing Update',
      templateText: 'Your background check is currently being processed.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: 'template-3',
      shortName: 'AddInfo',
      longName: 'Additional Info',
      templateText: 'We need [information] to complete [service type] verification.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('template text as editable starting point', () => {
    it('should show template text in editable textarea when template is selected', async () => {
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

      // Select a template
      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, 'template-1');

      // Template text should appear in an editable textarea, not a preview
      await waitFor(() => {
        const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
        expect(textarea).toBeInTheDocument();
        expect(textarea).not.toBeDisabled();
        expect(textarea).not.toHaveAttribute('readonly');
        expect(textarea.value).toBe('Please provide [document type] by [date] for verification purposes.');
      });
    });

    it('should allow editing any part of the template text', async () => {
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
      await user.selectOptions(templateSelect, 'template-1');

      // Wait for textarea to appear and get it
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // User can modify the text freely
      await user.clear(textarea);
      await user.type(textarea, 'Completely different text with my own [brackets] here');

      expect(textarea.value).toBe('Completely different text with my own [brackets] here');
    });

    it('should keep brackets as regular text without highlighting', async () => {
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

      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      // Should NOT have placeholder highlighting elements
      expect(screen.queryByTestId('placeholder')).not.toBeInTheDocument();
      expect(screen.queryByClassName('bg-yellow-100')).not.toBeInTheDocument();

      // Brackets should be in the textarea as plain text
      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('[document type]');
      expect(textarea.value).toContain('[date]');
    });

    it('should NOT generate placeholder input fields', async () => {
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

      // Should NOT have separate input fields for placeholders
      expect(screen.queryByLabelText(/document type/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/date/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('placeholder-input')).not.toBeInTheDocument();

      // Only the main textarea should exist
      const textboxes = screen.getAllByRole('textbox');
      expect(textboxes).toHaveLength(1); // Only the comment text textarea
    });

    it('should allow user to remove brackets from template text', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // User removes the brackets
      await user.clear(textarea);
      await user.type(textarea, 'Please provide driver license by tomorrow for verification purposes.');

      expect(textarea.value).toBe('Please provide driver license by tomorrow for verification purposes.');
      expect(textarea.value).not.toContain('[');
      expect(textarea.value).not.toContain(']');
    });

    it('should allow user to keep brackets as-is', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // User decides to keep the brackets
      expect(textarea.value).toBe('Please provide [document type] by [date] for verification purposes.');

      // Submit with brackets still in place
      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith(expect.objectContaining({
          finalText: 'Please provide [document type] by [date] for verification purposes.'
        }));
      });
    });

    it('should allow partial editing of template text', async () => {
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
      await user.selectOptions(templateSelect, 'template-3');

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Edit only part of the template
      await user.clear(textarea);
      await user.type(textarea, 'We need SSN to complete [service type] verification.');

      expect(textarea.value).toBe('We need SSN to complete [service type] verification.');
    });
  });

  describe('character counting with editable text', () => {
    it('should update character count as user types in textarea', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Initial character count
      expect(screen.getByText(/57\/1000 characters/i)).toBeInTheDocument();

      // Type additional text
      await user.type(textarea, ' Additional text here.');

      // Count should update
      expect(screen.getByText(/79\/1000 characters/i)).toBeInTheDocument();
    });

    it('should show correct count when user clears and retypes', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Clear and type new text
      await user.clear(textarea);
      expect(screen.getByText(/0\/1000 characters/i)).toBeInTheDocument();

      await user.type(textarea, 'Short text');
      expect(screen.getByText(/10\/1000 characters/i)).toBeInTheDocument();
    });

    it('should count brackets as regular characters', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Template has brackets - they count as characters
      // "Please provide [document type] by [date] for verification purposes." = 69 chars
      expect(screen.getByText(/69\/1000 characters/i)).toBeInTheDocument();

      // Add more brackets
      await user.type(textarea, ' [[[more]]]');
      expect(screen.getByText(/80\/1000 characters/i)).toBeInTheDocument();
    });
  });

  describe('template selection requirement', () => {
    it('should require template selection before entering text', () => {
      render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      // Textarea should be disabled or not visible until template is selected
      const textarea = screen.queryByRole('textbox', { name: /comment text/i });

      if (textarea) {
        expect(textarea).toBeDisabled();
      } else {
        expect(textarea).not.toBeInTheDocument();
      }

      // Add Comment button should be disabled
      const submitButton = screen.getByRole('button', { name: /add comment/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable textarea after template selection', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textarea).not.toBeDisabled();
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('saving edited comments', () => {
    it('should save completely modified text with original templateId', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Totally new text that has nothing to do with the template');

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      expect(internalCheckbox).toBeChecked();

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: 'template-1', // Original template ID is preserved
          finalText: 'Totally new text that has nothing to do with the template',
          isInternalOnly: true
        });
      });
    });

    it('should save text with brackets intact', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.type(textarea, ' [Status: In Progress]');

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: 'template-2',
          finalText: 'Your background check is currently being processed. [Status: In Progress]',
          isInternalOnly: true
        });
      });
    });

    it('should allow saving with external visibility', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Customer visible comment with [details]');

      const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
      await user.click(internalCheckbox);
      expect(internalCheckbox).not.toBeChecked();

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: 'template-1',
          finalText: 'Customer visible comment with [details]',
          isInternalOnly: false
        });
      });
    });
  });

  describe('validation with full text editing', () => {
    it('should show error when text is empty after clearing template', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(screen.getByText(/comment text cannot be empty/i)).toBeInTheDocument();
      });

      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should show error when text is only whitespace', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, '   \n\t   ');

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(screen.getByText(/comment text cannot be empty/i)).toBeInTheDocument();
      });
    });

    it('should show error when text exceeds 1000 characters', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);

      const longText = 'a'.repeat(1001);
      await user.type(textarea, longText);

      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      await waitFor(() => {
        expect(screen.getByText(/cannot exceed 1000 characters/i)).toBeInTheDocument();
      });
    });

    it('should NOT show error for brackets in text', async () => {
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

      // Text already has brackets from template - should not cause error
      await fireEvent.click(screen.getByRole('button', { name: /add comment/i }));

      // Should NOT see placeholder error
      expect(screen.queryByText(/placeholders must be replaced/i)).not.toBeInTheDocument();

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalled();
      });
    });
  });

  describe('resetting form state', () => {
    it('should reset textarea when switching templates', async () => {
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

      // Select first template
      await user.selectOptions(templateSelect, 'template-1');
      let textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('[document type]');

      // Switch to another template
      await user.selectOptions(templateSelect, 'template-2');
      textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Your background check is currently being processed.');
      expect(textarea.value).not.toContain('[document type]');
    });

    it('should reset form when cancelled', async () => {
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

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Modified text');

      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});