// /GlobalRX_v2/src/lib/candidate/sectionVisitTracking.ts
//
// Phase 7 Stage 1 — pure helpers for merging visit records into the
// CandidateInvitation.formData JSON column and for deciding whether a
// section is "visited and departed" or whether the Review & Submit page has
// been visited.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 1, 2, 3, 8, 11, 34)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §1, §3.2
//
// Used by:
//   - The save route handler (server-side merge of incoming visit data)
//   - The portal layout client (state derivation for error-display gating)

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SectionVisitRecord {
  visitedAt: string;        // ISO 8601 timestamp
  departedAt: string | null; // ISO 8601 timestamp; null until first departure
}

export type SectionVisitsMap = Record<string, SectionVisitRecord>;

export interface IncomingVisitUpdate {
  sectionId: string;
  visitedAt: string;
  departedAt: string | null;
}

// ---------------------------------------------------------------------------
// mergeSectionVisits
// ---------------------------------------------------------------------------

/**
 * Merge incoming visit updates into the existing visits map. Two key rules:
 *
 *   1. `visitedAt` is only set on first visit. If the section already has a
 *      visit record, the existing visitedAt is preserved (we don't reset it).
 *   2. `departedAt`, once set to a non-null value, is never cleared back to
 *      null. Subsequent updates may push it forward to a later departure,
 *      but they may not "un-depart" the section.
 *
 * Returns a NEW visits map; the input is not mutated.
 */
export function mergeSectionVisits(
  existing: SectionVisitsMap | undefined,
  updates: IncomingVisitUpdate[],
): SectionVisitsMap {
  const merged: SectionVisitsMap = { ...(existing ?? {}) };

  for (const upd of updates) {
    const prev = merged[upd.sectionId];

    if (!prev) {
      // First-ever record for this section — accept as-is.
      merged[upd.sectionId] = {
        visitedAt: upd.visitedAt,
        departedAt: upd.departedAt,
      };
      continue;
    }

    // Preserve the original visitedAt (Rule 2 — visit-and-departure flag is
    // permanent once set; we don't track multiple visit times).
    const visitedAt = prev.visitedAt;

    // departedAt: once non-null, never clear. If the incoming value is null
    // and the existing value is non-null, keep the existing. If both are
    // non-null, take whichever is later.
    let departedAt: string | null;
    if (prev.departedAt === null) {
      departedAt = upd.departedAt;
    } else if (upd.departedAt === null) {
      departedAt = prev.departedAt;
    } else {
      departedAt = upd.departedAt > prev.departedAt ? upd.departedAt : prev.departedAt;
    }

    merged[upd.sectionId] = { visitedAt, departedAt };
  }

  return merged;
}

// ---------------------------------------------------------------------------
// mergeReviewPageVisitedAt
// ---------------------------------------------------------------------------

/**
 * Apply a Review & Submit visit timestamp to the existing value. Once the
 * existing value is non-null, it is permanent (Rule 3): subsequent calls
 * with null are ignored, and subsequent calls with non-null preserve the
 * earlier (existing) value.
 */
export function mergeReviewPageVisitedAt(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  if (existing) return existing;
  if (incoming) return incoming;
  return null;
}

// ---------------------------------------------------------------------------
// Visit-state queries
// ---------------------------------------------------------------------------

/**
 * Determine whether errors should be displayed for the given section. Per
 * Rule 4/8 errors only show after the section has been "visited and
 * departed" — OR after the candidate has visited the Review & Submit page
 * at least once (Rule 3 / Rule 34).
 */
export function shouldShowErrorsForSection(
  sectionId: string,
  sectionVisits: SectionVisitsMap | undefined,
  reviewPageVisitedAt: string | null | undefined,
): boolean {
  if (reviewPageVisitedAt) return true;
  const visit = sectionVisits?.[sectionId];
  return !!visit && visit.departedAt !== null;
}

/**
 * Returns true if the candidate has ever visited the Review & Submit page.
 * Once true, always true (Rule 3 / Rule 34).
 */
export function hasVisitedReviewPage(
  reviewPageVisitedAt: string | null | undefined,
): boolean {
  return !!reviewPageVisitedAt;
}
