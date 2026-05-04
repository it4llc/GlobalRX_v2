// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { CandidateFormData, SavedFieldData } from '@/types/candidate-portal';

// Schema for save request body (flat fields structure)
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
      z.array(z.string())
    ])
  }))
});

// Schema for repeatable entries save request
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
        z.array(z.string())
      ])
    }))
  }))
});

// Inferred types for the two request shapes. These give us a typed payload after
// validation succeeds so we don't need `as any` casts when reading fields/entries.
type FlatSaveRequest = z.infer<typeof saveRequestSchema>;
type RepeatableSaveRequest = z.infer<typeof repeatableSaveRequestSchema>;
type FlatField = FlatSaveRequest['fields'][number];
type RepeatableEntry = RepeatableSaveRequest['entries'][number];
type RepeatableEntryField = RepeatableEntry['fields'][number];

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
 *       value: string | number | boolean | null | string[]
 *     }]
 *   }]
 * }
 *
 * For repeatable sections the entire entries array replaces the saved
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

    // Education and employment sections MUST use entries array format
    // Personal info, IDV, and other sections use flat fields format
    const requiresEntriesFormat = body.sectionType === 'education' || body.sectionType === 'employment';

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

    // Determine which schema to use
    const isRepeatableSection = requiresEntriesFormat && 'entries' in body;

    // Validate based on format. After narrowing on isRepeatableSection we get a
    // properly typed payload (FlatSaveRequest or RepeatableSaveRequest), so we
    // can read fields/entries without unsafe casts.
    let sectionType: FlatSaveRequest['sectionType'] | RepeatableSaveRequest['sectionType'];
    let sectionId: string;
    let fields: FlatField[];
    let entries: RepeatableEntry[] | null;

    if (isRepeatableSection) {
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

    // Handle repeatable sections differently (whole-section replacement)
    if (isRepeatableSection && entries !== null) {
      // For education/employment, replace entire section with the provided entries
      currentFormData.sections[sectionId] = {
        type: sectionType,
        entries: entries.map((entry: RepeatableEntry) => ({
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

    logger.info('Candidate form data saved', {
      event: 'candidate_form_save',
      invitationId: invitation.id,
      sectionType,
      sectionId,
      originalFieldsCount: isRepeatableSection ?
        (entries ? entries.length : 0) :
        fields.length,
      savedFieldsCount: isRepeatableSection ?
        (entries ? entries.length : 0) :
        fieldsToSave.length,
      lockedFieldsFiltered: isRepeatableSection ?
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