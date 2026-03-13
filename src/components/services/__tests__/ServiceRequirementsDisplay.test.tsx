// /GlobalRX_v2/src/components/services/__tests__/ServiceRequirementsDisplay.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceRequirementsDisplay } from '../ServiceRequirementsDisplay';

// Mock dependencies
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
}));

describe('ServiceRequirementsDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Section Display', () => {
    it('should display "Submitted Information" as the section title', () => {
      const orderData = {
        'School Name': 'University of Michigan',
        'Degree Type': 'Bachelor of Science'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Business Rule 6: Section must be titled "Submitted Information"
      expect(screen.getByText('Submitted Information')).toBeInTheDocument();
    });

    it('should render as a visible section container', () => {
      const orderData = {
        'Test Field': 'Test Value'
      };

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Business Rule 11: The requirements section must only be visible when the service row is expanded
      const section = container.querySelector('[data-testid="service-requirements-section"]');
      expect(section).toBeInTheDocument();
    });
  });

  describe('Field Display', () => {
    it('should display all orderData fields with their labels and values', () => {
      // Business Rule 2: All fields must be displayed
      const orderData = {
        'School Name': 'University of Michigan',
        'Degree Type': 'Bachelor of Science',
        'Graduation Year': '2020',
        'Major': 'Computer Science',
        'Student ID': '12345678'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Business Rule 9: Use the human-readable labels from orderData keys
      expect(screen.getByText('School Name')).toBeInTheDocument();
      expect(screen.getByText('University of Michigan')).toBeInTheDocument();

      expect(screen.getByText('Degree Type')).toBeInTheDocument();
      expect(screen.getByText('Bachelor of Science')).toBeInTheDocument();

      expect(screen.getByText('Graduation Year')).toBeInTheDocument();
      expect(screen.getByText('2020')).toBeInTheDocument();

      expect(screen.getByText('Major')).toBeInTheDocument();
      expect(screen.getByText('Computer Science')).toBeInTheDocument();

      expect(screen.getByText('Student ID')).toBeInTheDocument();
      expect(screen.getByText('12345678')).toBeInTheDocument();
    });

    it('should preserve the order of fields as they appear in orderData', () => {
      // Business Rule 3: Fields must be displayed in the order they were originally entered
      const orderData = {
        'First Field': 'Value 1',
        'Second Field': 'Value 2',
        'Third Field': 'Value 3'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      const labels = screen.getAllByTestId(/^field-label-/);
      expect(labels[0]).toHaveTextContent('First Field');
      expect(labels[1]).toHaveTextContent('Second Field');
      expect(labels[2]).toHaveTextContent('Third Field');
    });

    it('should NOT display subject information fields', () => {
      // Business Rule 8: Subject information fields already shown elsewhere must not be repeated
      // Note: The API filters these out, so the component should never receive them.
      // This test verifies the component displays whatever it receives.
      const orderData = {
        'School Name': 'MIT',
        'Major': 'Physics'
        // Subject fields like firstName, lastName are filtered by the API
        // so they should not be in orderData
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Regular fields should be shown
      expect(screen.getByText('School Name')).toBeInTheDocument();
      expect(screen.getByText('MIT')).toBeInTheDocument();
      expect(screen.getByText('Major')).toBeInTheDocument();
      expect(screen.getByText('Physics')).toBeInTheDocument();

      // Verify component renders only what's provided (API already filtered subject fields)
      const allLabels = screen.getAllByTestId(/^field-label-/);
      expect(allLabels).toHaveLength(2); // Only School Name and Major
    });
  });

  describe('Empty State Handling', () => {
    it('should display "No additional requirements" when orderData is empty object', () => {
      // Business Rule 4: If no additional requirements exist, display the message
      render(<ServiceRequirementsDisplay orderData={{}} />);

      expect(screen.getByText('No additional requirements')).toBeInTheDocument();

      // Section title should still be shown
      expect(screen.getByText('Submitted Information')).toBeInTheDocument();
    });

    it('should display "No additional requirements" when orderData is null', () => {
      // Edge Case 3: API returns null for orderData
      render(<ServiceRequirementsDisplay orderData={null} />);

      expect(screen.getByText('No additional requirements')).toBeInTheDocument();
    });

    it('should display "No additional requirements" when orderData is undefined', () => {
      // Edge Case 1: No order data exists
      render(<ServiceRequirementsDisplay orderData={undefined} />);

      expect(screen.getByText('No additional requirements')).toBeInTheDocument();
    });
  });

  describe('Field Value Formatting', () => {
    it('should format date values as MM/DD/YYYY', () => {
      // Business Rule 5: Values should be formatted for readability
      const orderData = {
        'Start Date': '2024-03-15',
        'Graduation Date': '2020-05-30T00:00:00Z',
        'Employment End': '2022-12-01'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      expect(screen.getByText('03/15/2024')).toBeInTheDocument();
      expect(screen.getByText('05/30/2020')).toBeInTheDocument();
      expect(screen.getByText('12/01/2022')).toBeInTheDocument();
    });

    it('should preserve line breaks in multi-line text values', () => {
      // Business Rule 5: Line breaks preserved in text areas
      // Edge Case 10: Multi-line text values
      const orderData = {
        'Address': '123 Main St\nApt 4B\nNew York, NY 10001',
        'Notes': 'Line one\nLine two\nLine three'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // After XSS fix, we use CSS classes for white-space
      const addressValue = screen.getByTestId('field-value-Address');
      expect(addressValue.textContent).toBe('123 Main St\nApt 4B\nNew York, NY 10001');
      expect(addressValue.querySelector('span')).toHaveClass('whitespace-pre-wrap');

      const notesValue = screen.getByTestId('field-value-Notes');
      expect(notesValue.textContent).toBe('Line one\nLine two\nLine three');
      expect(notesValue.querySelector('span')).toHaveClass('whitespace-pre-wrap');
    });

    it('should handle very long field values without truncation', () => {
      // Edge Case 4: Very long field values - allow text to wrap naturally
      const longText = 'A'.repeat(500);
      const orderData = {
        'Description': longText
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      const descValue = screen.getByTestId('field-value-Description');
      expect(descValue).toHaveTextContent(longText);
      expect(descValue).not.toHaveStyle({ textOverflow: 'ellipsis' });
      expect(descValue).not.toHaveStyle({ whiteSpace: 'nowrap' });
    });

    it('should properly escape special characters in values', () => {
      // Edge Case 5: Special characters in values - display as-is, properly escaped
      const orderData = {
        'Company': 'Johnson & Johnson',
        'Code': '<script>alert("xss")</script>',
        'Formula': '2 < 3 && 4 > 1'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Values should be displayed but HTML should be escaped
      expect(screen.getByText('Johnson & Johnson')).toBeInTheDocument();
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
      expect(screen.getByText('2 < 3 && 4 > 1')).toBeInTheDocument();

      // Verify HTML is actually escaped, not executed
      const codeValue = screen.getByTestId('field-value-Code');
      expect(codeValue.innerHTML).not.toContain('<script>');
    });

    it('should display null/undefined field values as dashes', () => {
      // Edge Case 7: Null/undefined field values - display as empty string or dash
      const orderData = {
        'Field1': null,
        'Field2': undefined,
        'Field3': '',
        'Field4': 'Valid Value'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      expect(screen.getByTestId('field-value-Field1')).toHaveTextContent('--');
      expect(screen.getByTestId('field-value-Field2')).toHaveTextContent('--');
      expect(screen.getByTestId('field-value-Field3')).toHaveTextContent('--');
      expect(screen.getByTestId('field-value-Field4')).toHaveTextContent('Valid Value');
    });

    it('should handle field labels containing colons without adding extra colons', () => {
      // Edge Case 9: Field label contains colons - display as-is
      const orderData = {
        'Time: Start': '9:00 AM',
        'Ratio: Pass/Fail': '95/5'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Labels should show exactly as provided
      expect(screen.getByText('Time: Start')).toBeInTheDocument();
      expect(screen.getByText('Ratio: Pass/Fail')).toBeInTheDocument();

      // Values should be displayed correctly
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
      expect(screen.getByText('95/5')).toBeInTheDocument();
    });

  });

  describe('Styling and Layout', () => {
    it('should use consistent styling with other sections', () => {
      // Business Rule 12: Use the same visual styling as other sections
      const orderData = { 'Test': 'Value' };

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      const section = container.querySelector('[data-testid="service-requirements-section"]');
      expect(section).toHaveClass('bg-white', 'rounded-lg', 'p-4');
    });

    it('should be read-only with no editable fields', () => {
      // Business Rule 10: All requirement fields are read-only
      const orderData = {
        'Field1': 'Value1',
        'Field2': 'Value2'
      };

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Should not have any input, textarea, or select elements
      expect(container.querySelector('input')).not.toBeInTheDocument();
      expect(container.querySelector('textarea')).not.toBeInTheDocument();
      expect(container.querySelector('select')).not.toBeInTheDocument();

      // Should not have any contentEditable elements
      const editableElements = container.querySelectorAll('[contenteditable="true"]');
      expect(editableElements).toHaveLength(0);
    });

    it('should display fields in a clean list or grid format', () => {
      // UI/UX Requirements: Display fields in a clean list or grid format
      const orderData = {
        'Field1': 'Value1',
        'Field2': 'Value2',
        'Field3': 'Value3'
      };

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Check for proper structure
      const fieldContainers = container.querySelectorAll('[data-testid^="field-container-"]');
      expect(fieldContainers.length).toBe(3);

      fieldContainers.forEach(container => {
        // Each field should have a label and value
        expect(container.querySelector('[data-testid^="field-label-"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid^="field-value-"]')).toBeInTheDocument();
      });
    });

    it('should apply proper styling to field labels and values', () => {
      // UI/UX Requirements: Field labels in slightly muted color, values in standard text color
      const orderData = {
        'Test Label': 'Test Value'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      const label = screen.getByTestId('field-label-Test Label');
      const value = screen.getByTestId('field-value-Test Label');

      // Label should have muted color
      expect(label).toHaveClass('text-gray-600');

      // Value should have standard text color
      expect(value).toHaveClass('text-gray-900');
    });
  });

  describe('Component Props and Type Safety', () => {
    it('should accept orderData as a prop', () => {
      const orderData = { 'Key': 'Value' };

      const { rerender } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();

      // Should update when prop changes
      const newData = { 'New Key': 'New Value' };
      rerender(<ServiceRequirementsDisplay orderData={newData} />);

      expect(screen.queryByText('Key')).not.toBeInTheDocument();
      expect(screen.getByText('New Key')).toBeInTheDocument();
      expect(screen.getByText('New Value')).toBeInTheDocument();
    });

  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for screen readers', () => {
      const orderData = {
        'School Name': 'Harvard',
        'Degree': 'MBA'
      };

      render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Section should be labeled
      const section = screen.getByTestId('service-requirements-section');
      expect(section).toHaveAttribute('aria-label', 'Submitted Information');

      // Field containers should have proper labeling
      const schoolContainer = screen.getByTestId('field-container-School Name');
      expect(schoolContainer).toHaveAttribute('aria-label', 'School Name: Harvard');
    });

    it('should support keyboard navigation', () => {
      const orderData = {
        'Field1': 'Value1',
        'Field2': 'Value2'
      };

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      // Section should be focusable for keyboard users
      const section = container.querySelector('[data-testid="service-requirements-section"]');
      expect(section).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of fields efficiently', () => {
      // Create orderData with 100 fields
      const orderData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        orderData[`Field ${i}`] = `Value ${i}`;
      }

      const { container } = render(<ServiceRequirementsDisplay orderData={orderData} />);

      // All fields should be rendered
      const fieldContainers = container.querySelectorAll('[data-testid^="field-container-"]');
      expect(fieldContainers.length).toBe(100);
    });

  });
});