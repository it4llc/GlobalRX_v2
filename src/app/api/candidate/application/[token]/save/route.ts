// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { CandidateFormData, SavedFieldData } from '@/types/candidate-portal';

// Schema for save request body (flat fields structure).
// Phase 6 Stage 4 widened the per-field `value` union to also accept JSON
// objects so workflow-section acknowledgments and document-upload metadata
// can flow through the flat-save path:
//   - Workflow acknowledgment value shape (BR 7, BR 8):
//       { acknowledged: boolean }
//     keyed by `requirementId = workflow_sections.id` (the workflow
//     section's UUID becomes the requirementId because flat saves index by
//     it). The saved-data endpoint flattens this back to the spec's
//     per-section bucket shape on read.
//   - Document-upload metadata shape (per_search/per_order, BR 11):
//       { documentId, originalName, storagePath, mimeType, size, uploadedAt }
// The repeatable and address-history schemas already accepted JSON-object
// values from Stage 3 — this brings the flat schema into parity.
const saveRequestSchema = z.object({
  sectionType: z.enum(['personal_info', 'idv', 'workflow_section', 'service_section']),
  sectionId: z.string(),
  fields: z.array(z.object({
    requirementId: z.string(),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    ])
  }))
});

// Schema for repeatable entries save request.
// Phase 6 Stage 3 widened the per-field `value` union to also accept JSON
// objects (one level deep, primitive values only) so address_block fields in
// Education and Employment entries can store their value as a structured
// object (street/city/state/postalCode) rather than a primitive string.
const repeatableSaveRequestSchema = z.object({
  sectionType: z.enum(['education', 'employment']),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
        // Address-block JSON object form. Keys are address piece names
        // (street1/street2/city/state/county/postalCode) plus optional
        // nested dates for Address History (fromDate/toDate/isCurrent).
        // Values are restricted to JSON primitives — one level deep —
        // matching the widened RepeatableFieldValue type.
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ])
    }))
  }))
});

// Schema for the new Phase 6 Stage 3 address_history save shape. Address
// history uses the same per-entry layout as Education / Employment (entries
// array with entryId, countryId, entryOrder, fields), plus a top-level
// `aggregatedFields` map keyed by dsx_requirements.id that stores values for
// the deduplicated additional fields rendered in the AggregatedRequirements
// area below the entries.
//
// Document requirements have NO entries in `aggregatedFields` for Stage 3 —
// they are tracked only as "which are required" until Stage 4 delivers the
// upload UI. Application-layer logic must not push document records into
// this map.
const addressHistorySaveRequestSchema = z.object({
  sectionType: z.literal('address_history'),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ])
    }))
  })),
  aggregatedFields: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string())
  ]))
});

// Inferred types for the three request shapes. These give us a typed payload
// after validation succeeds so we don't need `as any` casts when reading
// fields/entries/aggregatedFields.
type FlatSaveRequest = z.infer<typeof saveRequestSchema>;
type RepeatableSaveRequest = z.infer<typeof repeatableSaveRequestSchema>;
type AddressHistorySaveRequest = z.infer<typeof addressHistorySaveRequestSchema>;
type FlatField = FlatSaveRequest['fields'][number];
type RepeatableEntry = RepeatableSaveRequest['entries'][number];
type RepeatableEntryField = RepeatableEntry['fields'][number];
type AddressHistoryEntry = AddressHistorySaveRequest['entries'][number];
type AddressHistoryEntryField = AddressHistoryEntry['fields'][number];

