// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';

// Schema for save request body
const saveRequestSchema = z.object({
  sectionType: z.enum(['personal_info', 'idv', 'workflow_section', 'service_section']),
  sectionId: z.string(),
  fields: z.array(z.object({
    requirementId: z.string(),
    value: z.any()
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
 *     value: any             // Field value
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
    if (invitation.status === 'completed') {
      return NextResponse.json({ error: 'Invitation already completed' }, { status: 410 });
    }

    // Step 5: Update formData on the invitation
    // The formData JSON structure:
    // {
    //   sections: {
    //     "personal_info": { fields: [...] },
    //     "idv": { fields: [...] },
    //     "service_<id>": { fields: [...] }
    //   }
    // }

    const currentFormData = (invitation.formData as any) || { sections: {} };

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

    // Update or add field values
    const sectionData = currentFormData.sections[sectionId];

    for (const field of fields) {
      // Find existing field or add new one
      const existingFieldIndex = sectionData.fields.findIndex(
        (f: any) => f.requirementId === field.requirementId
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
    if (invitation.status === 'sent') {
      await prisma.candidateInvitation.update({
        where: { id: invitation.id },
        data: { status: 'in_progress' }
      });
    }

    const savedAt = new Date().toISOString();

    logger.info('Candidate form data saved', {
      event: 'candidate_form_save',
      invitationId: invitation.id,
      sectionType,
      sectionId,
      fieldsCount: fields.length
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