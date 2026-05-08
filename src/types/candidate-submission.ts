// /GlobalRX_v2/src/types/candidate-submission.ts
//
// Phase 7 Stage 2 — public TypeScript shapes for the candidate submit
// endpoint's request/response surface.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §6
//
// Why TypeScript interfaces and not Zod schemas:
//   The submit endpoint takes NO request body — these types describe the
//   server's response payloads, not validated client inputs. Per
//   CODING_STANDARDS.md §3.4, Zod is for I/O boundary inputs only.

import type { FullValidationResult } from '@/lib/candidate/validation/types';

// ---------------------------------------------------------------------------
// Individual response shapes
// ---------------------------------------------------------------------------

export interface SubmitSuccessResponse {
  success: true;
  message: string;
  redirectTo: string;
}

export interface SubmitAlreadySubmittedResponse {
  success: true;
  message: string;
  redirectTo: string;
}

export interface SubmitValidationFailureResponse {
  success: false;
  error: 'Validation failed';
  validationResult: FullValidationResult;
}

export interface SubmitExpiredResponse {
  success: false;
  error: 'This invitation has expired';
}

export interface SubmitErrorResponse {
  success: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Discriminated union — every shape the candidate's browser may receive.
// ---------------------------------------------------------------------------

export type SubmitResponse =
  | SubmitSuccessResponse
  | SubmitAlreadySubmittedResponse
  | SubmitValidationFailureResponse
  | SubmitExpiredResponse
  | SubmitErrorResponse;
