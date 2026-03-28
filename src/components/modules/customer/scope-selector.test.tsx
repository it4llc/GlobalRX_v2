// /GlobalRX_v2/src/components/modules/customer/scope-selector.test.tsx

// REGRESSION TEST: proves bug fix for Education verification infinite loop
// Bug: useEffect in ScopeSelector calls onChange on every render without checking
// if values changed, causing infinite loop when used with Education verification services
// This test will FAIL before the fix is applied and PASS after the fix

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScopeSelector } from './scope-selector';

describe('ScopeSelector - Education Verification Infinite Loop Bug', () => {
  let onChangeMock: any;
  let renderCount = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    onChangeMock = vi.fn();
    renderCount = 0;
  });

  describe('REGRESSION TEST: Maximum update depth exceeded error', () => {
    it('should NOT trigger onChange on every render (proves infinite loop bug)', () => {
      // REGRESSION TEST: This test proves the bug exists
      // Before fix: onChange is called multiple times causing infinite loop
      // After fix: onChange is only called when values actually change

      const TestWrapper = () => {
        renderCount++;
        if (renderCount > 50) {
          throw new Error('Maximum update depth exceeded - infinite loop detected');
        }

        return (
          <ScopeSelector
            serviceType="verification-edu"
            value={null}
            onChange={onChangeMock}
          />
        );
      };

      // This should render without throwing the max depth error
      const { rerender } = render(<TestWrapper />);

      // Initial render should call onChange once with default values
      expect(onChangeMock).toHaveBeenCalledTimes(1);
      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'highest-degree'
      });

      // Clear the mock to test subsequent renders
      onChangeMock.mockClear();
      renderCount = 0;

      // Re-render with same props should NOT trigger onChange again
      rerender(<TestWrapper />);

      // Bug verification: onChange should NOT be called on re-render with same values
      // If it's called, it means the useEffect is running without dependency checks
      expect(onChangeMock).toHaveBeenCalledTimes(0);
      expect(renderCount).toBeLessThan(10); // Should only render once or twice, not loop
    });

    it('should NOT cause infinite loop when value prop changes to same effective value', () => {
      // Test that even when the value prop changes reference but has same data,
      // we don't trigger unnecessary onChange calls

      const { rerender } = render(
        <ScopeSelector
          serviceType="verification-edu"
          value={{ type: 'highest-degree' }}
          onChange={onChangeMock}
        />
      );

      // Initial render with existing value
      expect(onChangeMock).toHaveBeenCalledTimes(1);

      onChangeMock.mockClear();

      // Re-render with new object reference but same values
      rerender(
        <ScopeSelector
          serviceType="verification-edu"
          value={{ type: 'highest-degree' }} // New object, same content
          onChange={onChangeMock}
        />
      );

      // Should NOT call onChange since effective values haven't changed
      expect(onChangeMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Correct behavior after fix', () => {
    it('should call onChange only when scope type actually changes', async () => {
      const user = userEvent.setup();

      render(
        <ScopeSelector
          serviceType="verification-edu"
          value={null}
          onChange={onChangeMock}
        />
      );

      // Initial call with default
      expect(onChangeMock).toHaveBeenCalledTimes(1);
      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'highest-degree'
      });

      onChangeMock.mockClear();

      // Click a different radio option
      const allDegreesRadio = screen.getByLabelText('All degrees post high school');
      await user.click(allDegreesRadio);

      // Should call onChange with new value
      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalledTimes(1);
        expect(onChangeMock).toHaveBeenCalledWith({
          type: 'all-degrees'
        });
      });
    });

    it('should call onChange only when employment scope values change', async () => {
      const user = userEvent.setup();

      render(
        <ScopeSelector
          serviceType="verification-emp"
          value={null}
          onChange={onChangeMock}
        />
      );

      // Initial call with default
      expect(onChangeMock).toHaveBeenCalledTimes(1);
      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'most-recent'
      });

      onChangeMock.mockClear();

      // Click the years-based option (actually changes the type)
      const yearsRadio = screen.getByLabelText(/All employments in past/);
      await user.click(yearsRadio);

      // Should call onChange with new type
      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalledTimes(1);
        expect(onChangeMock).toHaveBeenCalledWith({
          type: 'past-x-years',
          years: 7
        });
      });

      onChangeMock.mockClear();

      // Type a new years value (get all spinbuttons and use the second one which is for years)
      const inputs = screen.getAllByRole('spinbutton');
      const yearsInput = inputs[1]; // Second input is for years
      // Use fireEvent.change to directly set the value on the controlled input
      fireEvent.change(yearsInput, { target: { value: '5' } });

      // Should call onChange with new years value
      await waitFor(() => {
        expect(onChangeMock).toHaveBeenCalled();
        const lastCall = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1];
        expect(lastCall[0]).toEqual({
          type: 'past-x-years',
          years: 5
        });
      });
    });
  });

  describe('Component initialization', () => {
    it('should initialize with correct default for education verification', () => {
      render(
        <ScopeSelector
          serviceType="verification-edu"
          value={null}
          onChange={onChangeMock}
        />
      );

      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'highest-degree'
      });

      const highestDegreeRadio = screen.getByLabelText('Highest Degree, post high school');
      expect(highestDegreeRadio).toBeChecked();
    });

    it('should initialize with correct default for employment verification', () => {
      render(
        <ScopeSelector
          serviceType="verification-emp"
          value={null}
          onChange={onChangeMock}
        />
      );

      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'most-recent'
      });

      const mostRecentRadio = screen.getByLabelText('Most recent employment');
      expect(mostRecentRadio).toBeChecked();
    });

    it('should preserve existing value when provided', () => {
      render(
        <ScopeSelector
          serviceType="verification-edu"
          value={{ type: 'all-degrees' }}
          onChange={onChangeMock}
        />
      );

      const allDegreesRadio = screen.getByLabelText('All degrees post high school');
      expect(allDegreesRadio).toBeChecked();
    });
  });

  describe('Edge cases', () => {
    it('should handle disabled state without triggering onChange', async () => {
      const user = userEvent.setup();

      render(
        <ScopeSelector
          serviceType="verification-edu"
          value={null}
          onChange={onChangeMock}
          disabled={true}
        />
      );

      // Initial render still calls onChange once
      expect(onChangeMock).toHaveBeenCalledTimes(1);
      onChangeMock.mockClear();

      // Try to click a radio when disabled
      const allDegreesRadio = screen.getByLabelText('All degrees post high school');
      await user.click(allDegreesRadio);

      // Should not trigger onChange when disabled
      expect(onChangeMock).not.toHaveBeenCalled();
    });

    it('should handle unsupported service types gracefully', () => {
      render(
        <ScopeSelector
          serviceType="unknown-type"
          value={null}
          onChange={onChangeMock}
        />
      );

      // Should render fallback and call onChange with standard scope
      expect(screen.getByText('Standard scope')).toBeInTheDocument();
      expect(onChangeMock).toHaveBeenCalledWith({
        type: 'standard'
      });
    });

    it('should handle onChange callback changes without infinite loop', () => {
      const onChange1 = vi.fn();
      const onChange2 = vi.fn();

      const { rerender } = render(
        <ScopeSelector
          serviceType="verification-edu"
          value={null}
          onChange={onChange1}
        />
      );

      expect(onChange1).toHaveBeenCalledTimes(1);

      // Change the onChange callback
      rerender(
        <ScopeSelector
          serviceType="verification-edu"
          value={{ type: 'highest-degree' }}
          onChange={onChange2}
        />
      );

      // New callback should NOT be called since values haven't changed
      // (the value was already 'highest-degree' from the initial render)
      expect(onChange2).toHaveBeenCalledTimes(0);

      // Should not cause runaway calls
      expect(onChange1).toHaveBeenCalledTimes(1); // Still just the initial call
      expect(onChange2).toHaveBeenCalledTimes(0); // Never called since no value change
    });
  });
});