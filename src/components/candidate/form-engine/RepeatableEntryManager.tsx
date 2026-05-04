// /GlobalRX_v2/src/components/candidate/form-engine/RepeatableEntryManager.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
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
  maxEntries
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

      {/* Entry list */}
      {entries.map((entry, index) => (
        <div
          key={entry.entryId}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          {/* Entry header */}
          <div
            className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
            onClick={() => toggleEntry(entry.entryId)}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-medium">
                {t(entryLabelKey).replace('{number}', String(index + 1))}
              </h3>
              {isMobile && (
                isEntryExpanded(entry.entryId) ?
                  <ChevronUp className="h-4 w-4" /> :
                  <ChevronDown className="h-4 w-4" />
              )}
            </div>

            {/* Remove button — hidden when at or below the minimum-entries
                floor (Phase 6 Stage 3: Address History always keeps the
                last entry). Hiding the button entirely (rather than
                disabling it) avoids any visual confusion about whether
                the action is available. */}
            {entries.length > minimumEntries && (
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Don't trigger expand/collapse
                  handleRemoveEntry(entry.entryId);
                }}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                aria-label={t('candidate.portal.removeEntry')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Entry content */}
          {isEntryExpanded(entry.entryId) && (
            <div className="p-4 border-t border-gray-200">
              {renderEntry(entry, index)}
            </div>
          )}
        </div>
      ))}

      {/* Add entry button — hidden when at or above the maxEntries ceiling
          (Phase 6 Stage 3: Address History uses count-based scopes to cap
          entries). Hiding entirely (rather than disabling) avoids confusion
          about whether more entries are allowed. */}
      {(maxEntries === undefined || entries.length < maxEntries) && (
        <button
          ref={addButtonRef}
          onClick={handleAddEntry}
          className="w-full min-h-[44px] px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          {t('candidate.portal.addEntry')}
        </button>
      )}
    </div>
  );
}