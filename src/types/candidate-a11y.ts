// /GlobalRX_v2/src/types/candidate-a11y.ts
//
// Task 9.2 — Type definitions for the candidate portal accessibility system.
// These are UI-only types (no Zod schema or database mapping); they support
// the LiveAnnouncer, useFocusManagement hook, and step-heading components.

/**
 * Politeness level for an announcement pushed into the aria-live region.
 * - "polite"    → assistive tech waits for a pause before announcing.
 *                 Used for most updates (save success, scope warnings).
 * - "assertive" → interrupt current speech to announce now.
 *                 Used for critical errors (validation failure on Next).
 */
export type LiveAnnouncementUrgency = 'polite' | 'assertive';

/**
 * Shape of the React context exposed by the LiveAnnouncer provider.
 * Components anywhere in the portal tree call `announce(message)` to push
 * text into the shared live region.
 */
export interface LiveAnnouncerContextType {
  /**
   * Push a message into the live region. The component normalizes whitespace
   * and clears the region briefly before writing so screen readers re-announce
   * identical strings on repeat (Voiceover and NVDA both ignore identical
   * sequential text otherwise).
   */
  announce: (message: string, urgency?: LiveAnnouncementUrgency) => void;
}

/**
 * Options accepted by useFocusManagement for focusing an element after a
 * navigation event. The hook uses requestAnimationFrame internally as a
 * fallback to ensure the target exists before .focus() is called.
 */
export interface FocusManagementOptions {
  /** id of the element to focus. */
  targetId: string;
  /**
   * Optional delay in milliseconds. Useful when a step transition has a
   * CSS animation that briefly hides the new step's heading.
   */
  delay?: number;
}

/**
 * Per-step accessibility metadata used by the StepHeading and sidebar item
 * components. completionStatus mirrors the validation engine's lowercase
 * status vocabulary (CLAUDE.md "Status Values Are Always Lowercase").
 */
export interface StepAriaInfo {
  stepNumber: number;
  totalSteps: number;
  stepTitle: string;
  completionStatus: 'complete' | 'incomplete' | 'not_started' | 'has_errors';
}
