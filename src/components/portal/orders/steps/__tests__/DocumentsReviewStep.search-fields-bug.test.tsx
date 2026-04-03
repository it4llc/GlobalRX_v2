// /GlobalRX_v2/src/components/portal/orders/steps/__tests__/DocumentsReviewStep.search-fields-bug.test.tsx
// REGRESSION TEST: proves bug fix for search fields displaying for all services
// Bug: ALL search fields show under EVERY service instead of being filtered by serviceId/locationId
// This test file MUST remain in the codebase permanently to prevent regression

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DocumentsReviewStep } from '../DocumentsReviewStep';

// Mock translation context
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'documents_review_title': 'Documents & Review',
        'documents_review_description': 'Upload any required documents and review your order before submitting.',
        'required_documents_notice': 'Required documents must be uploaded before submission',
        'required_documents_heading': 'Required Documents',
        'choose_file': 'Choose File',
        'change_file': 'Change File',
        'order_summary': 'Order Summary',
        'subject_information': 'Subject Information',
        'search_fields': 'Search Fields',
        'missing': 'Missing',
        'not_provided': 'Not provided',
        'missing_required_info': `⚠️ Missing Required Information (${params?.count || 0} items)`,
        'services_count': `Services (${params?.count || 0})`,
        'services_ordered_count': `Services Ordered (${params?.count || 0})`,
        'search': 'Search',
        'documents': 'Documents',
        'missing_required': 'Missing (Required)',
        'not_uploaded': 'Not uploaded',
      };
      return translations[key] || key;
    },
  }),
}));

