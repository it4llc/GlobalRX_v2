// /GlobalRX_v2/src/components/candidate/portal-sidebar.tsx

'use client';

import React, { useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CandidatePortalSection } from '@/types/candidate-portal';
import SectionProgressIndicator from './SectionProgressIndicator';
import { MOBILE_SIDEBAR_ID } from '@/lib/candidate/a11y-constants';
import {
  useFocusTrap,
  useKeyboardNavigation,
} from '@/hooks/candidate/use-keyboard-navigation';

interface PortalSidebarProps {
  sections: CandidatePortalSection[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function PortalSidebar({
  sections,
  activeSection,
  onSectionClick,
  isOpen = true,
  onClose
}: PortalSidebarProps) {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Task 9.2 — Escape closes the mobile drawer + Tab/Shift+Tab focus trap.
  // Both hooks no-op when the drawer is closed (or when onClose is not
  // supplied, which is the desktop sidebar case).
  useKeyboardNavigation({
    onEscape: onClose,
    isDrawerOpen: Boolean(onClose) && isOpen,
  });
  useFocusTrap(drawerRef, Boolean(onClose) && isOpen);

  // Phase 6 Stage 4: the per-section status indicator now lives in the
  // SectionProgressIndicator component (BR 14, BR 22). The sidebar passes
  // the section's status + display label down rather than rendering an
  // inline icon. Centralising the indicator in one component keeps the
  // visual rules consistent across every place that shows a status dot.
  //
  // Phase 7 Stage 1 — the Review & Submit entry (section.type === 'review_submit')
  // is rendered last with a separator above it (Rule 29). All sections
  // — including Review & Submit — go through the same SectionProgressIndicator
  // so the visual treatment stays consistent.
  //
  // Task 9.2 — list semantics: role="list" + role="listitem" + aria-current
  // on the active step item. The per-item aria-label includes the step
  // number, name, and status so screen readers announce all three.
  const totalSteps = sections.length;
  const sidebarContent = (
    <nav
      className="px-3 py-6"
      // Task 9.2 — Application-steps landmark. Both the desktop and mobile
      // copies expose role=navigation; tests guard against duplicates by
      // hiding the off-viewport copy from the accessibility tree.
      role="navigation"
      aria-label={t('candidate.a11y.applicationSteps')}
    >
      <ul className="space-y-1" role="list">
        {sections.map((section, idx) => {
          const sectionLabel = t(section.title);
          const isReview = section.type === 'review_submit';
          const isActive = activeSection === section.id;
          // Insert a separator above the first review_submit entry so it's
          // visually distinct from the regular sections above it.
          const showSeparator =
            isReview && idx > 0 && sections[idx - 1].type !== 'review_submit';
          // Task 9.2 — status word for the per-item aria-label. The three
          // English strings are the WCAG-AA vocabulary used everywhere
          // (sidebar, SectionProgressIndicator sr-only text).
          const statusWord =
            section.status === 'complete'
              ? t('candidate.a11y.stepStatusComplete')
              : section.status === 'incomplete'
                ? t('candidate.a11y.stepStatusIncomplete')
                : t('candidate.a11y.stepStatusNotStarted');
          // "Step X of N: <name> — <status>" matches the regex in the spec
          // (Step \d+ of \d+ AND one of complete/has errors/not started).
          const itemAriaLabel = `${t('candidate.a11y.stepXofY', {
            current: idx + 1,
            total: totalSteps,
            name: sectionLabel,
          })} — ${statusWord}`;
          return (
            <React.Fragment key={section.id}>
              {showSeparator && (
                <li
                  aria-hidden="true"
                  className="my-2 border-t border-gray-200"
                  data-testid="review-separator"
                />
              )}
              <li
                role="listitem"
                // aria-current="step" on the active item only. The spec
                // requires exactly one element with this attribute on the
                // page at any given time.
                aria-current={isActive ? 'step' : undefined}
                data-testid={isReview ? 'review-submit-item' : 'section-item'}
                data-active={isActive}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSectionClick(section.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] rounded-md text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-label={itemAriaLabel}
                  // min-h-[44px] ensures mobile touch targets meet accessibility standards
                >
                  <span className="flex-1 mr-3">{sectionLabel}</span>
                  <SectionProgressIndicator
                    status={section.status}
                    label={sectionLabel}
                  />
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </nav>
  );

  // Mobile slide-out menu
  if (onClose) {
    return (
      <>
        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={onClose}
            data-testid="mobile-overlay"
            aria-hidden="true"
          />
        )}

        {/* Slide-out panel — Task 9.2 wraps the drawer in role=dialog so
            screen readers announce it as a modal, with aria-modal=true to
            indicate background content is inert. The drawer is unmounted
            from the a11y tree when closed via aria-hidden so the desktop
            sidebar remains the only navigation landmark in that state. */}
        <div
          ref={drawerRef}
          id={MOBILE_SIDEBAR_ID}
          className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 md:hidden ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          data-testid="mobile-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={t('candidate.a11y.stepsMenu')}
          aria-hidden={!isOpen}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('candidate.portal.menu')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 min-h-[44px] min-w-[44px] rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
                // Task 9.2 — the close button's aria-label now comes from
                // the spec-mandated `candidate.a11y.closeMenu` key so
                // screen readers receive a translated label across every
                // supported locale.
                aria-label={t('candidate.a11y.closeMenu')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-y-auto h-full pb-20">
            {sidebarContent}
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className="hidden md:block w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
      {sidebarContent}
    </aside>
  );
}
