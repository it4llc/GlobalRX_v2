// /GlobalRX_v2/src/app/api/candidate/application/[token]/personal-info-fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * GET /api/candidate/application/[token]/personal-info-fields
 *
 * Returns the list of personal information fields that the candidate needs to fill in.
 * These are fields from across all services in the package where the DSX collectionTab
 * indicates they belong on the personal info tab.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Response shape:
 * {
 *   fields: [{
 *     requirementId: string     // DSX requirement UUID
 *     name: string             // Display name
 *     fieldKey: string         // Unique field key
 *     dataType: string         // text, date, number, etc.
 *     isRequired: boolean      // Whether field is required
 *     instructions: string | null
 *     fieldData: object        // Complete fieldData from DSX
 *     displayOrder: number
 *     locked: boolean          // Whether field is pre-filled and locked
 *     prefilledValue: string | null // Pre-filled value from invitation
 *   }]
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

    // Step 3: Load invitation with package and services
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
      include: {
        package: {
          include: {
            packageServices: {
              include: {
                service: true
              }
            }
          }
        }
      }
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

    // Step 4: Get all services in the package
    const serviceIds = invitation.package?.packageServices.map(ps => ps.service.id) || [];

    if (serviceIds.length === 0) {
      return NextResponse.json({ fields: [] });
    }

    // Step 5: Get all requirements for these services that belong to personal info tab
    // We need to check the collectionTab value in fieldData
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: {
        serviceId: {
          in: serviceIds
        },
        requirement: {
          disabled: false,
          type: 'field' // Only field requirements, not documents
        }
      },
      include: {
        requirement: true
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });

    // Step 6: Filter for personal info fields and deduplicate
    const personalInfoFields = new Map<string, any>();

    for (const serviceReq of serviceRequirements) {
      const fieldData = serviceReq.requirement.fieldData as any || {};

      // Check if this field belongs to personal info tab
      // The actual collectionTab value needs to be checked from live data
      // Common values might be: "personal_info", "subject", "personal", "Personal Info"
      const collectionTab = fieldData.collectionTab || fieldData.collection_tab || '';

      // For now, we'll consider fields with common personal info field keys
      // This is a fallback approach until we can query the actual collectionTab values
      const isPersonalInfoField =
        collectionTab.toLowerCase().includes('personal') ||
        collectionTab.toLowerCase().includes('subject') ||
        ['firstName', 'lastName', 'middleName', 'email', 'phone', 'phoneNumber',
         'dateOfBirth', 'birthDate', 'dob', 'ssn', 'socialSecurityNumber'].includes(serviceReq.requirement.fieldKey);

      if (isPersonalInfoField && !personalInfoFields.has(serviceReq.requirement.id)) {
        personalInfoFields.set(serviceReq.requirement.id, {
          requirement: serviceReq.requirement,
          displayOrder: serviceReq.displayOrder
        });
      }
    }

    // Step 7: Build response with pre-fill and lock information
    const fields = Array.from(personalInfoFields.values())
      .map(({ requirement, displayOrder }) => {
        const fieldData = requirement.fieldData as any || {};
        const fieldKey = requirement.fieldKey;

        // Determine if this field is pre-filled from invitation
        let locked = false;
        let prefilledValue = null;

        // Map invitation fields to DSX fields by fieldKey
        switch (fieldKey) {
          case 'firstName':
            locked = true;
            prefilledValue = invitation.firstName;
            break;
          case 'lastName':
            locked = true;
            prefilledValue = invitation.lastName;
            break;
          case 'email':
            locked = true;
            prefilledValue = invitation.email;
            break;
          case 'phone':
          case 'phoneNumber':
            if (invitation.phoneNumber) {
              locked = true;
              prefilledValue = invitation.phoneCountryCode
                ? `${invitation.phoneCountryCode}${invitation.phoneNumber}`
                : invitation.phoneNumber;
            }
            break;
        }

        return {
          requirementId: requirement.id,
          name: requirement.name,
          fieldKey: requirement.fieldKey,
          dataType: fieldData.dataType || 'text',
          isRequired: true, // Personal info fields are typically required
          instructions: fieldData.instructions || null,
          fieldData: requirement.fieldData, // Return complete fieldData as-is
          displayOrder,
          locked,
          prefilledValue
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({ fields });

  } catch (error) {
    logger.error('Failed to get candidate personal info fields', {
      event: 'candidate_personal_info_fields_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}