// /GlobalRX_v2/src/components/candidate/form-engine/WorkflowSectionRenderer.test.tsx
//
// Phase 6 Stage 4 — Pass 2 component tests for WorkflowSectionRenderer.
//
// Coverage:
//   - BR 3:  text type renders sanitized HTML in a scrollable container.
//   - BR 4:  document type with fileUrl renders a download/open link labelled
//            with fileName, fallback to section name when fileName is empty.
//   - BR 5:  acknowledgment label is the hardcoded translated string.
//   - DoD 1: workflow renderer handles both text and document types.
//   - DoD 2: acknowledgment label uses the hardcoded translated string.
//   - Edge case: document type with no fileUrl renders "document unavailable".

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import WorkflowSectionRenderer from './WorkflowSectionRenderer';
import type { WorkflowSectionPayload } from '@/types/candidate-stage4';

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The sanitizer is mocked with an inline implementation that returns its input
// unchanged. This is intentional for the renderer tests: the component's job
// is to put the sanitized output into the content container, not to choose
// what the sanitizer does. The sanitizer's behavior (script stripping, etc.)
// is fully covered by its own Pass 1 unit tests at
// src/lib/candidate/__tests__/sanitizeWorkflowContent.test.ts. Passing the
// input through unmodified lets us assert exactly what the renderer hands to
// dangerouslySetInnerHTML.
//
// Per Mocking Rule M3: this is an inline implementation that READS the
// argument and returns a derivation of it (identity), NOT a scripted
// mockReturnValue.
vi.mock('@/lib/candidate/sanitizeWorkflowContent', () => ({
  sanitizeWorkflowContent: vi.fn((html: string) => html),
}));

const baseTextSection: WorkflowSectionPayload = {
  id: 'ws-text-1',
  name: 'Notice of Processing',
  type: 'text',
  content: '<p>Please review.</p>',
  fileUrl: null,
  fileName: null,
  placement: 'before_services',
  displayOrder: 1,
  isRequired: true,
};

const baseDocumentSection: WorkflowSectionPayload = {
  id: 'ws-doc-1',
  name: 'Authorization to Run Background Check',
  type: 'document',
  content: null,
  fileUrl: '/files/authorization.pdf',
  fileName: 'authorization-form.pdf',
  placement: 'after_services',
  displayOrder: 1,
  isRequired: true,
};

