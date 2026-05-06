// /GlobalRX_v2/src/lib/candidate/validation/types.ts
//
// Phase 7 Stage 1 validation engine — shared TypeScript types and constants.
//
// Imported by every other module under src/lib/candidate/validation/, plus
// the new /api/candidate/application/[token]/validate route, plus the
// Review & Submit page components.
//
// Spec:
//   docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan:
//   docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.1
//
// Why these are TypeScript interfaces and not Zod schemas:
//   They describe the OUTPUTS of pure validation functions (server-internal),
//   not inputs from untrusted callers. Coding Standards §3.4 — Zod is for
//   I/O boundary data only.

import type { SectionStatus } from '@/types/candidate-stage4';

// ---------------------------------------------------------------------------
// Status alias
// ---------------------------------------------------------------------------

// Re-exported alias so the rest of the validation engine can refer to a
// "ValidationStatus" without dragging in the `candidate-stage4` import path.
// Identical to the Phase 6 Stage 4 SectionStatus — `'not_started' |
// 'incomplete' | 'complete'`.
export type ValidationStatus = SectionStatus;

// ---------------------------------------------------------------------------
// Per-section error shapes
// ---------------------------------------------------------------------------

export interface FieldError {
  fieldName: string;
  messageKey: string;
  placeholders?: Record<string, string | number>;
}

export interface ScopeError {
  messageKey: string;
  placeholders: Record<string, string | number>;
}

export interface GapError {
  messageKey: string;
  placeholders: Record<string, string | number>;
  // ISO date strings (calendar date, no time component) so the frontend can
  // localize them at render time.
  gapStart: string;
  gapEnd: string;
  gapDays: number;
}

export interface DocumentError {
  requirementId: string;
  documentNameKey: string;
}

// ---------------------------------------------------------------------------
// Per-section validation result
// ---------------------------------------------------------------------------

export interface SectionValidationResult {
  sectionId: string;
  status: ValidationStatus;
  fieldErrors: FieldError[];
  scopeErrors: ScopeError[];
  gapErrors: GapError[];
  documentErrors: DocumentError[];
}

// ---------------------------------------------------------------------------
// Review-page summary shape
// ---------------------------------------------------------------------------

// A discriminated union of every error kind the Review & Submit page renders
// as one navigable line item. Defined here (rather than in the page component)
// so the API route's response shape matches the validation engine's output.
export type ReviewError =
  | {
      kind: 'field';
      fieldName: string;
      messageKey: string;
      placeholders?: Record<string, string | number>;
    }
  | {
      kind: 'scope';
      messageKey: string;
      placeholders: Record<string, string | number>;
    }
  | {
      kind: 'gap';
      messageKey: string;
      placeholders: Record<string, string | number>;
      gapStart: string;
      gapEnd: string;
    }
  | {
      kind: 'document';
      requirementId: string;
      documentNameKey: string;
    };

export interface ReviewPageSummary {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    status: ValidationStatus;
    errors: ReviewError[];
  }>;
  allComplete: boolean;
  totalErrors: number;
}

// ---------------------------------------------------------------------------
// Top-level validation result
// ---------------------------------------------------------------------------

export interface FullValidationResult {
  sections: SectionValidationResult[];
  summary: ReviewPageSummary;
}

// ---------------------------------------------------------------------------
// Field-format inference
// ---------------------------------------------------------------------------

export type FieldFormat = 'email' | 'phone' | 'date' | 'url' | 'numeric';

// ---------------------------------------------------------------------------
// Date-extractor input/output shapes
// ---------------------------------------------------------------------------

// Generic "saved entry" shape used by the date extractors. Mirrors the
// per-entry shape the saved-data endpoint returns:
//   - For Address History, fields[address_block_requirement_id] is a JSON
//     object containing fromDate / toDate / isCurrent.
//   - For Employment History, fields[<startDateRequirementId>] is a primitive
//     date string, and the currentlyEmployed flag lives in another field.
//
// The date extractors take the entry plus a hint about which field IDs map to
// what role and return a uniform { start, end, isCurrent } shape.
export interface SavedEntry {
  entryOrder: number;
  fields: Record<string, unknown>;
}

export interface FieldLike {
  fieldKey: string;
  type?: string;
  fieldData?: { format?: string } | null;
}

// ---------------------------------------------------------------------------
// Scope evaluation input shapes
// ---------------------------------------------------------------------------

// Caller-supplied minimal entry shape for count-based scope evaluation.
// Even an entry with empty fields counts toward the total (Spec Rule 16).
export interface EntryLike {
  entryOrder: number;
}

// Caller-supplied minimal entry shape for time-based scope evaluation. The
// caller is responsible for extracting dates (use dateExtractors.ts).
export interface DatedEntryLike {
  start: Date | null;
  end: Date | null;
  isCurrent: boolean;
}
