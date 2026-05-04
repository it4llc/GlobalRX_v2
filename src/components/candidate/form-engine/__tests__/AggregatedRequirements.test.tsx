// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/AggregatedRequirements.test.tsx
// Pass 2 tests for Phase 6 Stage 3: AggregatedRequirements component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AggregatedRequirements } from '../AggregatedRequirements';
import type { AggregatedRequirementItem } from '@/types/candidate-address';

// Mock translation context. The component renders the heading via t() so we
// need readable strings for assertions.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.aggregatedRequirements.heading')
        return 'Based on your address history, we need the following additional information:';
      if (key === 'candidate.aggregatedRequirements.additionalInformation')
        return 'Additional Information';
      if (key === 'candidate.aggregatedRequirements.requiredDocuments')
        return 'Required Documents';
      if (key === 'candidate.aggregatedRequirements.documentUploadPending')
        return 'Upload will be available soon';
      return key;
    }
  })
}));

// Mock DynamicFieldRenderer with an inline implementation that renders a
// recognizable test id including the requirementId. This is acceptable per
// Mocking Rule M2 because the assertions in this file do not depend on the
// actual rendered DOM of DynamicFieldRenderer — they only depend on:
//   (a) that AggregatedRequirements creates one renderer per data field, and
//   (b) the document path (which AggregatedRequirements renders directly,
//       not via DynamicFieldRenderer).
// The inline implementation reads its `requirementId` and `name` props from
// the parent, so a parent that fails to pass them would break the assertions.
vi.mock('../DynamicFieldRenderer', () => ({
  DynamicFieldRenderer: vi.fn(({ requirementId, name, isRequired, value, onChange, onBlur }: {
    requirementId: string;
    name: string;
    isRequired: boolean;
    value: unknown;
    onChange: (v: unknown) => void;
    onBlur?: () => void;
  }) => (
    <div data-testid={`dfr-stub-${requirementId}`}>
      <span data-testid={`dfr-stub-${requirementId}-name`}>{name}</span>
      <span data-testid={`dfr-stub-${requirementId}-required`}>
        {isRequired ? 'required' : 'optional'}
      </span>
      <input
        data-testid={`dfr-stub-${requirementId}-input`}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  ))
}));

