// /GlobalRX_v2/src/lib/candidate/a11y-constants.ts
//
// Task 9.2 — Accessibility constants for the candidate portal.
// Single source of truth for ARIA element IDs, landmark labels, and live
// region identifiers used across the candidate application's 9 steps. By
// keeping these centralized we avoid the failure mode where a typo in
// `aria-controls` and a typo in the corresponding element `id` cancel each
// other out silently.

/**
 * The id assigned to the main content container in portal-layout.tsx.
 * The skip link uses this as its anchor target; the URL fragment becomes
 * `#main-content` after the user activates the link.
 */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * The id of the single LiveAnnouncer DOM element rendered once at the top
 * of the portal layout. All announcement helpers push text into this node.
 */
export const LIVE_REGION_ID = 'candidate-live-region';

/**
 * The id of the mobile sidebar drawer. The hamburger button's aria-controls
 * attribute points here so assistive technology knows which element the
 * button toggles.
 */
export const MOBILE_SIDEBAR_ID = 'candidate-mobile-sidebar';

/**
 * The id of the helper text that explains why the Submit button is
 * disabled on the Review & Submit page. The Submit button's
 * aria-describedby attribute points here.
 */
export const SUBMIT_DISABLED_DESCRIBEDBY_ID = 'submit-disabled-description';