describe('WorkflowSectionRenderer', () => {
  describe('section title', () => {
    it('renders the section name as a heading', () => {
      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'Notice of Processing' }),
      ).toBeInTheDocument();
    });
  });

  describe('text type (BR 3)', () => {
    it('renders the (sanitized) content inside the content container', () => {
      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const content = screen.getByTestId('workflow-section-content');
      // The mocked sanitizer is identity; the rendered HTML matches the input.
      expect(content.innerHTML).toBe('<p>Please review.</p>');
    });

    it('does not render the document download link when type is text', () => {
      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('workflow-section-download')).not.toBeInTheDocument();
    });

    it('renders an empty content container when content is null', () => {
      render(
        <WorkflowSectionRenderer
          section={{ ...baseTextSection, content: null }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const content = screen.getByTestId('workflow-section-content');
      expect(content.innerHTML).toBe('');
    });
  });

  describe('document type (BR 4)', () => {
    it('renders an open/download link labelled with fileName', () => {
      render(
        <WorkflowSectionRenderer
          section={baseDocumentSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const link = screen.getByTestId('workflow-section-download');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/files/authorization.pdf');
      // Link text contains the fileName (the translated open-document key
      // appears as the prefix because the mock is an identity translator).
      expect(link.textContent).toContain('authorization-form.pdf');
    });

    it('falls back to section name when fileName is empty (BR 4 fallback)', () => {
      render(
        <WorkflowSectionRenderer
          section={{ ...baseDocumentSection, fileName: '' }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const link = screen.getByTestId('workflow-section-download');
      expect(link.textContent).toContain('Authorization to Run Background Check');
    });

    it('falls back to section name when fileName is null', () => {
      render(
        <WorkflowSectionRenderer
          section={{ ...baseDocumentSection, fileName: null }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const link = screen.getByTestId('workflow-section-download');
      expect(link.textContent).toContain('Authorization to Run Background Check');
    });

    it('falls back to section name when fileName is whitespace only', () => {
      render(
        <WorkflowSectionRenderer
          section={{ ...baseDocumentSection, fileName: '   ' }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const link = screen.getByTestId('workflow-section-download');
      expect(link.textContent).toContain('Authorization to Run Background Check');
    });

    it('renders an unavailable message when type is document but fileUrl is missing', () => {
      render(
        <WorkflowSectionRenderer
          section={{ ...baseDocumentSection, fileUrl: null }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      expect(
        screen.getByTestId('workflow-section-document-unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('workflow-section-download'),
      ).not.toBeInTheDocument();
    });

    describe('URL scheme allow-list (defense in depth)', () => {
      // Only http://, https://, and root-relative paths (`/...`) are allowed
      // in the document `href`. Anything else falls back to "Document not
      // available" so a misconfigured workflow can never become a click-to-XSS
      // vector via `javascript:` (or `data:`, `vbscript:`, etc.).

      it.each([
        ['/files/authorization.pdf'],
        ['http://example.com/doc.pdf'],
        ['https://example.com/doc.pdf'],
        ['HTTPS://EXAMPLE.COM/DOC.PDF'],
      ])('renders the link for allowed URL %s', (url) => {
        render(
          <WorkflowSectionRenderer
            section={{ ...baseDocumentSection, fileUrl: url }}
            acknowledged={false}
            onAcknowledge={vi.fn()}
          />,
        );

        const link = screen.getByTestId('workflow-section-download');
        expect(link.getAttribute('href')).toBe(url);
        expect(
          screen.queryByTestId('workflow-section-document-unavailable'),
        ).not.toBeInTheDocument();
      });

      it.each([
        ['javascript:alert(1)'],
        ['JAVASCRIPT:alert(1)'],
        ['  javascript:alert(1)  '],
        ['data:text/html,<script>alert(1)</script>'],
        ['vbscript:msgbox(1)'],
        ['file:///etc/passwd'],
        ['ftp://example.com/doc.pdf'],
        ['//evil.example.com/doc.pdf'],
        ['relative/path.pdf'],
        [''],
        ['   '],
      ])('falls back to unavailable for disallowed URL %s', (url) => {
        render(
          <WorkflowSectionRenderer
            section={{ ...baseDocumentSection, fileUrl: url }}
            acknowledged={false}
            onAcknowledge={vi.fn()}
          />,
        );

        expect(
          screen.queryByTestId('workflow-section-download'),
        ).not.toBeInTheDocument();
        expect(
          screen.getByTestId('workflow-section-document-unavailable'),
        ).toBeInTheDocument();
      });
    });

    it('does not render the text content container for document type', () => {
      render(
        <WorkflowSectionRenderer
          section={baseDocumentSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('workflow-section-content')).not.toBeInTheDocument();
    });
  });

  describe('acknowledgment checkbox (BR 5)', () => {
    it('renders an unchecked checkbox by default and the hardcoded translation key as its label', () => {
      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );

      const checkbox = screen.getByTestId('workflow-section-ack') as HTMLInputElement;
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBe(false);

      // BR 5: label uses the hardcoded translation key
      // candidate.workflowSection.acknowledgmentLabel.
      expect(
        screen.getByText('candidate.workflowSection.acknowledgmentLabel'),
      ).toBeInTheDocument();
    });

    it('renders a checked checkbox when acknowledged=true', () => {
      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={true}
          onAcknowledge={vi.fn()}
        />,
      );

      const checkbox = screen.getByTestId('workflow-section-ack') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('invokes onAcknowledge(true) when the checkbox is checked', async () => {
      const user = userEvent.setup();
      const onAcknowledge = vi.fn();

      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={onAcknowledge}
        />,
      );

      await user.click(screen.getByTestId('workflow-section-ack'));

      expect(onAcknowledge).toHaveBeenCalledTimes(1);
      expect(onAcknowledge).toHaveBeenCalledWith(true);
    });

    it('invokes onAcknowledge(false) when an already-checked checkbox is unchecked', async () => {
      const user = userEvent.setup();
      const onAcknowledge = vi.fn();

      render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={true}
          onAcknowledge={onAcknowledge}
        />,
      );

      await user.click(screen.getByTestId('workflow-section-ack'));

      expect(onAcknowledge).toHaveBeenCalledTimes(1);
      expect(onAcknowledge).toHaveBeenCalledWith(false);
    });

    it('renders the checkbox below both text and document content (always present)', () => {
      const { rerender } = render(
        <WorkflowSectionRenderer
          section={baseTextSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );
      expect(screen.getByTestId('workflow-section-ack')).toBeInTheDocument();

      rerender(
        <WorkflowSectionRenderer
          section={baseDocumentSection}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );
      expect(screen.getByTestId('workflow-section-ack')).toBeInTheDocument();

      rerender(
        <WorkflowSectionRenderer
          section={{ ...baseDocumentSection, fileUrl: null }}
          acknowledged={false}
          onAcknowledge={vi.fn()}
        />,
      );
      expect(screen.getByTestId('workflow-section-ack')).toBeInTheDocument();
    });
  });
});
