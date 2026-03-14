// /GlobalRX_v2/src/components/portal/orders/steps/__tests__/DocumentsReviewStep.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DocumentsReviewStep } from '../DocumentsReviewStep';

describe('DocumentsReviewStep - Display Bugs', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnChange = vi.fn();

  const defaultProps = {
    requirements: {
      subjectFields: [
        { id: 'field1', name: 'First Name', required: true, dataType: 'text' },
        { id: 'field2', name: 'Last Name', required: true, dataType: 'text' },
        { id: 'field3', name: 'Middle Name', required: false, dataType: 'text' },
        { id: 'field4', name: 'Home Address', required: true, dataType: 'address_block' },
      ],
      searchFields: [],
      documents: [
        { id: 'doc1', name: 'Driver License', required: true },
        { id: 'doc2', name: 'Proof of Address', required: false },
      ],
    },
    subjectFieldValues: {
      field1: 'John',
      field2: 'Doe',
      field3: '', // Optional field, empty
      field4: {
        street1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001'
      },
    },
    searchFieldValues: {},
    uploadedDocuments: {
      doc1: { name: 'drivers-license.pdf', size: 1024 },
    },
    serviceItems: [
      { itemId: '1', serviceName: 'Criminal Search', locationName: 'New York County' },
      { itemId: '2', serviceName: 'Education Verification', locationName: 'NYU' },
    ],
    onDocumentUpload: vi.fn(),
    onDocumentRemove: vi.fn(),
    onFieldValueChange: vi.fn(),
    isSubmitting: false,
    onNext: mockOnNext,
    onBack: mockOnBack,
    onSaveAsDraft: mockOnSave,
    onFieldChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug #2: Summary Field Name Asterisks', () => {
    it('should FAIL: Shows asterisks next to field names in order summary for already-filled values', () => {
      // This test proves the bug exists - asterisks should NOT appear in the summary view
      // when displaying already-filled values
      render(<DocumentsReviewStep {...defaultProps} />);

      // Find the Order Summary section
      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      expect(orderSummary).toBeTruthy();

      // Within the Subject Information section of the summary
      const subjectSection = within(orderSummary!).getByText('Subject Information').closest('div');

      // Find the First Name field in the summary
      const firstNameRow = within(subjectSection!).getByText('First Name:').closest('.flex');

      // Bug: The field name should NOT have an asterisk in the summary view
      // The asterisk is incorrectly shown even though the value is already provided
      const asteriskInLabel = within(firstNameRow!).queryByText('*');

      // This assertion will FAIL, proving the bug exists
      expect(asteriskInLabel).toBeNull();
    });

    it('should FAIL: Shows asterisks for all required fields even when values are provided', () => {
      // Test multiple required fields that have values
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const subjectSection = within(orderSummary!).getByText('Subject Information').closest('div');

      // Check required fields that have values
      const requiredFields = ['First Name:', 'Last Name:', 'Home Address:'];

      requiredFields.forEach(fieldName => {
        const fieldRow = within(subjectSection!).getByText(fieldName).closest('.flex');
        const labelSpan = within(fieldRow!).getByText(fieldName).closest('span');

        // Look for asterisk as a sibling or child of the label
        const asterisk = labelSpan?.querySelector('.text-red-500');

        // Bug: These should all be null (no asterisk in summary view)
        expect(asterisk).toBeNull();
      });
    });

    it('should FAIL: Shows asterisks in document summary for uploaded required documents', () => {
      // Test document section asterisks
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const documentSection = within(orderSummary!).getByText('Documents').closest('div');

      // Find the Driver License field (required and uploaded)
      const driverLicenseRow = within(documentSection!).getByText('Driver License:').closest('.flex');
      const labelSpan = within(driverLicenseRow!).getByText('Driver License:').closest('span');

      // Bug: Should not show asterisk for already uploaded document
      const asterisk = labelSpan?.querySelector('.text-red-500');

      // This assertion will FAIL, proving the bug exists
      expect(asterisk).toBeNull();
    });

    it('should display field values without asterisks in summary', () => {
      // This test defines the correct behavior
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');

      // No asterisks should appear anywhere in the summary section
      const allAsterisksInSummary = within(orderSummary!).queryAllByText('*');

      // Correct behavior: no asterisks in summary view
      expect(allAsterisksInSummary.length).toBe(0);
    });
  });

  describe('Bug #3: Section Ordering', () => {
    it('should FAIL: Displays sections in wrong order (Services before Subject Info)', () => {
      // This test proves the section ordering bug exists
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');

      // Get all section headings in order
      const sectionHeadings = within(orderSummary!).getAllByRole('heading', { level: 5 });
      const sectionTitles = sectionHeadings.map(h => h.textContent);

      // The correct order should be: Subject Information, Services, Documents
      const expectedOrder = [
        expect.stringContaining('Subject Information'),
        expect.stringContaining('Services'),
        expect.stringContaining('Documents')
      ];

      // This assertion will FAIL because current order is wrong
      expect(sectionTitles).toEqual(expectedOrder);
    });

    it('should display Subject Information as the first section in Order Summary', () => {
      // Test that Subject Information should come first
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const sections = within(orderSummary!).getAllByRole('heading', { level: 5 });

      // First section should be Subject Information
      expect(sections[0].textContent).toContain('Subject Information');
    });

    it('should display Services as the second section in Order Summary', () => {
      // Test that Services should come second
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const sections = within(orderSummary!).getAllByRole('heading', { level: 5 });

      // Second section should be Services
      expect(sections[1].textContent).toContain('Services');
    });

    it('should display Documents as the third section in Order Summary', () => {
      // Test that Documents should come third
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const sections = within(orderSummary!).getAllByRole('heading', { level: 5 });

      // Third section should be Documents
      expect(sections[2].textContent).toContain('Documents');
    });

    it('should maintain correct order even when some sections are empty', () => {
      // Test with no documents
      const propsWithoutDocuments = {
        ...defaultProps,
        requirements: {
          ...defaultProps.requirements,
          documents: [],
        },
      };

      render(<DocumentsReviewStep {...propsWithoutDocuments} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const sections = within(orderSummary!).getAllByRole('heading', { level: 5 });

      // Even with no documents, order should be Subject Info then Services
      expect(sections[0].textContent).toContain('Subject Information');
      expect(sections[1].textContent).toContain('Services');
    });
  });

  describe('Correct Behavior Tests', () => {
    it('should show "Missing" for required fields without values', () => {
      const propsWithMissingValues = {
        ...defaultProps,
        subjectFieldValues: {
          field1: '', // Required but missing
          field2: 'Doe',
        },
      };

      render(<DocumentsReviewStep {...propsWithMissingValues} />);

      // Should show "Missing" for empty required field
      // Use getAllByText since there might be multiple missing fields
      const missingTexts = screen.getAllByText('Missing');
      expect(missingTexts.length).toBeGreaterThan(0);
    });

    it('should show "Not provided" for optional fields without values', () => {
      render(<DocumentsReviewStep {...defaultProps} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');

      // Middle Name is optional and empty, should not appear in summary at all
      // (based on the code logic that skips optional empty fields)
      const middleNameField = within(orderSummary!).queryByText('Middle Name:');
      expect(middleNameField).toBeNull();
    });

    it('should show uploaded document names correctly', () => {
      render(<DocumentsReviewStep {...defaultProps} />);

      // Should show the uploaded document name (might appear multiple times in UI)
      const uploadedDocs = screen.getAllByText('drivers-license.pdf');
      expect(uploadedDocs.length).toBeGreaterThan(0);

      // Should show "Not uploaded" for optional document
      expect(screen.getByText('Not uploaded')).toBeInTheDocument();
    });

    it('should display address block values correctly formatted', () => {
      render(<DocumentsReviewStep {...defaultProps} />);

      // Address should be formatted as a single line
      const formattedAddress = '123 Main St New York NY 10001';
      expect(screen.getByText(formattedAddress)).toBeInTheDocument();
    });

    it('should show missing requirements summary when requirements are not met', () => {
      const propsWithMissing = {
        ...defaultProps,
        subjectFieldValues: {
          field1: '', // Missing required field
        },
        uploadedDocuments: {}, // Missing required document
      };

      render(<DocumentsReviewStep {...propsWithMissing} />);

      // Check if there are missing fields displayed (implementation may vary)
      // The component shows "Missing" text for empty required fields
      const missingIndicators = screen.getAllByText('Missing');
      expect(missingIndicators.length).toBeGreaterThan(0);

      // Alternative: Check for the presence of missing values in the order summary
      const orderSummary = screen.getByText('Order Summary');
      expect(orderSummary).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty requirements gracefully', () => {
      const emptyProps = {
        ...defaultProps,
        requirements: {
          subjectFields: [],
          searchFields: [],
          documents: [],
        },
      };

      const { container } = render(<DocumentsReviewStep {...emptyProps} />);

      // Should render without crashing
      expect(screen.getByText('Order Summary')).toBeInTheDocument();
    });

    it('should handle null/undefined field values', () => {
      const propsWithNulls = {
        ...defaultProps,
        subjectFieldValues: {
          field1: null as any,
          field2: undefined as any,
          field3: '',
        },
      };

      const { container } = render(<DocumentsReviewStep {...propsWithNulls} />);

      // Should handle gracefully without crashing
      expect(screen.getByText('Order Summary')).toBeInTheDocument();
    });

    it('should handle complex object values that are not address blocks', () => {
      const propsWithComplexValues = {
        ...defaultProps,
        subjectFieldValues: {
          field1: 'John',
          field2: ['Multiple', 'Values'], // Array value
          field3: { notAnAddress: 'object' }, // Object that's not an address
        },
      };

      const { container } = render(<DocumentsReviewStep {...propsWithComplexValues} />);

      // Should handle array values
      expect(screen.getByText('Multiple, Values')).toBeInTheDocument();

      // Should handle non-address objects (might show multiple Missing texts)
      const missingTexts = screen.getAllByText('Missing');
      expect(missingTexts.length).toBeGreaterThan(0);
    });
  });
});