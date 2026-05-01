// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * GET /api/candidate/application/[token]/saved-data
 *
 * Loads the candidate's previously saved form data so the form can be
 * pre-populated when they return.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Response shape:
 * {
 *   sections: {
 *     "personal_info": {
 *       fields: [{
 *         requirementId: string
 *         value: any
 *       }]
 *     },
 *     "idv": {
 *       fields: [{
 *         requirementId: string
 *         value: any
 *       }]
 *     },
 *     ...
 *   }
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
    if (invitation.status === 'completed') {
      return NextResponse.json({ error: 'Invitation already completed' }, { status: 410 });
    }

    // Step 4: Extract saved data from formData
    const formData = (invitation.formData as any) || { sections: {} };
    const sections = formData.sections || {};

    // Step 5: Format response
    // Transform saved data into the expected format
    const formattedSections: Record<string, any> = {};

    for (const [sectionId, sectionData] of Object.entries(sections)) {
      const data = sectionData as any;

      // Group by section type for cleaner response
      const sectionType = data.type || sectionId;

      if (!formattedSections[sectionType]) {
        formattedSections[sectionType] = {
          fields: []
        };
      }

      // Add fields from this section
      if (data.fields && Array.isArray(data.fields)) {
        for (const field of data.fields) {
          // Only include the requirementId and value, not internal metadata
          formattedSections[sectionType].fields.push({
            requirementId: field.requirementId,
            value: field.value
          });
        }
      }
    }

    // Ensure standard sections exist even if empty
    if (!formattedSections.personal_info) {
      formattedSections.personal_info = { fields: [] };
    }
    if (!formattedSections.idv) {
      formattedSections.idv = { fields: [] };
    }

    return NextResponse.json({ sections: formattedSections });

  } catch (error) {
    logger.error('Failed to get candidate saved data', {
      event: 'candidate_saved_data_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}