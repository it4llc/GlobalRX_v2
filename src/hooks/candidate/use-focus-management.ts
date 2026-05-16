// /GlobalRX_v2/src/hooks/candidate/use-focus-management.ts
//
// Task 9.2 — focus management for step navigation.
//
// Moves keyboard focus to the new step's heading after the candidate
// navigates via Next/Back or sidebar click. Uses requestAnimationFrame as
// a fallback to ensure the target element exists in the DOM before
// .focus() is called — necessary because the active step's content unmounts
// and remounts on navigation, and the heading may not exist on the very
// first tick after activeSection changes.

'use client';

import { useEffect, useRef } from 'react';

/**
 * Move keyboard focus to the element with the given id whenever `trigger`
 * changes (typically the active section id). Skips the very first render so
 * the page doesn't yank focus on initial mount.
 */
export function useFocusOnChange(targetId: string, trigger: string | null | number) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!targetId) return;

    // Two-tier retry: try immediately, then on the next animation frame
    // (after React has committed the new step), then after a short timeout
    // (covers CSS transition delays).
    const tryFocus = (): boolean => {
      const el = document.getElementById(targetId);
      if (el) {
        // preventScroll keeps the page from jumping when focus moves to
        // a heading at the top of the new step.
        el.focus({ preventScroll: false });
        return true;
      }
      return false;
    };

    if (tryFocus()) return;

    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    rafId = requestAnimationFrame(() => {
      if (tryFocus()) return;
      timeoutId = setTimeout(tryFocus, 100);
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [targetId, trigger]);
}

/**
 * Imperative version: caller invokes focusElement(id) at the appropriate
 * moment (e.g., after adding a new repeatable entry). Uses the same
 * try-then-RAF-then-timeout fallback chain.
 */
export function focusElementById(id: string): void {
  if (!id) return;
  const tryFocus = (): boolean => {
    const el = document.getElementById(id);
    if (el) {
      el.focus({ preventScroll: false });
      return true;
    }
    return false;
  };
  if (tryFocus()) return;
  requestAnimationFrame(() => {
    if (tryFocus()) return;
    setTimeout(tryFocus, 100);
  });
}