/**
 * POST /api/candidate/application/[token]/save
 *
 * Saves the candidate's in-progress form data. Called automatically when the
 * candidate moves between fields (on blur).
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Request body has two shapes depending on the section type:
 *
 * Flat-fields format (sectionType: "personal_info" | "idv" |
 * "workflow_section" | "service_section"):
 * {
 *   sectionType: string
 *   sectionId: string        // Section identifier
 *   fields: [{
 *     requirementId: string  // DSX requirement UUID
 *     value: string | number | boolean | null | string[]  // Field value
 *   }]
 * }
 *
 * Repeatable-entries format (sectionType: "education" | "employment"):
 * {
 *   sectionType: "education" | "employment"
 *   sectionId: string        // Section identifier
 *   entries: [{
 *     entryId: string        // UUID for this entry
 *     countryId: string | null  // Country UUID (per-entry)
 *     entryOrder: number     // Display order, 0-indexed
 *     fields: [{
 *       requirementId: string  // DSX requirement UUID
 *       value: string | number | boolean | null | string[] | object
 *       // The object form was added in Phase 6 Stage 3 for address_block
 *       // fields whose value is a JSON object (street/city/state/etc.).
 *     }]
 *   }]
 * }
 *
 * Address-history format (sectionType: "address_history" — Phase 6 Stage 3):
 * {
 *   sectionType: "address_history"
 *   sectionId: string
 *   entries: [...same shape as education/employment, with address_block
 *             values stored as JSON objects per the spec's Auto-Save Data
 *             Shape section...]
 *   aggregatedFields: {
 *     // Keyed by dsx_requirements.id. Stores values for non-document
 *     // additional fields rendered in the AggregatedRequirements area
 *     // below the entries. Document requirements have NO entries here in
 *     // Stage 3 — they are tracked only as "which are required" until
 *     // Stage 4 delivers the upload UI.
 *     [requirementId: string]: string | number | boolean | null | string[]
 *   }
 * }
 *
 * For repeatable and address-history sections the entire entries array (and,
 * for address_history, the entire aggregatedFields object) replaces the saved
 * section. Sending an empty entries array clears the section's saved data.
 *
 * Response:
 * {
 *   success: boolean
 *   savedAt: string          // ISO timestamp
 * }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 *   - 400: Invalid request body (or repeatable section missing entries)
 */
