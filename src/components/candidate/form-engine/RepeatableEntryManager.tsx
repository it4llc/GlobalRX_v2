// /GlobalRX_v2/src/components/candidate/form-engine/RepeatableEntryManager.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { focusElementById } from '@/hooks/candidate/use-focus-management';
import type { EntryManagerProps } from '@/types/candidate-repeatable-form';

/**
 * Repeatable Entry Manager Component
 *
 * Manages list of entries with add/remove functionality.
 * Mobile: accordion behavior (one expanded at a time)
 * Desktop: all entries expanded by default
 */
export function RepeatableEntryManager({
  entries,
  onAddEntry,
  onRemoveEntry,
  onEntryChange,
  renderEntry,
  entryLabelKey,
  // Phase 6 Stage 3: when entries.length <= minimumEntries the per-entry
  // remove control is hidden. Address History passes minimumEntries={1}
  // so the remove button disappears on the only entry but reappears as soon
  // as a second entry is added. Education and Employment omit this prop
  // (defaults to 0) and continue to allow removing every entry.
  minimumEntries = 0,
  // Phase 6 Stage 3: when entries.length >= maxEntries the Add button is
  // hidden. Address History passes maxEntries based on count-based scopes
  // (current-address → 1, last-x-addresses → x). Education and Employment
  // omit this prop and remain unlimited.
  maxEntries,
  // Task 9.2 (Accessibility) — section-specific aria-label translation keys.
  addButtonAriaLabelKey,
  removeButtonAriaLabelKey,
}: EntryManagerProps) {
  const { t } = useTranslation();
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showRemoveMessage, setShowRemoveMessage] = useState(false);
  // Tracks whether the user just clicked "Add". When entries.length grows
  // while this flag is set, the watch-effect below expands the new last entry
  // on mobile. This avoids the stale-closure bug from the previous setTimeout
  // approach, which captured `entries` at click time before the parent had
  // appended the new entry, and could expand the wrong row.
  const pendingExpandOnAdd = useRef(false);
  const previousEntriesLength = useRef(entries.length);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const lastClickTime = useRef<number>(0);

  // Watch viewport width once. The listener only depends on window.innerWidth,
  // so registering it on mount with an empty dependency array avoids tearing
  // down and re-attaching the listener on every entries/expandedEntry change.
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, expand the first entry by default. Runs whenever the entry
  // list or viewport changes, but doesn't manage the resize listener itself.
  useEffect(() => {
    if (isMobile && entries.length > 0 && !expandedEntry) {
      setExpandedEntry(entries[0].entryId);
    }
  }, [isMobile, entries, expandedEntry]);

  // When the entry list grows after the user clicks "Add", expand the newly
  // appended entry on mobile. Watching entries.length here (rather than using
  // a setTimeout in the click handler) reads the post-update value directly
  // from props, so we always expand the entry the parent actually appended.
  //
  // Task 9.2 — focus management. When entries grow, focus moves to the
  // first focusable element of the new (last) entry. When entries shrink,
  // focus moves to the first focusable element of the previous (now-last)
  // entry. The pendingExpandOnAdd flag indicates an Add was just triggered;
  // we additionally track shrinkage so Remove triggers focus as well.
  const pendingRemoveFocus = useRef(false);
  useEffect(() => {
    if (
      isMobile &&
      pendingExpandOnAdd.current &&
      entries.length > previousEntriesLength.current &&
      entries.length > 0
    ) {
      setExpandedEntry(entries[entries.length - 1].entryId);
      pendingExpandOnAdd.current = false;
    }
    // Task 9.2 focus management — runs after the parent has committed the
    // new entry list and after the expand effect above has taken effect.
    // We defer with requestAnimationFrame so the fieldset's inputs are in
    // the DOM at the moment we look them up.
    if (entries.length > previousEntriesLength.current && previousEntriesLength.current > 0) {
      // Add — focus the first focusable element inside the LAST entry.
      requestAnimationFrame(() => {
        const lastEntry = entries[entries.length - 1];
        if (!lastEntry) return;
        focusFirstFocusableInEntry(lastEntry.entryId);
      });
    } else if (
      pendingRemoveFocus.current &&
      entries.length < previousEntriesLength.current
    ) {
      // Remove — focus the first focusable element inside whatever the
      // last remaining entry is (or, if none remain, leave focus where it
      // is — the parent always keeps at least one entry).
      requestAnimationFrame(() => {
        if (entries.length === 0) return;
        const lastEntry = entries[entries.length - 1];
        if (!lastEntry) return;
        focusFirstFocusableInEntry(lastEntry.entryId);
      });
      pendingRemoveFocus.current = false;
    }
    previousEntriesLength.current = entries.length;
  }, [entries, isMobile]);

  // Show remove message temporarily
  useEffect(() => {
    if (showRemoveMessage) {
      const timer = setTimeout(() => setShowRemoveMessage(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showRemoveMessage]);

  const handleAddEntry = () => {
    // Debounce to prevent multiple rapid clicks
    const now = Date.now();
    if (now - lastClickTime.current < 500) {
      return;
    }
    lastClickTime.current = now;

    // Mark that we want to expand the newly added entry on mobile when the
    // parent's state update flows back in via the entries prop (handled by
    // the watch-effect above).
    if (isMobile) {
      pendingExpandOnAdd.current = true;
    }

    onAddEntry();
  };

  const handleRemoveEntry = (entryId: string) => {
    // Task 9.2 — flag the focus effect to move keyboard focus into the
    // previous entry once the parent's remove completes.
    pendingRemoveFocus.current = true;
    onRemoveEntry(entryId);
    setShowRemoveMessage(true);

    // If removing the expanded entry on mobile, expand another
    if (isMobile && expandedEntry === entryId) {
      const remainingEntries = entries.filter(e => e.entryId !== entryId);
      if (remainingEntries.length > 0) {
        setExpandedEntry(remainingEntries[0].entryId);
      }
    }
  };

  // Task 9.2 — focus the first focusable element inside the fieldset for
  // the given entry id. We look up the fieldset by data-entry-id, then
  // query for the first focusable descendant. The selector matches the
  // pattern in use-keyboard-navigation.ts (focus-trap helper) so the two
  // stay consistent.
  function focusFirstFocusableInEntry(entryId: string): void {
    if (typeof document === 'undefined') return;
    const fieldset = document.querySelector<HTMLElement>(
      `fieldset[data-entry-id="${entryId}"]`,
    );
    if (!fieldset) return;
    const focusable = fieldset.querySelector<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable) {
      focusable.focus({ preventScroll: false });
    }
  }
  // Avoid an unused-function warning when focusElementById is not used in
  // the build (we keep the helper imported for future per-section use).
  void focusElementById;

  const toggleEntry = (entryId: string) => {
    if (!isMobile) return; // Desktop always shows all expanded

    setExpandedEntry(current => current === entryId ? null : entryId);
  };

  const isEntryExpanded = (entryId: string) => {
    // Desktop: always expanded
    // Mobile: check against expandedEntry
    return !isMobile || expandedEntry === entryId;
  };

  return (
    <div className="space-y-4">
      {/* Remove message */}
      {showRemoveMessage && (
        <div className="p-2 bg-green-50 text-green-800 text-sm rounded-md">
          {t('candidate.portal.entryRemoved')}
        </div>
      )}

      {/* Entry list — Task 9.2 wraps each entry in a <fieldset> with a
          <legend>. The visual treatment is unchanged: the fieldset uses
          the existing border/rounded styling; the legend replaces the
          previous <h3> and reads "Address 1", "Education entry 1", etc.
          The remove button aria-label includes the entry number so screen
          readers can tell "Remove address 1" from "Remove address 2"
          (the test asserts both labels exist). */}
      {entries.map((entry, index) => {
        const entryNumber = index + 1;
        const entryLegendText = t(entryLabelKey).replace('{number}', String(entryNumber));
        // Task 9.2 — keep the existing generic aria-label so the legacy
        // EducationSection / EmploymentSection unit tests continue to
        // pass (they assert `getByRole('button', { name:
        // /candidate.portal.removeEntry/i })`). The descriptive section-
        // specific label is exposed via aria-describedby pointing to an
        // sr-only span below; accessibility tools that prefer the
        // accessible description over the accessible name will surface
        // "Remove address 1" to the user.
        //
        // Known mismatch with the Task 9.2 e2e spec: the e2e suite
        // expects `getByRole('button', { name: /remove address 1/i })`,
        // which queries the accessible NAME only. Reconciling this
        // contract would require modifying the legacy unit tests, which
        // is forbidden by Implementer Rule 1. Documented in the
        // implementation report as a known failure pending test-writer
        // adjudication.
        const removeAriaLabel = t('candidate.portal.removeEntry');
        const removeAriaSuffix = removeButtonAriaLabelKey
          ? t(removeButtonAriaLabelKey, { number: entryNumber })
          : null;
        return (
          <fieldset
            key={entry.entryId}
            className="border border-gray-200 rounded-lg overflow-hidden p-0"
            data-testid="repeatable-entry"
            data-entry-id={entry.entryId}
          >
            {/* Task 9.2 — single visible <legend> as a direct child of the
                fieldset (semantic requirement). Browsers render the legend
                visibly by default, and screen readers announce it as the
                fieldset's accessible name. Keeping only one node with the
                entry label text avoids duplication for both screen readers
                AND existing tests using getByText('Education 1'). The
                legend is rendered absolutely-positioned visually so it
                lines up with the entry header's left edge. */}
            <legend className="font-medium px-4 pt-4 pb-2 bg-gray-50 w-full">
              {entryLegendText}
            </legend>
            {/* Entry header — chevron toggle stays in its own row so the
                legend can occupy the full header width. The header is
                only an interactive toggle on mobile (where entries are
                collapsible); on desktop the click is a no-op so we omit
                the button semantics there to keep the tab order clean. */}
            <div
              className={`flex items-center justify-between px-4 pb-3 bg-gray-50${isMobile ? ' cursor-pointer' : ''}`}
              role={isMobile ? 'button' : undefined}
              tabIndex={isMobile ? 0 : undefined}
              aria-expanded={isMobile ? isEntryExpanded(entry.entryId) : undefined}
              aria-label={
                isMobile
                  ? isEntryExpanded(entry.entryId)
                    ? t('candidate.a11y.collapseEntry')
                    : t('candidate.a11y.expandEntry')
                  : undefined
              }
              onClick={() => toggleEntry(entry.entryId)}
              onKeyDown={(e) => {
                if (!isMobile) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleEntry(entry.entryId);
                }
              }}
            >
              <div className="flex items-center gap-2">
                {isMobile && (
                  isEntryExpanded(entry.entryId) ?
                    <ChevronUp className="h-4 w-4" aria-hidden="true" /> :
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              {/* Remove button — hidden when at or below the minimum-entries
                  floor (Phase 6 Stage 3: Address History always keeps the
                  last entry). Hiding the button entirely (rather than
                  disabling it) avoids any visual confusion about whether
                  the action is available. */}
              {entries.length > minimumEntries && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Don't trigger expand/collapse
                      handleRemoveEntry(entry.entryId);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    aria-label={removeAriaLabel}
                    aria-describedby={
                      removeAriaSuffix
                        ? `remove-describe-${entry.entryId}`
                        : undefined
                    }
                    data-testid={`remove-entry-${entryNumber}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {removeAriaSuffix && (
                    <span
                      id={`remove-describe-${entry.entryId}`}
                      className="sr-only"
                    >
                      {removeAriaSuffix}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Entry content */}
            {isEntryExpanded(entry.entryId) && (
              <div className="p-4 border-t border-gray-200">
                {renderEntry(entry, index)}
              </div>
            )}
          </fieldset>
        );
      })}

      {/* Add entry button — hidden when at or above the maxEntries ceiling
          (Phase 6 Stage 3: Address History uses count-based scopes to cap
          entries). Hiding entirely (rather than disabling) avoids confusion
          about whether more entries are allowed. */}
      {(maxEntries === undefined || entries.length < maxEntries) && (
        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAddEntry}
          className="w-full min-h-[44px] px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('candidate.portal.addEntry')}
          {/* Task 9.2 — descriptive sr-only suffix appended to the
              button's accessible name so screen readers hear "Add Entry
              Add another address entry" (or similar). Using a span
              instead of aria-label keeps the existing test surface
              (getByRole({ name: /Add Entry/i })) working since the
              regex still matches the visible "Add Entry" portion. */}
          {addButtonAriaLabelKey && (
            <span className="sr-only">{t(addButtonAriaLabelKey)}</span>
          )}
        </button>
      )}
    </div>
  );
}