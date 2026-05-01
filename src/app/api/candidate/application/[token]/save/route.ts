// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { CandidateFormData, SavedFieldData } from '@/types/candidate-portal';

// Schema for save request body
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

/**
 * POST /api/candidate/application/[token]/save
 *
 * Saves the candidate's in-progress form data. Called automatically when the
 * candidate moves between fields (on blur).
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Request body:
 * {
 *   sectionType: "personal_info" or "idv" or "service_section"
 *   sectionId: string        // Section identifier
 *   fields: [{
 *     requirementId: string  // DSX requirement UUID
 *     value: string | number | boolean | null | string[]  // Field value
 *   }]
 * }
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
 *   - 400: Invalid request body
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
    const validation = saveRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { sectionType, sectionId, fields } = validation.data;

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

    let fieldsToSave = fields;

    // Only check for locked fields if we're saving personal_info section and have fields to check
    if (sectionType === 'personal_info' && fields.length > 0) {
      // Define the fieldKeys that are locked/pre-filled from the invitation
      const lockedFieldKeys = ['firstName', 'lastName', 'email', 'phone', 'phoneNumber'];

      // Look up DSX requirements for the fields being saved to get their fieldKeys
      const requirementIds = fields.map(f => f.requirementId);
      const requirements = await prisma.dSXRequirement.findMany({
        where: {
          id: { in: requirementIds }
        },
        select: {
          id: true,
          fieldKey: true
        }
      });

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
    //     "service_<id>": { fields: [...] }
    //   }
    // }

    const currentFormData: CandidateFormData = (invitation.formData as unknown as CandidateFormData) || { sections: {} };

    // Ensure sections object exists
    if (!currentFormData.sections) {
      currentFormData.sections = {};
    }

    // Initialize section if it doesn't exist
    if (!currentFormData.sections[sectionId]) {
      currentFormData.sections[sectionId] = {
        type: sectionType,
        fields: []
      };
    }

    // Update or add field values (only for unlocked fields)
    const sectionData = currentFormData.sections[sectionId];

    for (const field of fieldsToSave) {
      // Find existing field or add new one
      const existingFieldIndex = sectionData.fields.findIndex(
        (f: SavedFieldData) => f.requirementId === field.requirementId
      );

      const fieldData = {
        requirementId: field.requirementId,
        value: field.value,
        savedAt: new Date().toISOString()
      };

      if (existingFieldIndex >= 0) {
        sectionData.fields[existingFieldIndex] = fieldData;
      } else {
        sectionData.fields.push(fieldData);
      }
    }

    // Step 6: Save updated formData
    await prisma.candidateInvitation.update({
      where: { id: invitation.id },
      data: {
        formData: currentFormData,
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
      originalFieldsCount: fields.length,
      savedFieldsCount: fieldsToSave.length,
      lockedFieldsFiltered: fields.length - fieldsToSave.length
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