// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type {
  CandidateFormData,
  FormSectionData,
  SavedFieldData,
} from '@/types/candidate-portal';

// Shape of a single field in the formatted response: only the fields the
// frontend needs (requirementId + value), not internal save metadata.
interface FormattedField {
  requirementId: string;
  value: SavedFieldData['value'];
}

// Shape of a single entry in the formatted response for repeatable sections
// (education, employment).
interface FormattedEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: FormattedField[];
}

// Shape of a flat (non-repeatable) section in the formatted response.
// IDV may additionally carry a countryId at the section level, which is
// preserved when present on the saved data.
interface FormattedFlatSection {
  fields: FormattedField[];
  countryId?: string | null;
}

// Shape of a repeatable section (education, employment) in the formatted
// response.
interface FormattedRepeatableSection {
  entries: FormattedEntry[];
}

// Shape of the address_history section in the formatted response (Phase 6
// Stage 3). Same per-entry layout as the repeatable sections, plus a
// top-level aggregatedFields object keyed by dsx_requirements.id with values
// for the deduplicated additional fields rendered below the entries.
interface FormattedAddressHistorySection {
  entries: FormattedEntry[];
  aggregatedFields: Record<string, SavedFieldData['value']>;
}

// Shape of a workflow section in the formatted response (Phase 6 Stage 4).
// Per spec DoD #3 and Business Rule 8, workflow-section saved data is
// presented to the client as a per-section bucket of the form
// `{ type: 'workflow_section', acknowledged: boolean }`. The saved storage
// shape (a flat-fields array with the acknowledgment as a JSON-object value
// inside the first field) is converted into this clean bucket on read so the
// shell can hydrate cleanly without inspecting per-field metadata.
interface FormattedWorkflowSection {
  type: 'workflow_section';
  acknowledged: boolean;
}

type FormattedSection =
  | FormattedFlatSection
  | FormattedRepeatableSection
  | FormattedAddressHistorySection
  | FormattedWorkflowSection;

// Shape of an entry as stored in CandidateInvitation.formData. We narrow the
// union member of FormSectionData['entries'] to a non-undefined element so we
// can type the .map callbacks without `any`.
type StoredEntry = NonNullable<FormSectionData['entries']>[number];

