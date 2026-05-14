// /GlobalRX_v2/src/types/candidate-record-search.ts
//
// Types for the Record Search Requirements section (Task 8.4).
//
// The Record Search section is a standalone Step 7 in the post-Task-8.2 nine
// step flow. It owns the deduplicated additional fields and aggregated
// documents collected from the union of countries the candidate selected in
// their Address History entries — content that used to live at the bottom of
// AddressHistorySection.
//
// Save bucket: formData.sections.record_search.fieldValues (whole-object
// replacement on each save). No backward-compat reads from
// formData.sections.address_history.aggregatedFields (plan §11.1).

import type { RepeatableFieldValue } from '@/types/candidate-repeatable-form';
import type { SectionStatus } from '@/types/candidate-stage4';
import type { SectionValidationResult } from '@/lib/candidate/validation/types';

/**
 * RecordSearchSaveRequest — re-export of the type inferred from the Zod
 * schema defined in the save-route helper module. The schema and inferred
 * type live next to the route handler (so the route can validate without a
 * cross-package import cycle); the plan §3.2 expects consumers to be able
 * to import the type from this types module, so we forward it here.
 */
export type { RecordSearchSaveRequest } from '@/app/api/candidate/application/[token]/save/recordSearchSave';

/**
 * Shape of the persisted record_search bucket as it is returned by
 * GET /api/candidate/application/[token]/saved-data.
 */
export interface RecordSearchSectionSavedData {
  sectionType: 'record_search';
  fieldValues: Record<string, RepeatableFieldValue>;
}

/**
 * Props passed to RecordSearchSection.tsx. Mirrors the shape used by sibling
 * candidate-portal sections.
 */
export interface RecordSearchSectionProps {
  token: string;
  serviceIds: string[];
  onProgressUpdate?: (status: SectionStatus) => void;
  onSaveSuccess?: () => void;
  sectionValidation?: SectionValidationResult | null;
  errorsVisible?: boolean;
}
