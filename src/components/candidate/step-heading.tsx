// /GlobalRX_v2/src/components/candidate/step-heading.tsx
//
// Task 9.2 — Reusable step heading rendered at the top of each of the 9
// candidate-application steps. Provides a consistent, focusable <h2> that
// the useFocusManagement hook moves keyboard focus to after navigation.
//
// The heading has tabIndex={-1} so .focus() works without making it
// keyboard-tab-able (we don't want screen-reader users to land on a heading
// when they Tab through the page; the focus is only programmatic after
// step navigation).

'use client';

import React from 'react';

interface StepHeadingProps {
  /** Heading text — already-localized display string. */
  title: string;
  /**
   * Unique id used by the focus-management hook to target the heading. Also
   * referenced by aria-labelledby on the surrounding form region when the
   * caller supplies one. The spec requires every heading id to be unique
   * across the portal (one per step).
   */
  id: string;
  /** Optional supplementary heading content (e.g., progress badge). */
  children?: React.ReactNode;
}

export function StepHeading({ title, id, children }: StepHeadingProps) {
  return (
    <h2
      id={id}
      // tabIndex=-1 lets useFocusManagement call .focus() without adding the
      // heading to the natural tab order. This is the WAI-ARIA recommended
      // pattern for programmatic focus targets that should not be reachable
      // by sequential Tab presses.
      tabIndex={-1}
      // outline-none avoids the default browser focus ring on the heading
      // since visual focus on a non-interactive heading is unexpected; the
      // sr-only announcement and the URL change are the affordances that
      // tell the user something happened. We keep keyboard navigation
      // working for everything else via the globals.css :focus-visible rule.
      className="text-2xl font-semibold text-gray-900 outline-none"
      data-testid="step-heading"
    >
      {title}
      {children}
    </h2>
  );
}