describe('DocumentsReviewStep - Search Fields Display Bug', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('REGRESSION TEST: Search fields filtered by service', () => {
    it('should display search fields ONLY under their corresponding service (not all fields for all services)', () => {
      // This is THE CRITICAL REGRESSION TEST
      // It will FAIL before the fix (proving the bug exists)
      // It will PASS after the fix (proving the bug is resolved)

      const props = {
        requirements: {
          subjectFields: [],
          // Each search field has serviceId and locationId to indicate which service it belongs to
          searchFields: [
            {
              id: 'school-name-field',
              name: 'School Name',
              required: true,
              serviceId: 'edu-verify-service',
              locationId: 'nyu-location'
            },
            {
              id: 'degree-field',
              name: 'Degree Type',
              required: false,
              serviceId: 'edu-verify-service',
              locationId: 'nyu-location'
            },
            {
              id: 'county-field',
              name: 'County',
              required: true,
              serviceId: 'criminal-service',
              locationId: 'ny-county-location'
            },
            {
              id: 'case-number-field',
              name: 'Case Number',
              required: false,
              serviceId: 'criminal-service',
              locationId: 'ny-county-location'
            },
            {
              id: 'employer-name-field',
              name: 'Employer Name',
              required: true,
              serviceId: 'employment-service',
              locationId: 'google-location'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': {
            'school-name-field': 'New York University',
            'degree-field': 'Bachelor of Science',
          },
          'item-2': {
            'county-field': 'New York County',
            'case-number-field': '',
          },
          'item-3': {
            'employer-name-field': 'Google LLC',
          },
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Education Verification',
            locationName: 'NYU',
            serviceId: 'edu-verify-service',
            locationId: 'nyu-location'
          },
          {
            itemId: 'item-2',
            serviceName: 'Criminal Search',
            locationName: 'New York County',
            serviceId: 'criminal-service',
            locationId: 'ny-county-location'
          },
          {
            itemId: 'item-3',
            serviceName: 'Employment Verification',
            locationName: 'Google',
            serviceId: 'employment-service',
            locationId: 'google-location'
          },
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

      render(<DocumentsReviewStep {...props} />);

      // Find the Order Summary section
      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      expect(orderSummary).toBeTruthy();

      // Find the Search Fields section within the Order Summary
      const searchFieldsSection = within(orderSummary!).getByText('Search Fields:').closest('div');
      expect(searchFieldsSection).toBeTruthy();

      // Get all service sections within the search fields
      const educationSection = within(searchFieldsSection!).getByText('Education Verification: NYU').closest('div');
      const criminalSection = within(searchFieldsSection!).getByText('Criminal Search: New York County').closest('div');
      const employmentSection = within(searchFieldsSection!).getByText('Employment Verification: Google').closest('div');

      // CRITICAL ASSERTIONS: Each service should ONLY show its own search fields

      // Education Verification should ONLY show School Name and Degree Type
      expect(within(educationSection!).queryByText('School Name:')).toBeTruthy();
      expect(within(educationSection!).queryByText('New York University')).toBeTruthy();
      expect(within(educationSection!).queryByText('Degree Type:')).toBeTruthy();
      expect(within(educationSection!).queryByText('Bachelor of Science')).toBeTruthy();
      // Should NOT show fields from other services
      expect(within(educationSection!).queryByText('County:')).toBeFalsy();
      expect(within(educationSection!).queryByText('Case Number:')).toBeFalsy();
      expect(within(educationSection!).queryByText('Employer Name:')).toBeFalsy();

      // Criminal Search should ONLY show County and Case Number
      expect(within(criminalSection!).queryByText('County:')).toBeTruthy();
      expect(within(criminalSection!).queryByText('New York County')).toBeTruthy();
      expect(within(criminalSection!).queryByText('Case Number:')).toBeTruthy();
      // Should NOT show fields from other services
      expect(within(criminalSection!).queryByText('School Name:')).toBeFalsy();
      expect(within(criminalSection!).queryByText('Degree Type:')).toBeFalsy();
      expect(within(criminalSection!).queryByText('Employer Name:')).toBeFalsy();

      // Employment Verification should ONLY show Employer Name
      expect(within(employmentSection!).queryByText('Employer Name:')).toBeTruthy();
      expect(within(employmentSection!).queryByText('Google LLC')).toBeTruthy();
      // Should NOT show fields from other services
      expect(within(employmentSection!).queryByText('School Name:')).toBeFalsy();
      expect(within(employmentSection!).queryByText('County:')).toBeFalsy();
      expect(within(employmentSection!).queryByText('Case Number:')).toBeFalsy();
    });
  });

  describe('Happy path: correct search fields behavior', () => {
    it('should display search fields grouped by their respective services', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [
            {
              id: 'field-1',
              name: 'Field A',
              required: true,
              serviceId: 'service-1',
              locationId: 'location-1'
            },
            {
              id: 'field-2',
              name: 'Field B',
              required: false,
              serviceId: 'service-2',
              locationId: 'location-2'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': {
            'field-1': 'Value A',
          },
          'item-2': {
            'field-2': 'Value B',
          },
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Service One',
            locationName: 'Location One',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
          {
            itemId: 'item-2',
            serviceName: 'Service Two',
            locationName: 'Location Two',
            serviceId: 'service-2',
            locationId: 'location-2'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      render(<DocumentsReviewStep {...props} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const searchFieldsSection = within(orderSummary!).getByText('Search Fields:').closest('div');

      // Service One section should exist and contain Field A
      const serviceOneSection = within(searchFieldsSection!).getByText('Service One: Location One').closest('div');
      expect(within(serviceOneSection!).queryByText('Field A:')).toBeTruthy();
      expect(within(serviceOneSection!).queryByText('Value A')).toBeTruthy();

      // Service Two section should exist and contain Field B
      const serviceTwoSection = within(searchFieldsSection!).getByText('Service Two: Location Two').closest('div');
      expect(within(serviceTwoSection!).queryByText('Field B:')).toBeTruthy();
      expect(within(serviceTwoSection!).queryByText('Value B')).toBeTruthy();
    });

    it('should show "Missing" for required fields without values', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [
            {
              id: 'required-field',
              name: 'Required Field',
              required: true,
              serviceId: 'service-1',
              locationId: 'location-1'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': {
            'required-field': '', // Empty required field
          },
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Test Service',
            locationName: 'Test Location',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      render(<DocumentsReviewStep {...props} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');

      // Should show the field name and "Missing" in red for required empty field
      expect(within(orderSummary!).queryByText('Required Field:')).toBeTruthy();
      expect(within(orderSummary!).queryByText('Missing')).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty search fields array gracefully', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [], // Empty array
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {},
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Test Service',
            locationName: 'Test Location',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      // Should not throw an error
      expect(() => render(<DocumentsReviewStep {...props} />)).not.toThrow();

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      // Search Fields section should not be rendered when array is empty
      expect(within(orderSummary!).queryByText('Search Fields:')).toBeFalsy();
    });

    it('should handle service with no matching search fields', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [
            {
              id: 'field-1',
              name: 'Field One',
              required: true,
              serviceId: 'service-1',
              locationId: 'location-1'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': {
            'field-1': 'Value One',
          },
          'item-2': {}, // Service 2 has no search field values
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Service With Fields',
            locationName: 'Location One',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
          {
            itemId: 'item-2',
            serviceName: 'Service Without Fields',
            locationName: 'Location Two',
            serviceId: 'service-2', // Different service ID, no matching search fields
            locationId: 'location-2'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      render(<DocumentsReviewStep {...props} />);

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const searchFieldsSection = within(orderSummary!).getByText('Search Fields:').closest('div');

      // Service With Fields should show its field
      const serviceWithFieldsSection = within(searchFieldsSection!).getByText('Service With Fields: Location One').closest('div');
      expect(within(serviceWithFieldsSection!).queryByText('Field One:')).toBeTruthy();
      expect(within(serviceWithFieldsSection!).queryByText('Value One')).toBeTruthy();

      // Service Without Fields should still show its header but no fields under it
      const serviceWithoutFieldsSection = within(searchFieldsSection!).getByText('Service Without Fields: Location Two').closest('div');
      expect(serviceWithoutFieldsSection).toBeTruthy();
      // Should not show any fields from other services
      expect(within(serviceWithoutFieldsSection!).queryByText('Field One:')).toBeFalsy();
    });

    it('should handle search field without serviceId/locationId gracefully (legacy data)', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [
            {
              id: 'legacy-field',
              name: 'Legacy Field',
              required: false,
              // No serviceId or locationId (legacy data)
            },
            {
              id: 'modern-field',
              name: 'Modern Field',
              required: true,
              serviceId: 'service-1',
              locationId: 'location-1'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': {
            'legacy-field': 'Legacy Value',
            'modern-field': 'Modern Value',
          },
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Test Service',
            locationName: 'Test Location',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      // Should not throw an error
      expect(() => render(<DocumentsReviewStep {...props} />)).not.toThrow();

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');
      const searchFieldsSection = within(orderSummary!).getByText('Search Fields:').closest('div');
      const serviceSection = within(searchFieldsSection!).getByText('Test Service: Test Location').closest('div');

      // Modern field with serviceId/locationId should be displayed
      expect(within(serviceSection!).queryByText('Modern Field:')).toBeTruthy();
      expect(within(serviceSection!).queryByText('Modern Value')).toBeTruthy();

      // Legacy field without serviceId/locationId should NOT be displayed under the service
      // (since it can't be matched to any specific service)
      expect(within(serviceSection!).queryByText('Legacy Field:')).toBeFalsy();
    });

    it('should handle null or undefined searchFieldValues gracefully', () => {
      const props = {
        requirements: {
          subjectFields: [],
          searchFields: [
            {
              id: 'field-1',
              name: 'Test Field',
              required: true,
              serviceId: 'service-1',
              locationId: 'location-1'
            },
          ],
          documents: [],
        },
        subjectFieldValues: {},
        searchFieldValues: {
          'item-1': null as Record<string, unknown> | null, // Null values for a service
        },
        uploadedDocuments: {},
        serviceItems: [
          {
            itemId: 'item-1',
            serviceName: 'Test Service',
            locationName: 'Test Location',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
        ],
        onDocumentUpload: vi.fn(),
        onDocumentRemove: vi.fn(),
        onFieldValueChange: vi.fn(),
        isSubmitting: false,
        onNext: vi.fn(),
        onBack: vi.fn(),
        onSaveAsDraft: vi.fn(),
        onFieldChange: vi.fn(),
      };

      // Should not throw an error
      expect(() => render(<DocumentsReviewStep {...props} />)).not.toThrow();

      const orderSummary = screen.getByText('Order Summary').closest('.bg-gray-50');

      // Should still render the search fields section and handle null gracefully
      expect(within(orderSummary!).queryByText('Search Fields:')).toBeTruthy();
    });
  });
});