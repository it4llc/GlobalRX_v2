// /GlobalRX_v2/src/hooks/candidate/use-keyboard-navigation.ts
//
// Task 9.2 — keyboard shortcuts for the candidate portal.
//
// Today this provides:
//   - Escape closes the mobile sidebar drawer when it is open.
//
// The hook only attaches a single global keydown listener so it doesn't
// fight with focus-trap implementations inside dialogs. Components opt in
// by passing a callback for each shortcut they care about.

'use client';

import { useEffect } from 'react';

interface KeyboardNavigationOptions {
  /**
   * Called when the user presses Escape AND `isDrawerOpen` is true.
   * Typically wired to the mobile-sidebar close handler.
   */
  onEscape?: () => void;
  /**
   * Gate for the Escape handler. When false, the Escape listener is a
   * no-op so the key event can be handled by other components (e.g.,
   * dialogs in the page body).
   */
  isDrawerOpen?: boolean;
}

export function useKeyboardNavigation({
  onEscape,
  isDrawerOpen,
}: KeyboardNavigationOptions) {
  useEffect(() => {
    if (!isDrawerOpen) return;
    if (!onEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, isDrawerOpen]);
}

/**
 * Focus-trap helper for the mobile sidebar drawer. When the drawer is
 * open, Tab and Shift+Tab cycle among focusable elements inside the
 * provided container; focus cannot escape the container.
 *
 * The caller passes a ref to the drawer's outer DOM node; the hook
 * attaches a keydown listener to it that intercepts Tab presses.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    // Collect all focusable elements inside the container at the moment of
    // each Tab press. We recompute on every press rather than caching so
    // dynamically-added items (e.g., a section becoming visible inside the
    // drawer) participate immediately.
    const getFocusable = (): HTMLElement[] => {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');
      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el.tagName === 'BODY',
      );
    };

    // Move focus into the drawer on mount if focus is currently outside it.
    const initialFocusables = getFocusable();
    if (
      initialFocusables.length > 0 &&
      !container.contains(document.activeElement)
    ) {
      initialFocusables[0].focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // If focus is outside the container for any reason, snap it back.
      if (!active || !container.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Listen on document so the trap works regardless of which element
    // inside the drawer currently has focus.
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, isActive]);
}
