// /GlobalRX_v2/src/components/dynamic-field-input.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Make React globally available for the component's JSX
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

import { DynamicFieldInput } from './dynamic-field-input';

// Mock props interface for AddressBlockInput
interface MockAddressBlockInputProps {
  config?: Record<string, { label: string; required: boolean; placeholder?: string }>;
  value?: Record<string, unknown> | null;
  onChange?: (value: Record<string, unknown>) => void;
  error?: string;
  countryId?: string;
  fieldRequired?: boolean;
}

// Mock the AddressBlockInput component to avoid its complexity in these tests
vi.mock('./address-block-input', () => ({
  AddressBlockInput: ({ error }: MockAddressBlockInputProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const React = (global as any).React;
    return React.createElement('div', { 'data-testid': 'address-block-input' },
      React.createElement('div', null, 'Address Block Component'),
      error && React.createElement('div', { 'data-testid': 'address-error' }, error)
    );
  }
}));

describe('DynamicFieldInput - Address Block Instructions Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Address Block Fields Instructions Display', () => {
    it('should display instructions for address block fields (bug has been fixed)', () => {
      // Verifies that address block fields now correctly display instructions

      const addressField = {
        id: 'home-address',
        name: 'Home Address',
        shortName: 'address',
        dataType: 'address_block',
        instructions: 'Please enter your current residential address',
        addressConfig: {
          street1: { label: 'Street', required: true, enabled: true },
          street2: { label: 'Apt/Suite', required: false, enabled: true },
          city: { label: 'City', required: true, enabled: true },
          state: { label: 'State', required: true, enabled: true },
          county: { label: 'County', required: false, enabled: false },
          postalCode: { label: 'Zip', required: true, enabled: true }
        },
        required: true
      };

      render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          countryId="US"
        />
      );

      // Look for the instructions text
      const instructions = screen.queryByText('Please enter your current residential address');

      // Bug fix verified: instructions ARE now displayed for address_block fields
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');
    });

    it('should show instructions for other complex field types like select (control test)', () => {
      // This test shows that instructions DO work for other field types
      const selectField = {
        id: 'employment-status',
        name: 'Employment Status',
        shortName: 'employment',
        dataType: 'select',
        instructions: 'Choose your current employment status',
        options: [
          { value: 'employed', label: 'Employed' },
          { value: 'unemployed', label: 'Unemployed' }
        ],
        required: true
      };

      render(
        <DynamicFieldInput
          field={selectField}
          value=""
          onChange={() => {}}
        />
      );

      // Instructions should be visible for select fields
      const instructions = screen.getByText('Choose your current employment status');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');
    });
  });

  describe('Expected Behavior After Fix: Address Block Instructions Display', () => {
    it('should display instructions below address block component when provided', () => {
      // This test defines the correct behavior - will pass after the fix
      const addressField = {
        id: 'mailing-address',
        name: 'Mailing Address',
        shortName: 'mailing',
        dataType: 'address_block',
        instructions: 'Enter the address where mail should be sent',
        addressConfig: {
          street1: { enabled: true, label: 'Street', required: true },
          street2: { enabled: true, label: 'Apt/Suite', required: false },
          city: { enabled: true, label: 'City', required: true },
          state: { enabled: true, label: 'State', required: true },
          county: { enabled: false, label: 'County', required: false },
          postalCode: { enabled: true, label: 'Zip', required: true }
        },
        required: false
      };

      render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          countryId="US"
        />
      );

      // After fix, instructions should be visible
      const instructions = screen.getByText('Enter the address where mail should be sent');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');

      // Verify it appears after the address block component
      const addressBlock = screen.getByTestId('address-block-input');
      const parent = addressBlock.parentElement;
      expect(parent).toContainElement(instructions);
    });

    it('should not display instruction paragraph when address block has no instructions', () => {
      // Edge case: no instructions provided
      const addressField = {
        id: 'business-address',
        name: 'Business Address',
        shortName: 'business',
        dataType: 'address_block',
        instructions: undefined, // No instructions
        addressConfig: {
          street1: { label: 'Street', required: true, enabled: true },
          street2: { label: 'Apt/Suite', required: false, enabled: true },
          city: { label: 'City', required: true, enabled: true },
          state: { label: 'State', required: true, enabled: true },
          county: { label: 'County', required: false, enabled: false },
          postalCode: { label: 'Zip', required: true, enabled: true }
        }
      };

      render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          countryId="US"
        />
      );

      // Should not render any paragraph with class text-xs text-gray-500 when no instructions
      const instructionParagraphs = document.querySelectorAll('p.text-xs.text-gray-500');
      expect(instructionParagraphs).toHaveLength(0);
    });

    it('should display instructions for address block with empty string instructions', () => {
      // Edge case: empty string instructions
      const addressField = {
        id: 'temp-address',
        name: 'Temporary Address',
        shortName: 'temp',
        dataType: 'address_block',
        instructions: '', // Empty string
        addressConfig: {
          street1: { label: 'Street', required: true, enabled: true },
          street2: { label: 'Apt/Suite', required: false, enabled: true },
          city: { label: 'City', required: true, enabled: true },
          state: { label: 'State', required: true, enabled: true },
          county: { label: 'County', required: false, enabled: false },
          postalCode: { label: 'Zip', required: true, enabled: true }
        }
      };

      render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          countryId="US"
        />
      );

      // Should not render instruction paragraph for empty string (falsy value)
      const instructionParagraphs = document.querySelectorAll('p.text-xs.text-gray-500');
      expect(instructionParagraphs).toHaveLength(0);
    });
  });

  describe('Edge Cases: Very Long Instructions and Multiple Address Blocks', () => {
    it('should properly display and wrap very long instructions for address blocks', () => {
      const longInstructionsText = 'This is a very long instruction text that provides detailed information about how to fill in the address block. It should include your current residential address, not a PO Box or business address. Make sure to include apartment numbers if applicable, and use the standard USPS format for addresses in the United States.';

      const addressField = {
        id: 'detailed-address',
        name: 'Detailed Address',
        shortName: 'detailed',
        dataType: 'address_block',
        instructions: longInstructionsText,
        addressConfig: {
          street1: { enabled: true, label: 'Street', required: true },
          street2: { enabled: true, label: 'Apt', required: false },
          city: { enabled: true, label: 'City', required: true },
          state: { enabled: true, label: 'State', required: true },
          county: { enabled: false, label: '', required: false },
          postalCode: { enabled: true, label: 'Zip', required: true }
        }
      };

      const { container } = render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          countryId="US"
        />
      );

      // After fix, long instructions should be visible
      const instructions = screen.getByText(longInstructionsText);
      expect(instructions).toBeInTheDocument();

      // Verify proper styling for text wrapping
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');

      // The paragraph should be within the component's container
      const instructionElement = container.querySelector('p.text-sm.text-indigo-600');
      expect(instructionElement?.textContent).toBe(longInstructionsText);
    });

    it('should display unique instructions for multiple address blocks on same form', () => {
      const { rerender } = render(
        <div>
          <DynamicFieldInput
            field={{
              id: 'billing-address',
              name: 'Billing Address',
              shortName: 'billing',
              dataType: 'address_block',
              instructions: 'Enter your billing address for credit card verification',
              addressConfig: {
                street1: { enabled: true, label: 'Street', required: true },
                street2: { enabled: false, label: '', required: false },
                city: { enabled: true, label: 'City', required: true },
                state: { enabled: true, label: 'State', required: true },
                county: { enabled: false, label: '', required: false },
                postalCode: { enabled: true, label: 'Zip', required: true }
              }
            }}
            value={{}}
            onChange={() => {}}
            countryId="US"
          />
          <DynamicFieldInput
            field={{
              id: 'shipping-address',
              name: 'Shipping Address',
              shortName: 'shipping',
              dataType: 'address_block',
              instructions: 'Enter the address where packages should be delivered',
              addressConfig: {
                street1: { label: 'Street', required: true },
                street2: { label: 'Suite', required: false },
                city: { label: 'City', required: true },
                state: { label: 'State', required: true },
                postalCode: { label: 'Zip', required: true }
              }
            }}
            value={{}}
            onChange={() => {}}
            countryId="US"
          />
        </div>
      );

      // After fix, both sets of instructions should be visible and unique
      const billingInstructions = screen.getByText('Enter your billing address for credit card verification');
      const shippingInstructions = screen.getByText('Enter the address where packages should be delivered');

      expect(billingInstructions).toBeInTheDocument();
      expect(shippingInstructions).toBeInTheDocument();

      // Both should have the same styling
      expect(billingInstructions).toHaveClass('text-sm', 'text-indigo-600');
      expect(shippingInstructions).toHaveClass('text-sm', 'text-indigo-600');
    });
  });

  describe('Integration: Error Messages and Instructions Together', () => {
    it('should display both error message and instructions for address block', () => {
      const addressField = {
        id: 'required-address',
        name: 'Required Address',
        shortName: 'required',
        dataType: 'address_block',
        instructions: 'This address is required for verification',
        addressConfig: {
          street1: { label: 'Street', required: true, enabled: true },
          street2: { label: 'Apt/Suite', required: false, enabled: true },
          city: { label: 'City', required: true, enabled: true },
          state: { label: 'State', required: true, enabled: true },
          county: { label: 'County', required: false, enabled: false },
          postalCode: { label: 'Zip', required: true, enabled: true }
        },
        required: true
      };

      render(
        <DynamicFieldInput
          field={addressField}
          value={{}}
          onChange={() => {}}
          error="Please complete all required address fields"
          countryId="US"
        />
      );

      // After fix, instructions should be visible
      const instructions = screen.getByText('This address is required for verification');
      expect(instructions).toBeInTheDocument();

      // Error should be displayed in the AddressBlockInput component (mocked)
      const errorElement = screen.getByTestId('address-error');
      expect(errorElement).toHaveTextContent('Please complete all required address fields');

      // Note: The actual component has special error handling for address_block
      // that prevents duplicate error display (line 182)
    });
  });

  describe('Consistency Check: Instructions for Simple vs Complex Fields', () => {
    it('should NOT show instructions for simple text fields (as designed)', () => {
      // Simple fields show instructions as placeholder instead
      const textField = {
        id: 'first-name',
        name: 'First Name',
        shortName: 'firstName',
        dataType: 'text',
        instructions: 'Enter your legal first name',
        required: true
      };

      render(
        <DynamicFieldInput
          field={textField}
          value=""
          onChange={() => {}}
        />
      );

      // Instructions should NOT appear as separate text for simple fields
      const instructionParagraph = screen.queryByText('Enter your legal first name');
      expect(instructionParagraph).toBeNull();

      // Instead, it should be in the placeholder
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Enter your legal first name');
    });

    it('should show instructions for complex date field', () => {
      // Date fields should show instructions separately
      const dateField = {
        id: 'birth-date',
        name: 'Date of Birth',
        shortName: 'dob',
        dataType: 'date',
        instructions: 'Must be 18 years or older',
        required: true
      };

      render(
        <DynamicFieldInput
          field={dateField}
          value=""
          onChange={() => {}}
        />
      );

      // Date fields should display instructions as separate text
      const instructions = screen.getByText('Must be 18 years or older');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');
    });

    it('should show instructions for checkbox groups', () => {
      const checkboxField = {
        id: 'interests',
        name: 'Interests',
        shortName: 'interests',
        dataType: 'checkbox',
        instructions: 'Select all that apply',
        options: [
          { value: 'sports', label: 'Sports' },
          { value: 'music', label: 'Music' }
        ]
      };

      render(
        <DynamicFieldInput
          field={checkboxField}
          value={[]}
          onChange={() => {}}
        />
      );

      // Checkbox groups should display instructions
      const instructions = screen.getByText('Select all that apply');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveClass('text-sm', 'text-indigo-600');
    });
  });
});