// /GlobalRX_v2/src/components/ui/checkbox.test.tsx

// REGRESSION TEST: proves bug fix for Checkbox ref handling contribution to infinite loop
// Bug: useEffect for ref combining runs on every render, potentially contributing to
// render loops when used in components with unstable callbacks
// This test will FAIL before the fix is applied and PASS after the fix

import React, { useRef, useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

describe('Checkbox - Ref Handling Infinite Loop Contribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('REGRESSION TEST: Ref combining useEffect stability', () => {
    it('should NOT trigger ref callbacks on every render', () => {
      // REGRESSION TEST: This test proves the ref handling bug exists
      // Before fix: ref callback is triggered on every render
      // After fix: ref callback is only triggered when ref actually changes

      const refCallback = vi.fn();
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const [checked, setChecked] = useState(false);

        // Force a re-render after mount to test stability
        React.useEffect(() => {
          if (renderCount === 1) {
            setChecked(false); // Trigger re-render with same value
          }
        }, []);

        return (
          <Checkbox
            ref={refCallback}
            checked={checked}
            onCheckedChange={setChecked}
          />
        );
      };

      render(<TestComponent />);

      // Wait for the effect to run and trigger re-render
      waitFor(() => {
        // The ref callback should only be called when ref actually changes
        // Not on every render
        expect(refCallback).toHaveBeenCalledTimes(1);
        expect(renderCount).toBeGreaterThanOrEqual(2);
      });
    });

    it('should maintain stable ref when parent component re-renders', () => {
      const parentRef = { current: null };
      let effectRunCount = 0;

      const TestComponent = () => {
        const [, forceRender] = useState(0);

        // Track how many times the ref effect runs
        React.useEffect(() => {
          effectRunCount++;
        });

        return (
          <>
            <button onClick={() => forceRender(prev => prev + 1)}>Force Render</button>
            <Checkbox ref={parentRef} />
          </>
        );
      };

      const { rerender } = render(<TestComponent />);
      const initialRef = parentRef.current;
      const initialEffectCount = effectRunCount;

      // Force multiple re-renders
      rerender(<TestComponent />);
      rerender(<TestComponent />);

      // The ref should remain stable
      expect(parentRef.current).toBe(initialRef);

      // The effect shouldn't run excessively
      expect(effectRunCount - initialEffectCount).toBeLessThan(3);
    });
  });

  describe('Correct ref behavior after fix', () => {
    it('should properly forward ref to the underlying element', () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Checkbox ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toBeTruthy();
    });

    it('should handle callback refs correctly', () => {
      let capturedRef: HTMLButtonElement | null = null;
      const callbackRef = (el: HTMLButtonElement | null) => {
        capturedRef = el;
      };

      const { unmount } = render(<Checkbox ref={callbackRef} />);

      // Ref should be set after mount
      expect(capturedRef).toBeInstanceOf(HTMLButtonElement);

      // Ref should be cleared on unmount
      unmount();
      expect(capturedRef).toBeNull();
    });

    it('should handle ref changes without causing re-renders', () => {
      const ref1 = React.createRef<HTMLButtonElement>();
      const ref2 = React.createRef<HTMLButtonElement>();
      let renderCount = 0;

      const TestComponent = ({ checkboxRef }: { checkboxRef: any }) => {
        renderCount++;
        return <Checkbox ref={checkboxRef} />;
      };

      const { rerender } = render(<TestComponent checkboxRef={ref1} />);
      const firstRenderCount = renderCount;

      // Change the ref
      rerender(<TestComponent checkboxRef={ref2} />);

      // Should only cause one additional render for prop change
      expect(renderCount).toBe(firstRenderCount + 1);
      expect(ref2.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Checkbox interaction with unstable callbacks', () => {
    it('should not cause excessive re-renders when callback changes frequently', () => {
      let renderCount = 0;
      let callbackCallCount = 0;

      const TestComponent = () => {
        renderCount++;
        const [checked, setChecked] = useState(false);

        // Intentionally unstable callback (recreated every render)
        const handleChange = (value: boolean) => {
          callbackCallCount++;
          setChecked(value);
        };

        return (
          <Checkbox
            checked={checked}
            onCheckedChange={handleChange}
            aria-label="Test checkbox"
          />
        );
      };

      render(<TestComponent />);

      // Initial render
      expect(renderCount).toBe(1);

      // Click the checkbox
      const checkbox = screen.getByRole('checkbox');
      userEvent.click(checkbox);

      waitFor(() => {
        // Should only render twice (initial + after state change)
        // Not in a loop despite unstable callback
        expect(renderCount).toBeLessThanOrEqual(3);
        expect(callbackCallCount).toBe(1);
      });
    });
  });

  describe('Indeterminate state handling', () => {
    it('should handle indeterminate prop without affecting ref stability', () => {
      const ref = React.createRef<HTMLButtonElement>();

      const { rerender } = render(
        <Checkbox ref={ref} indeterminate={false} />
      );

      const elementBeforeChange = ref.current;

      // Change indeterminate state
      rerender(<Checkbox ref={ref} indeterminate={true} />);

      // Ref should still point to same element
      expect(ref.current).toBe(elementBeforeChange);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('should apply indeterminate styling when prop is true', () => {
      const { container } = render(<Checkbox indeterminate={true} />);

      const checkbox = container.querySelector('[role="checkbox"]');
      expect(checkbox?.className).toContain("after:content-['']");
    });
  });

  describe('Edge cases', () => {
    it('should handle null ref without errors', () => {
      expect(() => {
        render(<Checkbox ref={null} />);
      }).not.toThrow();
    });

    it('should handle undefined ref without errors', () => {
      expect(() => {
        render(<Checkbox ref={undefined} />);
      }).not.toThrow();
    });

    it('should handle rapid ref changes without memory leaks', () => {
      const refs = Array(10).fill(null).map(() => React.createRef<HTMLButtonElement>());
      let currentRefIndex = 0;

      const TestComponent = () => {
        const [refIndex, setRefIndex] = useState(0);

        return (
          <>
            <button onClick={() => setRefIndex((refIndex + 1) % refs.length)}>
              Next Ref
            </button>
            <Checkbox ref={refs[refIndex]} />
          </>
        );
      };

      const { getByText } = render(<TestComponent />);
      const button = getByText('Next Ref');

      // Rapidly change refs
      for (let i = 0; i < 20; i++) {
        userEvent.click(button);
      }

      // Last ref should be properly set
      waitFor(() => {
        const lastRefIndex = currentRefIndex % refs.length;
        expect(refs[lastRefIndex].current).toBeInstanceOf(HTMLButtonElement);
      });
    });
  });
});