/**
 * GET /api/candidate/application/[token]/saved-data
 *
 * Loads the candidate's previously saved form data so the form can be
 * pre-populated when they return.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Response shape — flat-field sections (personal_info, idv, and any other
 * non-repeatable section) return:
 * {
 *   sections: {
 *     "personal_info": {
 *       fields: [{
 *         requirementId: string
 *         value: string | number | boolean | null | string[]
 *       }]
 *     },
 *     "idv": {
 *       fields: [{
 *         requirementId: string
 *         value: string | number | boolean | null | string[]
 *       }]
 *     },
 *     ...
 *   }
 * }
 *
 * Repeatable sections (education, employment) return an entries array
 * instead of a flat fields array:
 * {
 *   sections: {
 *     "education": {
 *       entries: [{
 *         entryId: string
 *         countryId: string | null
 *         entryOrder: number
 *         fields: [{
 *           requirementId: string
 *           value: string | number | boolean | null | string[] | object
 *           // Object value form (Phase 6 Stage 3) covers address_block fields
 *           // whose value is a JSON object (street/city/state/etc.).
 *         }]
 *       }]
 *     },
 *     "employment": {
 *       entries: [ ...same shape as education... ]
 *     }
 *   }
 * }
 *
 * Address-history section (Phase 6 Stage 3) returns the same per-entry shape
 * as the repeatable sections, PLUS a top-level aggregatedFields object
 * keyed by dsx_requirements.id with the values entered in the deduplicated
 * AggregatedRequirements area:
 * {
 *   sections: {
 *     "address_history": {
 *       entries: [ ...same per-entry shape as education/employment... ],
 *       aggregatedFields: { [requirementId: string]: <value> }
 *     }
 *   }
 * }
 *
 * The address_history section is NOT auto-created on first load — unlike
 * personal_info / idv, it is conditional on the package containing
 * record-type services. The structure endpoint controls whether it appears.
 *
 * Phase 7 Stage 1 also surfaces visit tracking and the Review & Submit visit
 * flag at the top level of the response (sibling to `sections`):
 * {
 *   sections: { ... },
 *   sectionVisits: {                          // empty object when unset
 *     [sectionId]: { visitedAt: ISO, departedAt: ISO | null }
 *   },
 *   reviewPageVisitedAt: ISO | null            // null until first visit
 * }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Next.js 15: params is a Promise that must be awaited
    const { token } = await params;

    // Step 1: Check for candidate session
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    const sessionData = await CandidateSessionService.getSession();

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify token matches session
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Load invitation to get saved form data
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    // Check if invitation is already completed
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json({ error: 'Invitation already completed' }, { status: 410 });
    }

    // Step 4: Extract saved data from formData
    const formData: CandidateFormData = (invitation.formData as unknown as CandidateFormData) || { sections: {} };
    const sections = formData.sections || {};
    // Phase 7 Stage 1: surface visit tracking + Review-page visit flag so the
    // portal layout can hydrate them on mount. Both keys live as siblings of
    // `sections` inside formData and are written by the new
    // `section_visit_tracking` save shape (see save/route.ts).
    const sectionVisits =
      (formData.sectionVisits as unknown as Record<
        string,
        { visitedAt: string; departedAt: string | null }
      > | undefined) ?? {};
    const reviewPageVisitedAt =
      (formData.reviewPageVisitedAt as unknown as string | null | undefined) ?? null;

    // Step 5: Format response
    // Transform saved data into the expected format
    const formattedSections: Record<string, FormattedSection> = {};

    for (const [sectionId, sectionData] of Object.entries(sections)) {
      const data: FormSectionData = sectionData as FormSectionData;

      // Determine the section type
      const sectionType = data.type || sectionId;

      // Phase 6 Stage 4: workflow-section sections are returned as
      // `{ type: 'workflow_section', acknowledged: boolean }` per BR 8.
      // The acknowledgment is read from the first field's value: when the
      // value is an object with `acknowledged === true`, the section is
      // considered acknowledged. Anything else defaults to false. The bucket
      // key on read is the workflow_sections.id (the original sectionId in
      // formData.sections) — we keep that key in the response so the shell
      // can hydrate the right section without any other lookup.
      if (sectionType === 'workflow_section') {
        let acknowledged = false;
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          const firstValue = data.fields[0].value;
          if (
            firstValue &&
            typeof firstValue === 'object' &&
            !Array.isArray(firstValue) &&
            (firstValue as { acknowledged?: unknown }).acknowledged === true
          ) {
            acknowledged = true;
          }
        }
        const workflowSection: FormattedWorkflowSection = {
          type: 'workflow_section',
          acknowledged,
        };
        formattedSections[sectionId] = workflowSection;
        continue;
      }

      // Check if this is the address_history section (Phase 6 Stage 3).
      // Returns entries (same shape as education/employment) plus an
      // aggregatedFields object for the deduplicated additional fields.
      if (sectionType === 'address_history' && data.entries) {
        // FormSectionData uses an index signature for unknown extras, so we
        // read aggregatedFields off the data and only accept it when it
        // looks like an object — defensive, since the saved JSON could in
        // principle be missing or malformed from a pre-Stage-3 invitation.
        const rawAggregated = (data as FormSectionData & {
          aggregatedFields?: unknown;
        }).aggregatedFields;
        const aggregatedFields: Record<string, SavedFieldData['value']> =
          rawAggregated && typeof rawAggregated === 'object' && !Array.isArray(rawAggregated)
            ? (rawAggregated as Record<string, SavedFieldData['value']>)
            : {};

        const addressHistorySection: FormattedAddressHistorySection = {
          entries: data.entries.map((entry: StoredEntry) => ({
            entryId: entry.entryId,
            countryId: entry.countryId,
            entryOrder: entry.entryOrder,
            fields: entry.fields.map((field: SavedFieldData) => ({
              requirementId: field.requirementId,
              value: field.value
            }))
          })),
          aggregatedFields
        };
        formattedSections[sectionType] = addressHistorySection;
      } else if ((sectionType === 'education' || sectionType === 'employment') && data.entries) {
        // Return entries array format for repeatable sections
        const repeatableSection: FormattedRepeatableSection = {
          entries: data.entries.map((entry: StoredEntry) => ({
            entryId: entry.entryId,
            countryId: entry.countryId,
            entryOrder: entry.entryOrder,
            fields: entry.fields.map((field: SavedFieldData) => ({
              requirementId: field.requirementId,
              value: field.value
            }))
          }))
        };
        formattedSections[sectionType] = repeatableSection;
      } else {
        // Handle flat fields format for non-repeatable sections.
        // We accumulate into a typed FormattedFlatSection so callers don't
        // need unsafe casts to read `countryId` or push fields.
        let flatSection = formattedSections[sectionType] as
          | FormattedFlatSection
          | undefined;
        if (!flatSection) {
          flatSection = { fields: [] };
          formattedSections[sectionType] = flatSection;
        }

        // Special handling for IDV sections - preserve countryId if present.
        // FormSectionData uses an index signature for unknown extras, so we
        // read countryId as a typed value here and only assign when it's a
        // string or null (matching FormattedFlatSection.countryId).
        if (sectionType === 'idv' && 'countryId' in data) {
          const rawCountryId = data.countryId;
          if (
            typeof rawCountryId === 'string' ||
            rawCountryId === null
          ) {
            flatSection.countryId = rawCountryId;
          }
        }

        // Add fields from this section
        if (data.fields && Array.isArray(data.fields)) {
          for (const field of data.fields as SavedFieldData[]) {
            // Only include the requirementId and value, not internal metadata
            flatSection.fields.push({
              requirementId: field.requirementId,
              value: field.value
            });
          }
        }
      }
    }

    // Always include personal_info and idv sections with empty fields if they don't exist
    // These are the core sections that the UI expects to always be present
    if (!formattedSections.personal_info) {
      formattedSections.personal_info = { fields: [] };
    }

    if (!formattedSections.idv) {
      formattedSections.idv = { fields: [] };
    }

    return NextResponse.json({
      sections: formattedSections,
      sectionVisits,
      reviewPageVisitedAt,
    });

  } catch (error) {
    logger.error('Failed to get candidate saved data', {
      event: 'candidate_saved_data_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}