// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/AddressBlockInput.test.tsx
// Pass 2 tests for Phase 6 Stage 3: AddressBlockInput component

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressBlockInput } from '../AddressBlockInput';
import type {
  AddressBlockValue,
  AddressConfig,
  SubdivisionItem,
} from '@/types/candidate-address';

// Mock the translation context. The fallback returns the key, except for a few
// well-known keys that the component expects to receive translated strings for
// (e.g. the "Select state/province" placeholder).
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Return readable strings only for keys the component renders user-facing.
      // For unknown keys we return the key itself so tests can still match against it.
      if (key === 'candidate.addressHistory.fromDate') return 'From';
      if (key === 'candidate.addressHistory.toDate') return 'To';
      if (key === 'candidate.addressHistory.currentAddress') return 'Current address';
      if (key === 'candidate.addressBlock.selectState') return 'Select state/province';
      if (key === 'candidate.addressBlock.selectCounty') return 'Select county';
      return key;
    }
  })
}));

// Mock the client logger so error paths don't write to stderr during tests.
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }
}));

describe('AddressBlockInput', () => {
  const requirementId = 'req-001';

  const fullConfig: AddressConfig = {
    street1: { enabled: true, label: 'Street Address', required: true },
    street2: { enabled: true, label: 'Apt/Suite', required: false },
    city: { enabled: true, label: 'City', required: true },
    state: { enabled: true, label: 'State/Province', required: true },
    county: { enabled: false, label: 'County', required: false },
    postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
  };

  const onChange = vi.fn();
  const onBlur = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addressConfig — enabled / required pieces', () => {
    it('renders only enabled pieces from the supplied addressConfig', () => {
      const onlyStreet1AndCity: AddressConfig = {
        street1: { enabled: true, label: 'Street', required: true },
        street2: { enabled: false, label: 'Apt', required: false },
        city: { enabled: true, label: 'City', required: true },
        state: { enabled: false, label: 'State', required: false },
        county: { enabled: false, label: 'County', required: false },
        postalCode: { enabled: false, label: 'Postal', required: false },
      };

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={onlyStreet1AndCity}
          countryId={null}
          value={{}}
          onChange={onChange}
          // No fetchSubdivisions / no token: the component will not attempt
          // a fetch because countryId is null.
        />
      );

      expect(screen.getByTestId(`address-${requirementId}-street1`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-city`)).toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-street2`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-state`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-postalCode`)).not.toBeInTheDocument();
    });

    it('renders the supplied label per piece (overriding default labels)', () => {
      const customLabelConfig: AddressConfig = {
        street1: { enabled: true, label: 'Calle', required: true },
        street2: { enabled: false, label: '', required: false },
        city: { enabled: true, label: 'Ciudad', required: true },
        state: { enabled: false, label: '', required: false },
        county: { enabled: false, label: '', required: false },
        postalCode: { enabled: false, label: '', required: false },
      };

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={customLabelConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
        />
      );

      expect(screen.getByText('Calle')).toBeInTheDocument();
      expect(screen.getByText('Ciudad')).toBeInTheDocument();
    });

    it('renders the required asterisk on required pieces', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
          isRequired={true}
        />
      );

      // Street1, city, state, postalCode are all required in fullConfig.
      const asterisks = screen.getAllByText('*');
      // At minimum one asterisk per required piece (4 in fullConfig — county
      // disabled, street2 not required).
      expect(asterisks.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('default addressConfig fallback (DoD #4)', () => {
    it('applies the default piece set when no addressConfig is supplied', () => {
      // Per spec: street1 (req), street2 (opt), city (req), state (req),
      // postalCode (req), county (disabled).
      render(
        <AddressBlockInput
          requirementId={requirementId}
          // addressConfig deliberately omitted
          countryId={null}
          value={{}}
          onChange={onChange}
        />
      );

      // Enabled pieces in the default set are rendered:
      expect(screen.getByTestId(`address-${requirementId}-street1`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-street2`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-city`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-state`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-postalCode`)).toBeInTheDocument();
      // County is disabled by default — must not render:
      expect(screen.queryByTestId(`address-${requirementId}-county`)).not.toBeInTheDocument();
    });

    it('also applies the default piece set when addressConfig is null', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={null}
          countryId={null}
          value={{}}
          onChange={onChange}
        />
      );

      expect(screen.getByTestId(`address-${requirementId}-street1`)).toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-county`)).not.toBeInTheDocument();
    });
  });

  describe('showDates flag (Address History date fields)', () => {
    it('renders fromDate / toDate / isCurrent when showDates is true', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
          showDates={true}
        />
      );

      expect(screen.getByTestId(`address-${requirementId}-fromDate`)).toBeInTheDocument();
      expect(screen.getByTestId(`address-${requirementId}-toDate`)).toBeInTheDocument();
      // The "Current address" checkbox is identified by its rendered label.
      expect(screen.getByText('Current address')).toBeInTheDocument();
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('To')).toBeInTheDocument();
    });

    it('does NOT render date fields when showDates is false', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
          showDates={false}
        />
      );

      expect(screen.queryByTestId(`address-${requirementId}-fromDate`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-toDate`)).not.toBeInTheDocument();
      expect(screen.queryByText('Current address')).not.toBeInTheDocument();
    });

    it('does NOT render date fields when showDates is omitted (default false)', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
        />
      );

      expect(screen.queryByTestId(`address-${requirementId}-fromDate`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`address-${requirementId}-toDate`)).not.toBeInTheDocument();
    });

    it('hides the "To" date field when isCurrent is checked', async () => {
      const Wrapper = () => {
        const [val, setVal] = React.useState<AddressBlockValue>({ isCurrent: false });
        return (
          <AddressBlockInput
            requirementId={requirementId}
            addressConfig={fullConfig}
            countryId={null}
            value={val}
            onChange={setVal}
            showDates={true}
          />
        );
      };
      render(<Wrapper />);

      // Initially the To field is visible.
      expect(screen.getByTestId(`address-${requirementId}-toDate`)).toBeInTheDocument();

      // Click the Current address checkbox.
      const checkbox = screen.getByLabelText('Current address');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.queryByTestId(`address-${requirementId}-toDate`)).not.toBeInTheDocument();
      });
    });
  });

  describe('state subdivisions — dropdown vs free-text fallback', () => {
    it('renders state as a dropdown when fetchSubdivisions returns entries for the country', async () => {
      const usSubdivisions: SubdivisionItem[] = [
        { id: 'va-uuid', name: 'Virginia', code2: 'VA' },
        { id: 'ny-uuid', name: 'New York', code2: 'NY' },
      ];

      // Inline-implementation fetcher (per Mocking Rule M3) — reads the
      // parentId argument and returns subdivisions only for the country we
      // expect. Any other parentId returns an empty list.
      const fetchSubdivisions = vi.fn(async (parentId: string) => {
        if (parentId === 'country-us') return usSubdivisions;
        return [];
      });

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId="country-us"
          value={{}}
          onChange={onChange}
          fetchSubdivisions={fetchSubdivisions}
        />
      );

      await waitFor(() => {
        expect(fetchSubdivisions).toHaveBeenCalledWith('country-us');
      });

      // Once subdivisions arrive, the state piece becomes a Radix Select trigger.
      await waitFor(() => {
        expect(screen.getByTestId(`address-${requirementId}-state`)).toBeInTheDocument();
      });
      // The trigger should display the placeholder we mapped to "Select state/province".
      expect(screen.getByText('Select state/province')).toBeInTheDocument();
    });

    it('renders state as a free-text input when fetchSubdivisions returns an empty list', async () => {
      const fetchSubdivisions = vi.fn(async (_parentId: string) => []);

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId="country-no-subdivisions"
          value={{}}
          onChange={onChange}
          fetchSubdivisions={fetchSubdivisions}
        />
      );

      await waitFor(() => {
        expect(fetchSubdivisions).toHaveBeenCalledWith('country-no-subdivisions');
      });

      // The state element exists and is a plain text input (HTMLInputElement),
      // not a select trigger.
      const stateField = await screen.findByTestId(`address-${requirementId}-state`);
      // A free-text input is rendered as <input type="text">.
      expect(stateField.tagName).toBe('INPUT');
    });

    it('renders state as free-text when no countryId is selected (no fetch attempted)', () => {
      const fetchSubdivisions = vi.fn(async (_parentId: string) => []);

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
          fetchSubdivisions={fetchSubdivisions}
        />
      );

      // No fetch should have been attempted because countryId is null.
      expect(fetchSubdivisions).not.toHaveBeenCalled();

      const stateField = screen.getByTestId(`address-${requirementId}-state`);
      expect(stateField.tagName).toBe('INPUT');
    });
  });

  describe('value storage and onChange propagation', () => {
    it('emits the typed string when the candidate types into a free-text state piece', async () => {
      // Free-text state because no subdivisions exist for this country.
      const fetchSubdivisions = vi.fn(async (_parentId: string) => []);
      const handleChange = vi.fn();

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId="country-no-subdivisions"
          value={{}}
          onChange={handleChange}
          fetchSubdivisions={fetchSubdivisions}
        />
      );

      const stateField = await screen.findByTestId(`address-${requirementId}-state`) as HTMLInputElement;
      // Type a single character. The component is controlled, so each keystroke
      // produces an onChange call with the merged value object.
      fireEvent.change(stateField, { target: { value: 'Alberta' } });

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'Alberta' })
      );
    });

    it('emits the merged value object when a piece changes (not just the piece value)', () => {
      const handleChange = vi.fn();

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{ city: 'existing-city' }}
          onChange={handleChange}
        />
      );

      const street1Field = screen.getByTestId(`address-${requirementId}-street1`) as HTMLInputElement;
      fireEvent.change(street1Field, { target: { value: '123 Main St' } });

      // The component must merge the new piece into the existing value, not
      // replace it (city should still be present in the next value).
      expect(handleChange).toHaveBeenCalledWith({
        city: 'existing-city',
        street1: '123 Main St',
      });
    });

    it('triggers onBlur when the candidate moves out of a piece', () => {
      const handleBlur = vi.fn();

      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{}}
          onChange={onChange}
          onBlur={handleBlur}
        />
      );

      const street1Field = screen.getByTestId(`address-${requirementId}-street1`);
      fireEvent.blur(street1Field);

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('stale-response handling for state subdivisions', () => {
    it('discards a stale subdivisions response after the country changes', async () => {
      // We simulate a slow response for the first country and a fast empty
      // response for the second country. The component must NOT show the
      // stale dropdown after the countryId switches.
      let resolveFirst: ((subs: SubdivisionItem[]) => void) | undefined;
      const firstPromise = new Promise<SubdivisionItem[]>((resolve) => {
        resolveFirst = resolve;
      });

      const fetchSubdivisions = vi.fn(async (parentId: string) => {
        if (parentId === 'country-slow') {
          return firstPromise;
        }
        // Second country: immediately empty.
        return [];
      });

      const Wrapper = ({ countryId }: { countryId: string }) => (
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={countryId}
          value={{}}
          onChange={onChange}
          fetchSubdivisions={fetchSubdivisions}
        />
      );

      const { rerender } = render(<Wrapper countryId="country-slow" />);

      // Wait until the slow request was fired.
      await waitFor(() => {
        expect(fetchSubdivisions).toHaveBeenCalledWith('country-slow');
      });

      // Change to a different country before the slow response arrives.
      rerender(<Wrapper countryId="country-fast" />);

      // The fast request should be in-flight or done.
      await waitFor(() => {
        expect(fetchSubdivisions).toHaveBeenCalledWith('country-fast');
      });

      // Now resolve the stale slow response with subdivisions.
      resolveFirst!([
        { id: 'late-state-1', name: 'LateState', code2: 'LS' }
      ]);

      // The stale response must be discarded — the state piece must remain
      // free-text (because the fast request returned []), not become a
      // dropdown listing the LateState option.
      await waitFor(() => {
        const stateField = screen.getByTestId(`address-${requirementId}-state`);
        expect(stateField.tagName).toBe('INPUT');
      });

      // And the late "LateState" entry must NOT have appeared anywhere.
      expect(screen.queryByText('LateState')).not.toBeInTheDocument();
    });
  });

  describe('locked mode', () => {
    it('disables all inputs when locked is true', () => {
      render(
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={fullConfig}
          countryId={null}
          value={{ street1: 'a', city: 'b', postalCode: 'c' }}
          onChange={onChange}
          locked={true}
        />
      );

      // street1, street2 (optional, but enabled), city, state (free-text fallback), postalCode
      const street1 = screen.getByTestId(`address-${requirementId}-street1`) as HTMLInputElement;
      const city = screen.getByTestId(`address-${requirementId}-city`) as HTMLInputElement;
      const postalCode = screen.getByTestId(`address-${requirementId}-postalCode`) as HTMLInputElement;
      expect(street1.disabled).toBe(true);
      expect(city.disabled).toBe(true);
      expect(postalCode.disabled).toBe(true);
    });
  });
});