describe('AggregatedRequirements', () => {
  const mockOnChange = vi.fn();
  const mockOnBlur = vi.fn();

  const dataField: AggregatedRequirementItem = {
    requirementId: 'req-data-1',
    name: 'Local Reference Number',
    dataType: 'text',
    type: 'field',
    isRequired: true,
    instructions: 'Enter the reference number from your local police record',
    fieldData: null,
    documentData: null,
    serviceTypeOrder: 1,
    displayOrder: 0
  };

  const documentField: AggregatedRequirementItem = {
    requirementId: 'req-doc-1',
    name: 'AFP Form Upload',
    dataType: 'document',
    type: 'document',
    isRequired: true,
    instructions: 'Download and complete the AFP authorization form',
    fieldData: null,
    documentData: null,
    serviceTypeOrder: 1,
    displayOrder: 1
  };

  const optionalDocument: AggregatedRequirementItem = {
    requirementId: 'req-doc-2',
    name: 'Optional Tax Form',
    dataType: 'document',
    type: 'document',
    isRequired: false,
    instructions: null,
    fieldData: null,
    documentData: null,
    serviceTypeOrder: 1,
    displayOrder: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hidden state — no items (DoD #26 hidden when nothing to show)', () => {
    it('renders nothing when items is empty', () => {
      const { container } = render(
        <AggregatedRequirements
          items={[]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      // The component returns null when items.length === 0, so the container
      // should be empty.
      expect(container.firstChild).toBeNull();
    });
  });

  describe('heading and section structure (DoD #27)', () => {
    it('renders the aggregated heading when at least one item exists', () => {
      render(
        <AggregatedRequirements
          items={[dataField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(
        screen.getByText('Based on your address history, we need the following additional information:')
      ).toBeInTheDocument();
    });

    it('renders the "Additional Information" subsection only when data fields exist', () => {
      render(
        <AggregatedRequirements
          items={[dataField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(screen.getByText('Additional Information')).toBeInTheDocument();
      expect(screen.queryByText('Required Documents')).not.toBeInTheDocument();
    });

    it('renders the "Required Documents" subsection only when document items exist', () => {
      render(
        <AggregatedRequirements
          items={[documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(screen.getByText('Required Documents')).toBeInTheDocument();
      expect(screen.queryByText('Additional Information')).not.toBeInTheDocument();
    });

    it('renders both subsections when items contain a mix of data fields and documents', () => {
      render(
        <AggregatedRequirements
          items={[dataField, documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(screen.getByText('Additional Information')).toBeInTheDocument();
      expect(screen.getByText('Required Documents')).toBeInTheDocument();
    });
  });

  describe('document rendering (Stage 3 — name + instructions only, no upload UI)', () => {
    it('renders the document name', () => {
      render(
        <AggregatedRequirements
          items={[documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(screen.getByText('AFP Form Upload')).toBeInTheDocument();
    });

    it('renders the document instructions when provided', () => {
      render(
        <AggregatedRequirements
          items={[documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(
        screen.getByText('Download and complete the AFP authorization form')
      ).toBeInTheDocument();
    });

    it('renders the "upload pending" placeholder text per Stage 3 spec', () => {
      render(
        <AggregatedRequirements
          items={[documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      expect(screen.getByText('Upload will be available soon')).toBeInTheDocument();
    });

    it('does not render an upload button or file input for documents', () => {
      render(
        <AggregatedRequirements
          items={[documentField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      // No <input type="file"> anywhere
      // (testing-library has no role for file input — query by HTML)
      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(0);

      // No "Upload" button (case-insensitive) — Stage 4 work, not Stage 3
      // The placeholder text "Upload will be available soon" is allowed,
      // but no button labelled Upload.
      expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument();
    });

    it('renders the required asterisk on required document items', () => {
      render(
        <AggregatedRequirements
          items={[documentField, optionalDocument]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      const requiredItem = screen.getByTestId(`aggregated-document-${documentField.requirementId}`);
      const optionalItem = screen.getByTestId(`aggregated-document-${optionalDocument.requirementId}`);

      // Required document has the asterisk inside its block.
      expect(requiredItem.querySelector('.required-indicator')).not.toBeNull();
      // Optional document has no asterisk inside its block.
      expect(optionalItem.querySelector('.required-indicator')).toBeNull();
    });
  });

  describe('data field rendering — uses DynamicFieldRenderer', () => {
    it('renders one DynamicFieldRenderer per data field with the correct props', () => {
      const secondField: AggregatedRequirementItem = {
        ...dataField,
        requirementId: 'req-data-2',
        name: 'Second Local Field',
      };

      render(
        <AggregatedRequirements
          items={[dataField, secondField]}
          values={{ 'req-data-1': 'pre-existing value' }}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      // One stub per data field, keyed by requirementId.
      expect(screen.getByTestId('dfr-stub-req-data-1')).toBeInTheDocument();
      expect(screen.getByTestId('dfr-stub-req-data-2')).toBeInTheDocument();

      // The name was passed through to the renderer.
      expect(screen.getByTestId('dfr-stub-req-data-1-name').textContent).toBe('Local Reference Number');
      expect(screen.getByTestId('dfr-stub-req-data-2-name').textContent).toBe('Second Local Field');

      // isRequired was passed through.
      expect(screen.getByTestId('dfr-stub-req-data-1-required').textContent).toBe('required');
    });

    it('passes the stored value from the values map to the matching DynamicFieldRenderer', () => {
      render(
        <AggregatedRequirements
          items={[dataField]}
          values={{ 'req-data-1': 'stored-value' }}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      const input = screen.getByTestId('dfr-stub-req-data-1-input') as HTMLInputElement;
      expect(input.value).toBe('stored-value');
    });

    it('forwards onChange events from the renderer back to the parent (with requirementId)', () => {
      const handleChange = vi.fn();

      render(
        <AggregatedRequirements
          items={[dataField]}
          values={{}}
          onAggregatedFieldChange={handleChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      const input = screen.getByTestId('dfr-stub-req-data-1-input');
      fireEvent.change(input, { target: { value: 'new-value' } });

      expect(handleChange).toHaveBeenCalledWith('req-data-1', 'new-value');
    });

    it('forwards onBlur events to the parent', () => {
      const handleBlur = vi.fn();

      render(
        <AggregatedRequirements
          items={[dataField]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={handleBlur}
        />
      );

      const input = screen.getByTestId('dfr-stub-req-data-1-input');
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('split logic — type field vs type document', () => {
    it('splits items by their type field, not by dataType', () => {
      // Two items both have dataType='document', but only one is type='document'.
      // The other has type='field' (e.g., a free-text field that happens to use
      // the document data type for some reason).
      const documentByType: AggregatedRequirementItem = {
        ...documentField,
        requirementId: 'doc-type',
        name: 'Doc by type',
        type: 'document',
      };
      const fieldByType: AggregatedRequirementItem = {
        ...documentField,
        requirementId: 'field-type',
        name: 'Field by type',
        type: 'field',
      };

      render(
        <AggregatedRequirements
          items={[documentByType, fieldByType]}
          values={{}}
          onAggregatedFieldChange={mockOnChange}
          onAggregatedFieldBlur={mockOnBlur}
        />
      );

      // The type='field' item goes to Additional Information (DynamicFieldRenderer stub).
      expect(screen.getByTestId('dfr-stub-field-type')).toBeInTheDocument();
      // The type='document' item goes to Required Documents (li).
      expect(screen.getByTestId('aggregated-document-doc-type')).toBeInTheDocument();
    });
  });
});
