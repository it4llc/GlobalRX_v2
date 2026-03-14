// /GlobalRX_v2/src/components/__tests__/address-block-input.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddressBlockInput } from '../address-block-input';

// Mock the fetch API for location data
global.fetch = vi.fn();

describe('AddressBlockInput - Asterisk Display Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      json: async () => [],
    });
  });

  describe('Bug #1: Address Sub-field Required Asterisks', () => {
    it('should FAIL: Shows asterisk on optional street2 field when parent is required', () => {
      // This test proves the bug exists - it will fail until the bug is fixed
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false }, // NOT required
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false },
        postalCode: { label: 'Zip Code', required: true },
      };

      const { container } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={true} // Parent field is required
          countryId="US"
        />
      );

      // Find the Apt/Suite label
      const aptLabel = screen.getByText('Apt/Suite');
      const labelElement = aptLabel.closest('label');

      // Bug: The asterisk should NOT be shown for optional sub-fields
      // Currently it incorrectly shows asterisk because it uses fieldRequired (parent requirement)
      // instead of componentConfig.required (sub-field requirement)
      const asterisk = labelElement?.querySelector('.text-red-500');

      // This assertion will FAIL showing the bug exists
      expect(asterisk).toBeNull();
    });

    it('should FAIL: Shows asterisk on optional county field when parent is required', () => {
      // This test proves the bug exists for county field
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false },
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false }, // NOT required
        postalCode: { label: 'Zip Code', required: true },
      };

      const { container } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={true} // Parent field is required
          countryId="US"
        />
      );

      // Find the County label
      const countyLabel = screen.getByText('County');
      const labelElement = countyLabel.closest('label');

      // Bug: The asterisk should NOT be shown for optional county field
      const asterisk = labelElement?.querySelector('.text-red-500');

      // This assertion will FAIL showing the bug exists
      expect(asterisk).toBeNull();
    });

    it('should show asterisk only when BOTH parent AND sub-field are required', () => {
      // This test verifies the correct AND logic behavior
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false },
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false },
        postalCode: { label: 'Zip Code', required: true },
      };

      const { container } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={true}
          countryId="US"
        />
      );

      // Check each field for correct asterisk display
      // Asterisks should appear ONLY when both parent is required AND sub-field is required
      const fields = [
        { label: 'Street Address', shouldHaveAsterisk: true },  // required sub-field + required parent = asterisk
        { label: 'Apt/Suite', shouldHaveAsterisk: false },      // optional sub-field + required parent = no asterisk
        { label: 'City', shouldHaveAsterisk: true },            // required sub-field + required parent = asterisk
        { label: 'State', shouldHaveAsterisk: true },           // required sub-field + required parent = asterisk
        { label: 'County', shouldHaveAsterisk: false },         // optional sub-field + required parent = no asterisk
        { label: 'Zip Code', shouldHaveAsterisk: true },        // required sub-field + required parent = asterisk
      ];

      fields.forEach(field => {
        const labelText = screen.getByText(field.label);
        const labelElement = labelText.closest('label');
        const asterisk = labelElement?.querySelector('.text-red-500');

        if (field.shouldHaveAsterisk) {
          expect(asterisk).toBeTruthy();
          expect(asterisk?.textContent).toBe('*');
        } else {
          expect(asterisk).toBeNull();
        }
      });
    });

    it('should not show any asterisks when parent field is not required', () => {
      // Even if sub-fields are marked as required, if parent is not required, no asterisks
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false },
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false },
        postalCode: { label: 'Zip Code', required: true },
      };

      const { container } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={false} // Parent field is NOT required
          countryId="US"
        />
      );

      // When parent is not required, no sub-fields should show asterisks
      const allAsterisks = container.querySelectorAll('.text-red-500');

      // Based on correct logic: asterisk only if BOTH parent AND sub-field are required
      expect(allAsterisks.length).toBe(0);
    });
  });

  describe('Correct Behavior Tests', () => {
    it('should handle the asterisk display correctly based on AND logic', () => {
      // Test the correct behavior: asterisk shows only when BOTH parent AND sub-field are required
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false },
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false },
        postalCode: { label: 'Zip Code', required: true },
      };

      // Test case 1: Parent required = true
      const { rerender } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={true}
          countryId="US"
        />
      );

      // Should show asterisks only for required sub-fields when parent is required
      expect(screen.getByText('Street Address').closest('label')?.querySelector('.text-red-500')).toBeTruthy();
      expect(screen.getByText('Apt/Suite').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('City').closest('label')?.querySelector('.text-red-500')).toBeTruthy();
      expect(screen.getByText('State').closest('label')?.querySelector('.text-red-500')).toBeTruthy();
      expect(screen.getByText('County').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('Zip Code').closest('label')?.querySelector('.text-red-500')).toBeTruthy();

      // Test case 2: Parent required = false
      rerender(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={false}
          countryId="US"
        />
      );

      // Should show NO asterisks when parent is not required
      expect(screen.getByText('Street Address').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('Apt/Suite').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('City').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('State').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('County').closest('label')?.querySelector('.text-red-500')).toBeNull();
      expect(screen.getByText('Zip Code').closest('label')?.querySelector('.text-red-500')).toBeNull();
    });

    it('should render all field types correctly', () => {
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: { label: 'Apt/Suite', required: false },
        city: { label: 'City', required: true },
        state: { label: 'State', required: true },
        county: { label: 'County', required: false },
        postalCode: { label: 'Zip Code', required: true },
      };

      render(
        <AddressBlockInput
          config={config}
          value={{
            street1: '123 Main St',
            street2: 'Apt 4B',
            city: 'New York',
            state: 'NY',
            county: 'New York County',
            postalCode: '10001'
          }}
          onChange={() => {}}
          required={true}
          countryId="US"
        />
      );

      // Check that all fields render
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Apt 4B')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10001')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing config gracefully', () => {
      const { container } = render(
        <AddressBlockInput
          config={{}} // Empty config
          value={{}}
          onChange={() => {}}
          required={true}
          countryId="US"
        />
      );

      // Should render without crashing
      expect(container.querySelector('.space-y-4')).toBeInTheDocument();
    });

    it('should handle null/undefined sub-field config', () => {
      const config = {
        street1: { label: 'Street Address', required: true },
        street2: undefined as any, // Undefined config
        city: { label: 'City', required: true },
        state: null as any, // Null config
        county: { label: 'County' } as any, // Missing required property
        postalCode: { label: 'Zip Code', required: true },
      };

      const { container } = render(
        <AddressBlockInput
          config={config}
          value={{}}
          onChange={() => {}}
          required={true}
          countryId="US"
        />
      );

      // Should handle gracefully without crashing
      expect(screen.getByText('Street Address')).toBeInTheDocument();
      expect(screen.getByText('City')).toBeInTheDocument();
      expect(screen.getByText('Zip Code')).toBeInTheDocument();
    });
  });
});