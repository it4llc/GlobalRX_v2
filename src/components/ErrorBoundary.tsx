// /GlobalRX_v2/src/components/ErrorBoundary.tsx
//
// Task 9.1 — Error Boundaries & Loading States
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md
//
// Generic class-based ErrorBoundary. React only supports error boundaries via
// class components today (componentDidCatch / getDerivedStateFromError are
// not available on function components), so this file is a class component
// by necessity.
//
// Props:
//   - children:   the subtree to protect from render errors
//   - fallback:   either a ReactNode rendered as-is, OR a render-prop callback
//                 `(error, reset) => ReactNode` so callers can show a
//                 candidate-friendly fallback with retry controls
//   - onError:    called when an error is caught — used by the caller to log
//                 the error through its own client-safe logger (we do NOT
//                 import Winston here because Winston is server-only)
//   - onReset:    called when the boundary transitions back to a healthy
//                 state (Try Again clicked, or any resetKey changes). Lets
//                 the caller clear stale data, refresh validation, etc.
//   - resetKeys:  array of values; when any one of them changes between
//                 renders, the boundary automatically resets. This is what
//                 the candidate portal uses to clear a crashed section's
//                 error state when the candidate navigates to a different
//                 section.
//
// Everything except `children` is optional, so this component is safe to drop
// into any subtree without forcing the caller to wire up callbacks.

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type FallbackRender = (error: Error, reset: () => void) => ReactNode;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | FallbackRender;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // We remember the previous resetKeys array so componentDidUpdate can decide
  // whether any value changed and trigger an auto-reset. Storing it as an
  // instance property (not state) keeps the comparison synchronous — we don't
  // want a state update just to track this.
  private previousResetKeys: unknown[];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.previousResetKeys = props.resetKeys ?? [];
  }

  // Standard React error-boundary lifecycle: getDerivedStateFromError flips
  // us into the error state on the next render so the fallback is shown
  // instead of the (broken) children.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  // componentDidCatch fires after the fallback renders. We forward the error
  // to the caller's onError callback (if provided) so the caller can log it
  // through its own client-safe logger.
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  // Auto-reset whenever any value in `resetKeys` changes. We compare against
  // the snapshot stored at the last reset (or boundary mount) so that a
  // single resetKey change resets exactly once, not on every subsequent
  // render. The shallow length-and-value comparison is sufficient because
  // callers pass identifiers (section ids, route paths) — not deep objects.
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error === null) {
      // Still track the latest keys so the next error has a clean baseline
      // to compare against. Without this, a reset triggered by a key change
      // followed by another key change would not fire a second reset.
      this.previousResetKeys = this.props.resetKeys ?? [];
      return;
    }

    const nextKeys = this.props.resetKeys ?? [];
    const prevKeys = prevProps.resetKeys ?? this.previousResetKeys;

    const lengthChanged = nextKeys.length !== prevKeys.length;
    const valueChanged =
      !lengthChanged && nextKeys.some((value, index) => value !== prevKeys[index]);

    if (lengthChanged || valueChanged) {
      this.reset();
    }
  }

  // Reset clears the error state and notifies the caller via onReset so the
  // caller can do any cleanup it owns (clear stale data, refresh validation,
  // etc.). It is also the callback handed to render-prop fallbacks as the
  // second argument so a "Try Again" button can recover without remounting
  // the whole tree.
  reset = (): void => {
    this.previousResetKeys = this.props.resetKeys ?? [];
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error === null) {
      return children;
    }

    if (typeof fallback === 'function') {
      // Render-prop form: the caller decides what to show and gets the reset
      // callback so its "Try Again" button can wire up cleanly.
      return (fallback as FallbackRender)(error, this.reset);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    // No fallback was provided. We render nothing rather than crash again
    // (which would defeat the purpose of the boundary). The caller's onError
    // callback already received the underlying error for logging.
    return null;
  }
}

export default ErrorBoundary;
