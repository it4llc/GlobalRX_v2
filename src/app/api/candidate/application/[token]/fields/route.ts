// /GlobalRX_v2/src/app/api/candidate/application/[token]/fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { FieldMetadata } from '@/types/candidate-portal';

/**
 * GET /api/candidate/application/[token]/fields
 *
 * Returns the list of required fields for a specific service in a specific country.
 * The candidate's form calls this to find out what fields to display.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Query parameters:
 *   - serviceId: The service ID to get fields for (required)
 *   - countryId: The country ID to get fields for (required)
 *
 * Response shape:
 * {
 *   fields: [{
 *     requirementId: string     // DSX requirement UUID
 *     name: string             // Display name
 *     fieldKey: string         // Unique field key
 *     type: string             // "field" or "document"
 *     dataType: string         // text, date, number, etc.
 *     isRequired: boolean      // Whether field is required
 *     instructions: string | null
 *     fieldData: object        // Complete fieldData from DSX
 *     documentData: object | null
 *     displayOrder: number
 *   }]
 * }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 *   - 400: Missing serviceId or countryId
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

    // Step 3: Get query parameters
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const countryId = searchParams.get('countryId');

    if (!serviceId || !countryId) {
      return NextResponse.json(
        { error: 'Missing serviceId or countryId parameter' },
        { status: 400 }
      );
    }

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

    // Step 5: Get DSX requirements for this service and country
    // First, get location-specific requirements from DSXMapping
    const locationMappings = await prisma.dSXMapping.findMany({
      where: {
        serviceId,
        locationId: countryId,
      },
      include: {
        requirement: true
      },
      orderBy: {
        requirement: {
          name: 'asc'
        }
      }
    });

    // Also get universal requirements (not location-specific) from ServiceRequirement
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: {
        serviceId,
        requirement: {
          disabled: false
        }
      },
      include: {
        requirement: true
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });

    // Combine and deduplicate requirements
    const allRequirements = new Map<string, any>();

    // Add location-specific requirements first (they take precedence)
    for (const mapping of locationMappings) {
      if (!mapping.requirement.disabled) {
        allRequirements.set(mapping.requirement.id, {
          requirement: mapping.requirement,
          isRequired: mapping.isRequired,
          displayOrder: 999 // Location-specific requirements don't have displayOrder in mapping
        });
      }
    }

    // Add service-level requirements (if not already present from location mapping)
    for (const serviceReq of serviceRequirements) {
      if (!allRequirements.has(serviceReq.requirement.id)) {
        allRequirements.set(serviceReq.requirement.id, {
          requirement: serviceReq.requirement,
          isRequired: true, // Service-level requirements are assumed required
          displayOrder: serviceReq.displayOrder
        });
      }
    }

    // Step 6: Format the response
    const fields = Array.from(allRequirements.values())
      .map(({ requirement, isRequired, displayOrder }) => {
        // Parse fieldData to get dataType and other metadata
        const fieldData: FieldMetadata = (requirement.fieldData as unknown as FieldMetadata) || {};

        return {
          requirementId: requirement.id,
          name: requirement.name,
          fieldKey: requirement.fieldKey,
          type: requirement.type,
          dataType: fieldData.dataType || 'text',
          isRequired,
          instructions: fieldData.instructions || null,
          fieldData: requirement.fieldData, // Return complete fieldData as-is
          documentData: requirement.documentData,
          displayOrder
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({ fields });

  } catch (error) {
    logger.error('Failed to get candidate fields', {
      event: 'candidate_fields_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}