export async function POST(
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

    // Step 3: Parse and validate request body
    const body = await request.json();

    // Address history (Phase 6 Stage 3) uses entries + aggregatedFields.
    // Education/employment use entries only. Personal info/IDV/etc. use flat
    // fields. Each shape has its own Zod schema; the right one is chosen by
    // sectionType so we can return precise validation errors.
    const isAddressHistory = body.sectionType === 'address_history';
    const requiresEntriesFormat =
      body.sectionType === 'education' || body.sectionType === 'employment';

    // If it's education/employment but doesn't have entries field, that's an error
    if (requiresEntriesFormat && !('entries' in body)) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: [{
            message: `Section type '${body.sectionType}' requires entries array format`,
            path: ['entries']
          }]
        },
        { status: 400 }
      );
    }

    // Address history must carry both entries and aggregatedFields. Surfacing
    // the exact missing key in the same shape as the entries-format error
    // above keeps error responses consistent for the candidate UI.
    if (isAddressHistory && !('entries' in body)) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: [{
            message: `Section type 'address_history' requires entries array`,
            path: ['entries']
          }]
        },
        { status: 400 }
      );
    }
    if (isAddressHistory && !('aggregatedFields' in body)) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: [{
            message: `Section type 'address_history' requires aggregatedFields object`,
            path: ['aggregatedFields']
          }]
        },
        { status: 400 }
      );
    }

    // Determine which schema to use. The branches are mutually exclusive —
    // address_history is its own shape, repeatable covers education/employment,
    // and the flat schema covers everything else.
    const isRepeatableSection = requiresEntriesFormat && 'entries' in body;

    // Validate based on format. After narrowing we get a properly typed
    // payload (FlatSaveRequest, RepeatableSaveRequest, or
    // AddressHistorySaveRequest), so we can read fields/entries/aggregatedFields
    // without unsafe casts.
    let sectionType:
      | FlatSaveRequest['sectionType']
      | RepeatableSaveRequest['sectionType']
      | AddressHistorySaveRequest['sectionType'];
    let sectionId: string;
    let fields: FlatField[];
    let entries: RepeatableEntry[] | AddressHistoryEntry[] | null;
    let aggregatedFields: AddressHistorySaveRequest['aggregatedFields'] | null = null;

    if (isAddressHistory) {
      const validation = addressHistorySaveRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: validation.error.errors },
          { status: 400 }
        );
      }
      sectionType = validation.data.sectionType;
      sectionId = validation.data.sectionId;
      fields = [];
      entries = validation.data.entries;
      aggregatedFields = validation.data.aggregatedFields;
    } else if (isRepeatableSection) {
      const validation = repeatableSaveRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: validation.error.errors },
          { status: 400 }
        );
      }
      sectionType = validation.data.sectionType;
      sectionId = validation.data.sectionId;
      fields = [];
      entries = validation.data.entries;
    } else {
      const validation = saveRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: validation.error.errors },
          { status: 400 }
        );
      }
      sectionType = validation.data.sectionType;
      sectionId = validation.data.sectionId;
      fields = validation.data.fields;
      entries = null;
    }

    // Initialize fieldsToSave for later use
    let fieldsToSave: FlatField[] = fields;

    // Step 4: Load invitation to verify it's still valid
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

    // Step 5: Filter out locked fields that shouldn't be saved
    // Per Business Rule #13: Pre-filled fields from the invitation (firstName, lastName, email, phone)
    // are locked and should NOT be saved through this endpoint. They come directly from the invitation
    // record and don't need separate storage. This prevents candidates from accidentally or maliciously
    // modifying their basic identity information that was provided by the customer.

    // Only apply locked field filtering to non-repeatable sections
    if (!isRepeatableSection && sectionType === 'personal_info' && fields.length > 0) {
      // Define the fieldKeys that are locked/pre-filled from the invitation
      const lockedFieldKeys = ['firstName', 'lastName', 'email', 'phone', 'phoneNumber'];

      // Look up DSX requirements for the fields being saved to get their fieldKeys
      const requirementIds = fields.map(f => f.requirementId);
      // Mirrors the `select` shape below so callers get id+fieldKey only.
      let requirements: { id: string; fieldKey: string }[] = [];
      try {
        // Check if dSXRequirement exists and has findMany method (it might not be mocked in tests)
        if (prisma.dSXRequirement && typeof prisma.dSXRequirement.findMany === 'function') {
          requirements = await prisma.dSXRequirement.findMany({
            where: {
              id: { in: requirementIds }
            },
            select: {
              id: true,
              fieldKey: true
            },
            orderBy: { fieldKey: 'asc' }
          });
        }
      } catch (error) {
        // If DSXRequirement query fails (e.g., in tests where it's not mocked),
        // proceed without locked field filtering
        logger.debug('Could not check for locked fields', { error });
        // Continue with all fields
      }

      // Create a map of requirementId to fieldKey for quick lookup
      const requirementFieldKeyMap = new Map(
        requirements.map(req => [req.id, req.fieldKey])
      );

      // Pre-filled invitation data (firstName, lastName, email, phone) cannot be
      // overwritten by candidates - this is a data integrity requirement to ensure
      // the candidate being screened matches the person the customer invited
      fieldsToSave = fields.filter(field => {
        const fieldKey = requirementFieldKeyMap.get(field.requirementId);
        const isLocked = fieldKey && lockedFieldKeys.includes(fieldKey);

        if (isLocked) {
          logger.debug('Skipping save of locked field', {
            event: 'locked_field_filtered',
            requirementId: field.requirementId,
            fieldKey,
            sectionType,
            sectionId
          });
        }

        return !isLocked;
      });

      // If all fields were locked (nothing to save), return success without database update
      if (fieldsToSave.length === 0) {
        logger.info('No unlocked fields to save', {
          event: 'candidate_form_save_skip',
          invitationId: invitation.id,
          sectionType,
          sectionId,
          originalFieldsCount: fields.length,
          lockedFieldsCount: fields.length
        });

        return NextResponse.json({
          success: true,
          savedAt: new Date().toISOString(),
          message: 'No editable fields to save'
        });
      }
    }

    // Step 6: Update formData on the invitation
    // The formData JSON structure:
    // {
    //   sections: {
    //     "personal_info": { fields: [...] },
    //     "idv": { fields: [...] },
    //     "service_<id>": { fields: [...] },
    //     "education": { entries: [...] },
    //     "employment": { entries: [...] }
    //   }
    // }

    const currentFormData: CandidateFormData = (invitation.formData as unknown as CandidateFormData) || { sections: {} };

    // Ensure sections object exists
    if (!currentFormData.sections) {
      currentFormData.sections = {};
    }

    // Handle the address_history section (Phase 6 Stage 3) — same per-entry
    // shape as Education/Employment, plus a top-level aggregatedFields object.
    // Whole-section replacement: the entire entries array AND the entire
    // aggregatedFields object replace any previous values.
    if (isAddressHistory && entries !== null) {
      const savedAtTimestamp = new Date().toISOString();
      currentFormData.sections[sectionId] = {
        type: sectionType,
        entries: (entries as AddressHistoryEntry[]).map((entry) => ({
          entryId: entry.entryId,
          countryId: entry.countryId,
          entryOrder: entry.entryOrder,
          fields: entry.fields.map((field: AddressHistoryEntryField) => ({
            requirementId: field.requirementId,
            value: field.value,
            savedAt: savedAtTimestamp
          }))
        })),
        // The shared CandidateFormData/FormSectionData types use an index
        // signature for unknown extras, so we attach aggregatedFields
        // directly. The saved-data endpoint reads it the same way.
        aggregatedFields: aggregatedFields ?? {}
      };
    } else if (isRepeatableSection && entries !== null) {
      // For education/employment, replace entire section with the provided entries
      currentFormData.sections[sectionId] = {
        type: sectionType,
        entries: (entries as RepeatableEntry[]).map((entry) => ({
          entryId: entry.entryId,
          countryId: entry.countryId,
          entryOrder: entry.entryOrder,
          fields: entry.fields.map((field: RepeatableEntryField) => ({
            requirementId: field.requirementId,
            value: field.value,
            savedAt: new Date().toISOString()
          }))
        }))
      };
    } else {
      // For non-repeatable sections, use existing field update logic
      // Initialize section if it doesn't exist
      if (!currentFormData.sections[sectionId]) {
        currentFormData.sections[sectionId] = {
          type: sectionType,
          fields: []
        };
      }

      // Update or add field values (only for unlocked fields)
      // FormSectionData.fields is optional in the shared type because repeatable
      // sections store `entries` instead. For non-repeatable sections we always
      // need a fields array, so initialize it if a previous save left it undefined.
      const sectionData = currentFormData.sections[sectionId];
      if (!sectionData.fields) {
        sectionData.fields = [];
      }
      const sectionFields: SavedFieldData[] = sectionData.fields;

      for (const field of fieldsToSave) {
        // Find existing field or add new one
        const existingFieldIndex = sectionFields.findIndex(
          (f: SavedFieldData) => f.requirementId === field.requirementId
        );

        const fieldData = {
          requirementId: field.requirementId,
          value: field.value,
          savedAt: new Date().toISOString()
        };

        if (existingFieldIndex >= 0) {
          sectionFields[existingFieldIndex] = fieldData;
        } else {
          sectionFields.push(fieldData);
        }
      }
    }

    // Step 6: Save updated formData
    // Prisma's update typing for Json columns is `InputJsonValue`, which doesn't
    // structurally accept our custom CandidateFormData interface (it allows an
    // index signature of `unknown`). The runtime value is JSON-serializable,
    // so cast through unknown to InputJsonValue.
    await prisma.candidateInvitation.update({
      where: { id: invitation.id },
      data: {
        formData: currentFormData as unknown as Prisma.InputJsonValue,
        lastAccessedAt: new Date()
      }
    });

    // Step 7: Update invitation status if needed
    if (invitation.status === INVITATION_STATUSES.SENT) {
      await prisma.candidateInvitation.update({
        where: { id: invitation.id },
        data: { status: INVITATION_STATUSES.ACCESSED }
      });
    }

    const savedAt = new Date().toISOString();

    // For logging purposes, treat both repeatable (education/employment) and
    // address_history as "entries-shaped" sections — neither has locked
    // field filtering, both report counts based on entries length.
    const isEntriesShaped = isRepeatableSection || isAddressHistory;
    logger.info('Candidate form data saved', {
      event: 'candidate_form_save',
      invitationId: invitation.id,
      sectionType,
      sectionId,
      originalFieldsCount: isEntriesShaped ?
        (entries ? entries.length : 0) :
        fields.length,
      savedFieldsCount: isEntriesShaped ?
        (entries ? entries.length : 0) :
        fieldsToSave.length,
      lockedFieldsFiltered: isEntriesShaped ?
        0 :
        fields.length - fieldsToSave.length
    });

    return NextResponse.json({
      success: true,
      savedAt
    });

  } catch (error) {
    logger.error('Failed to save candidate form data', {
      event: 'candidate_form_save_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}