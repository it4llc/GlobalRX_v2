// /GlobalRX_v2/src/components/candidate/skip-link.tsx
//
// Task 9.2 — Skip-to-main-content link.
//
// Visually hidden by default; becomes visible when it receives keyboard
// focus. Activating it (Enter / Space) moves both the URL fragment and the
// browser focus to the element with id `MAIN_CONTENT_ID`. The link is the
// FIRST focusable element on the portal so the very first Tab keystroke
// always lands on it (spec assertion).

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import { MAIN_CONTENT_ID } from '@/lib/candidate/a11y-constants';

export function SkipLink() {
  const { t } = useTranslation();

  // We explicitly call focus() on the target element after the default
  // anchor behaviour scrolls / updates the URL fragment. Without this, the
  // visual scroll moves but keyboard focus stays on the skip link, defeating
  // the purpose. The target container has tabIndex={-1} so it can accept
  // programmatic focus.
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(MAIN_CONTENT_ID);
    if (target) {
      // Allow the native anchor behaviour to update the URL fragment first
      // (we need #main-content in the URL per spec), then move focus.
      event.preventDefault();
      // Update the URL fragment ourselves since we cancelled the default.
      if (typeof window !== 'undefined' && window.history && window.location) {
        const newUrl = `${window.location.pathname}${window.location.search}#${MAIN_CONTENT_ID}`;
        window.history.pushState(null, '', newUrl);
      }
      target.focus({ preventScroll: false });
    }
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      // The `skip-link` class is defined in globals.css and uses the same
      // sr-only-style clip until :focus-visible / :focus, at which point it
      // becomes a fixed-position visible button at the top of the viewport.
      className="skip-link"
      data-testid="skip-link"
    >
      {t('candidate.a11y.skipToContent')}
    </a>
  );
}
