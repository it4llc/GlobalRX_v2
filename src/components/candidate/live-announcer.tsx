// /GlobalRX_v2/src/components/candidate/live-announcer.tsx
//
// Task 9.2 — Single aria-live="polite" region for the candidate portal.
//
// Renders once at the top of portal-layout.tsx and exposes a React Context
// so any descendant component can push announcements without prop-drilling.
// Only ONE region exists on the page (the spec asserts toHaveCount(1)); we
// use a single polite region for every announcement and a brief clear-then-
// rewrite cycle so screen readers re-announce identical strings on repeat.

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { LIVE_REGION_ID } from '@/lib/candidate/a11y-constants';
import type {
  LiveAnnouncementUrgency,
  LiveAnnouncerContextType,
} from '@/types/candidate-a11y';

const LiveAnnouncerContext = createContext<LiveAnnouncerContextType | null>(null);

/**
 * Hook that components use to push announcements. Returns a no-op if the
 * provider isn't mounted (defensive — keeps tests that mount section
 * components in isolation from blowing up).
 */
export function useLiveAnnouncer(): LiveAnnouncerContextType {
  const ctx = useContext(LiveAnnouncerContext);
  if (ctx) return ctx;
  return { announce: () => undefined };
}

interface LiveAnnouncerProviderProps {
  children: React.ReactNode;
}

export function LiveAnnouncerProvider({ children }: LiveAnnouncerProviderProps) {
  // We briefly clear the region before writing a new message — Voiceover
  // and NVDA suppress identical sequential text otherwise, so re-announcing
  // "Progress saved" twice in a row would silently drop the second pass.
  const [message, setMessage] = useState('');
  // Urgency is tracked in state so the aria-live attribute updates with
  // each announcement. "polite" is the default at idle and after every
  // polite push; "assertive" is applied for validation-error announcements
  // (e.g., "Cannot continue — N fields need attention") so screen readers
  // interrupt current speech rather than queueing behind it.
  const [urgency, setUrgency] = useState<LiveAnnouncementUrgency>('polite');
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timers on unmount so we don't call setState after the
  // component has been removed (e.g., during a hot reload in dev).
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  const announce = useCallback(
    (next: string, nextUrgency: LiveAnnouncementUrgency = 'polite') => {
      const trimmed = (next ?? '').trim();
      if (!trimmed) return;

      // Clear pending timers from any previous announcement so a rapid
      // sequence of announce() calls always lands on the last one rather
      // than racing each other.
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);

      // Step 1: clear the region. Even if it's already empty, this resets
      // the "I just announced X" memory in the screen reader. Urgency
      // updates here too so the attribute is set BEFORE the message text
      // commits — required for the assertive interruption to apply.
      setMessage('');
      setUrgency(nextUrgency);

      // Step 2: write the new message after a tick. 50ms is long enough
      // for the cleared state to take effect in the DOM and short enough
      // not to feel sluggish to a sighted user reading the same banner.
      writeTimerRef.current = setTimeout(() => {
        setMessage(trimmed);
      }, 50);
    },
    [],
  );

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* The visually-hidden live region. role mirrors urgency so screen
          readers treat assertive pushes as alerts and polite pushes as
          status updates. */}
      <div
        id={LIVE_REGION_ID}
        role={urgency === 'assertive' ? 'alert' : 'status'}
        aria-live={urgency}
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}
