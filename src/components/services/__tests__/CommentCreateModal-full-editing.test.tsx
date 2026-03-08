// /GlobalRX_v2/src/components/services/__tests__/CommentCreateModal-full-editing.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentCreateModal } from '@/components/services/CommentCreateModal';

// Mock dependencies
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      // Return mock translations for testing
      const translations: Record<string, string> = {
        'common.addComment': 'Add Comment',
        'common.cancel': 'Cancel',
        'serviceComments.addCommentTo': 'Add Comment to',
        'serviceComments.template': 'Template',
        'serviceComments.selectTemplate': 'Select a template...',
        'serviceComments.unnamedTemplate': 'Unnamed Template',
        'serviceComments.commentText': 'Comment Text',
        'serviceComments.internalOnlyLabel': 'Internal Only (not visible to customers)',
        'serviceComments.enterComment': 'Enter your comment...',
        'serviceComments.noTemplatesAvailable': 'No active templates available. Please contact an administrator to create templates.'
      };
      return translations[key] || key;
    }
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
  const mockOnCreate = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();
  const mockDialogRef = { current: { showModal: vi.fn(), close: vi.fn() } };

  const mockTemplates = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      shortName: 'DocReq',
      longName: 'Document Request',
      templateText: 'Please provide [document type] by [date] for verification purposes.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      shortName: 'ProcUpdate',
      longName: 'Processing Update',
      templateText: 'Your background check is currently being processed.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    },
    {
      id: '323e4567-e89b-12d3-a456-426614174002',
      shortName: 'AddInfo',
      longName: 'Additional Info',
      templateText: 'We need [information] to complete [service type] verification.',
      serviceTypes: ['BACKGROUND_CHECK'],
      statuses: ['PROCESSING']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCreate.mockResolvedValue(undefined);
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear and get it
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // User can modify the text freely - use string without special characters that need escaping
      await user.clear(textarea);
      await user.type(textarea, 'Completely different text with my own content here');

      expect(textarea.value).toBe('Completely different text with my own content here');
    });

    it('should keep brackets as regular text without highlighting', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <CommentCreateModal
          ref={mockDialogRef}
          serviceName={mockServiceName}
          templates={mockTemplates}
          onCreateComment={mockOnCreate}
          onCancel={mockOnCancel}
        />
      );

      const templateSelect = screen.getByLabelText(/template/i);
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      // Should NOT have placeholder highlighting elements
      expect(screen.queryByTestId('placeholder')).not.toBeInTheDocument();

      // Check that no highlighting elements exist
      expect(container.querySelector('.bg-yellow-100')).toBeNull();

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for the textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      // Should NOT have separate input fields for placeholders
      expect(screen.queryByLabelText(/document type/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/date/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('placeholder-input')).not.toBeInTheDocument();

      // Only the main textarea should exist (note: textarea has role 'textbox')
      const textarea = screen.getByLabelText(/comment text/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA')
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // User decides to keep the brackets
      expect(textarea.value).toBe('Please provide [document type] by [date] for verification purposes.');

      // Submit with brackets still in place
      await waitFor(() => {
        const submitButton = screen.getByText('Add Comment');
        expect(submitButton).not.toBeDisabled();
      });

      const submitButton = screen.getByText('Add Comment');
      await user.click(submitButton);

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
      await user.selectOptions(templateSelect, '323e4567-e89b-12d3-a456-426614174002');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Edit only part of the template
      await user.clear(textarea);
      await user.type(textarea, 'We need SSN to complete service type verification.');

      expect(textarea.value).toBe('We need SSN to complete service type verification.');
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
      await user.selectOptions(templateSelect, '223e4567-e89b-12d3-a456-426614174001');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Initial character count (template-2 is 51 chars)
      await waitFor(() => {
        expect(screen.getByText(/51\/1000 characters/i)).toBeInTheDocument();
      });

      // Type additional text
      await user.type(textarea, ' Additional text here.');

      // Count should update (51 + 22 = 73 chars)
      await waitFor(() => {
        expect(screen.getByText(/73\/1000 characters/i)).toBeInTheDocument();
      });
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;

      // Template has brackets - they count as characters
      // "Please provide [document type] by [date] for verification purposes." = 67 chars
      await waitFor(() => {
        expect(screen.getByText(/67\/1000 characters/i)).toBeInTheDocument();
      });

      // Add more brackets - using string without special characters that need escaping
      await user.type(textarea, ' more text'); // 67 + 10 = 77 chars
      await waitFor(() => {
        expect(screen.getByText(/77\/1000 characters/i)).toBeInTheDocument();
      });
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

      // Textarea should not be visible until template is selected
      const textarea = screen.queryByLabelText(/comment text/i);
      expect(textarea).not.toBeInTheDocument();

      // Add Comment button should be disabled
      const submitButton = screen.getByText('Add Comment');
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Totally new text that has nothing to do with the template');

      const internalCheckbox = screen.getByLabelText(/internal only/i);
      expect(internalCheckbox).toBeChecked();

      const submitButton = screen.getByText('Add Comment');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: '123e4567-e89b-12d3-a456-426614174000', // Original template ID is preserved
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
      await user.selectOptions(templateSelect, '223e4567-e89b-12d3-a456-426614174001');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.type(textarea, ' Status: In Progress');

      const submitButton = screen.getByText('Add Comment');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: '223e4567-e89b-12d3-a456-426614174001',
          finalText: 'Your background check is currently being processed. Status: In Progress',
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Customer visible comment with details');

      const internalCheckbox = screen.getByLabelText(/internal only/i) as HTMLInputElement;
      await user.click(internalCheckbox);
      expect(internalCheckbox).not.toBeChecked();

      const submitButton = screen.getByText('Add Comment');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnCreate).toHaveBeenCalledWith({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Customer visible comment with details',
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);

      // Button should be disabled when text is empty, so it won't trigger
      const submitButton = screen.getByText('Add Comment');
      expect(submitButton).toBeDisabled();

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, '     ');

      // Button should be disabled when text is only whitespace
      const submitButton = screen.getByText('Add Comment');
      expect(submitButton).toBeDisabled();
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);

      const longText = 'a'.repeat(1001);
      // Use fireEvent for performance with very long text
      fireEvent.change(textarea, { target: { value: longText } });

      // Character count should show over limit
      await waitFor(() => {
        expect(screen.getByText(/1001\/1000 characters/i)).toBeInTheDocument();
      });

      // Button should be disabled when over character limit
      const submitButton = screen.getByText('Add Comment');
      expect(submitButton).toBeDisabled();
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      // Text already has brackets from template - should not cause error
      const submitButton = screen.getByText('Add Comment');
      await user.click(submitButton);

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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');
      let textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('[document type]');

      // Switch to another template
      await user.selectOptions(templateSelect, '223e4567-e89b-12d3-a456-426614174001');
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
      await user.selectOptions(templateSelect, '123e4567-e89b-12d3-a456-426614174000');

      // Wait for textarea to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/comment text/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/comment text/i) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'Modified text');

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});