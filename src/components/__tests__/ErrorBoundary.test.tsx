// /GlobalRX_v2/src/components/__tests__/ErrorBoundary.test.tsx
//
// Task 9.1 — Error Boundaries & Loading States (Pass 2 component tests).
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md
//       §"Existing Files to Modify" #2 (ErrorBoundary enhancements:
//       `onError`, `onReset`, `resetKeys`, render-prop fallback)
//
// The ErrorBoundary itself is the subject under test, so it is NEVER mocked.
// React errors thrown by child components are real errors caught by the
// real getDerivedStateFromError lifecycle. We spy on console.error to keep
// the React-emitted "The above error occurred…" noise out of the test
// output without suppressing genuine test failures.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { ErrorBoundary } from '../ErrorBoundary';

// React logs every caught error to console.error in development. The
// boundary swallowing the error is correct behavior, but the log messages
// clutter test output and can mask real failures. We silence them for the
// duration of these tests and restore the original afterwards.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// A child component that throws on demand. We toggle the prop from the
// test so the boundary can transition from "healthy children" -> "error"
// -> "healthy children" without remounting the boundary itself.
function MaybeThrow({ shouldThrow, message = 'boom' }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="healthy-child">healthy</div>;
}

describe('ErrorBoundary', () => {
  describe('children rendering', () => {
    it('renders children when no error has been thrown', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="fallback">fallback</div>}>
          <div data-testid="child">hello</div>
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });
  });

  describe('fallback as ReactNode', () => {
    it('renders the fallback ReactNode when a child throws', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="fallback">caught</div>}>
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('healthy-child')).not.toBeInTheDocument();
    });

    it('renders null (and does not crash) when a child throws and no fallback is provided', () => {
      const { container } = render(
        <ErrorBoundary>
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      // No fallback supplied -> the boundary renders null but does not
      // re-throw, so the outer container is empty rather than missing.
      expect(container.firstChild).toBeNull();
    });
  });

  describe('fallback as render prop', () => {
    it('invokes the fallback function with (error, reset) when a child throws', () => {
      const fallbackFn = vi.fn((error: Error, _reset: () => void) => (
        <div data-testid="fallback-render-prop">{error.message}</div>
      ));

      render(
        <ErrorBoundary fallback={fallbackFn}>
          <MaybeThrow shouldThrow message="render-prop-error" />
        </ErrorBoundary>,
      );

      // The fallback render-prop was called with the real Error from the
      // child (not a mocked one) and the boundary's own reset callback.
      expect(fallbackFn).toHaveBeenCalled();
      const firstCallArgs = fallbackFn.mock.calls[0];
      expect(firstCallArgs[0]).toBeInstanceOf(Error);
      expect((firstCallArgs[0] as Error).message).toBe('render-prop-error');
      expect(typeof firstCallArgs[1]).toBe('function');

      expect(screen.getByTestId('fallback-render-prop')).toHaveTextContent(
        'render-prop-error',
      );
    });

    it('resets to children when the reset callback supplied to the render prop is invoked', () => {
      // Capture the reset callback so the test can invoke it directly.
      // After reset, the boundary's error state clears and the children
      // re-render — but the same child instance still throws, so we
      // re-render with shouldThrow=false to simulate "the underlying
      // problem has been fixed."
      let capturedReset: (() => void) | null = null;

      const { rerender } = render(
        <ErrorBoundary
          fallback={(_err, reset) => {
            capturedReset = reset;
            return <div data-testid="fallback">fallback</div>;
          }}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(capturedReset).not.toBeNull();

      // Fix the underlying child first, then reset the boundary. If we
      // reset while the child still throws, React would immediately
      // re-enter the error state and the test would observe the fallback
      // again — which would be correct behavior, but harder to verify.
      rerender(
        <ErrorBoundary
          fallback={(_err, reset) => {
            capturedReset = reset;
            return <div data-testid="fallback">fallback</div>;
          }}
        >
          <MaybeThrow shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Calling reset triggers a state update on the boundary; we wrap in
      // `act` so React flushes the resulting render before the assertion.
      act(() => {
        capturedReset!();
      });

      // After reset, the healthy child is visible and the fallback is gone.
      expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });
  });

  describe('onError callback', () => {
    it('invokes onError with the thrown error and errorInfo when a child throws', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary
          fallback={<div data-testid="fallback">fallback</div>}
          onError={onError}
        >
          <MaybeThrow shouldThrow message="logged-error" />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalledTimes(1);
      const [error, errorInfo] = onError.mock.calls[0];

      // The error must be the actual Error instance the child threw, not a
      // synthetic wrapper. If the boundary ever started wrapping errors,
      // this assertion would catch the regression.
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('logged-error');

      // React passes ErrorInfo with at least a componentStack string.
      expect(errorInfo).toBeDefined();
      expect(typeof (errorInfo as { componentStack?: unknown }).componentStack)
        .toBe('string');
    });

    it('does not invoke onError when children render successfully', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary
          fallback={<div data-testid="fallback">fallback</div>}
          onError={onError}
        >
          <div>healthy</div>
        </ErrorBoundary>,
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('onReset callback', () => {
    it('invokes onReset when the reset callback handed to the fallback is called', () => {
      const onReset = vi.fn();
      let capturedReset: (() => void) | null = null;

      render(
        <ErrorBoundary
          onReset={onReset}
          fallback={(_err, reset) => {
            capturedReset = reset;
            return <div data-testid="fallback">fallback</div>;
          }}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(onReset).not.toHaveBeenCalled();

      act(() => {
        capturedReset!();
      });

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('does not invoke onReset until reset is actually triggered', () => {
      const onReset = vi.fn();

      render(
        <ErrorBoundary
          onReset={onReset}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      // Catching the error must not be confused with resetting. onReset
      // should fire on recovery, not on the initial catch.
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('resetKeys auto-reset', () => {
    it('auto-resets the boundary when a value in resetKeys changes after an error', () => {
      // The boundary catches the error from MaybeThrow, then a resetKey
      // change should clear the error so the (now-healthy) children render.
      const { rerender } = render(
        <ErrorBoundary
          resetKeys={['section-a']}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Swap the child to a healthy one AND change the resetKey. The
      // resetKey change is what tells the boundary to leave the error
      // state; without that change, the rerender alone would still show
      // the fallback because the boundary stays latched.
      rerender(
        <ErrorBoundary
          resetKeys={['section-b']}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });

    it('auto-resets when the resetKeys array length changes', () => {
      const { rerender } = render(
        <ErrorBoundary
          resetKeys={['k1']}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();

      // Length change alone (k1 still present, new entry added) should
      // also trigger a reset per the implementation's length-comparison
      // branch.
      rerender(
        <ErrorBoundary
          resetKeys={['k1', 'k2']}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
    });

    it('invokes onReset when resetKeys-triggered reset fires', () => {
      const onReset = vi.fn();

      const { rerender } = render(
        <ErrorBoundary
          resetKeys={['section-a']}
          onReset={onReset}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(onReset).not.toHaveBeenCalled();

      rerender(
        <ErrorBoundary
          resetKeys={['section-b']}
          onReset={onReset}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('does NOT auto-reset when resetKeys are unchanged between renders', () => {
      const onReset = vi.fn();

      const { rerender } = render(
        <ErrorBoundary
          resetKeys={['section-a']}
          onReset={onReset}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      // The boundary is in the error state. We re-render WITHOUT changing
      // resetKeys; the boundary must stay in the error state and onReset
      // must not fire. This is the guard that prevents the boundary from
      // resetting on every parent re-render.
      rerender(
        <ErrorBoundary
          resetKeys={['section-a']}
          onReset={onReset}
          fallback={<div data-testid="fallback">fallback</div>}
        >
          <MaybeThrow shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(onReset).not.toHaveBeenCalled();
      // Boundary must still be displaying the fallback (latched).
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });
  });

  describe('backward compatibility', () => {
    it('works with only a fallback ReactNode and no other props (pre-Task-9.1 contract)', () => {
      // The spec's risk #1 — backward compatibility — required that the
      // new props remain optional with no behavior change when omitted.
      // This test exercises the bare-minimum contract: fallback ReactNode
      // only, no onError, onReset, or resetKeys.
      render(
        <ErrorBoundary fallback={<div data-testid="legacy-fallback">legacy</div>}>
          <MaybeThrow shouldThrow />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('legacy-fallback')).toBeInTheDocument();
    });
  });
});
