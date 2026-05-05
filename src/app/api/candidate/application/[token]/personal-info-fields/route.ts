// /GlobalRX_v2/src/app/api/candidate/application/[token]/personal-info-fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { FieldMetadata } from '@/types/candidate-portal';

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
 *     isRequired: boolean      // Whether the field is baseline-required for
 *                              // this candidate's package context. True only
 *                              // when every dsx_mappings row for this
 *                              // requirement (filtered to the candidate's
 *                              // package services AND their available,
 *                              // non-disabled locations) has isRequired=true.
 *                              // Defaults to false when no applicable
 *                              // mappings exist. Conditional, country-specific
 *                              // requirements are layered on top of this
 *                              // baseline by the cross-section registry.
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
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
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
    type ServiceRequirementWithDSX = Prisma.ServiceRequirementGetPayload<{
      include: { requirement: true }
    }>;
    const personalInfoFields = new Map<string, {
      requirement: ServiceRequirementWithDSX['requirement'],
      displayOrder: number
    }>();

    for (const serviceReq of serviceRequirements) {
      const fieldData: FieldMetadata = (serviceReq.requirement.fieldData as unknown as FieldMetadata) || {};

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

    // Step 6.5: Resolve isRequired from dsx_mappings using context-aware AND
    // logic.
    //
    // AND logic: a field is baseline-required only if ALL applicable mapping
    // rows for the candidate's package context have isRequired=true.
    // "Applicable" means rows whose (serviceId, locationId) pair is in the
    // candidate's package services AND a country.disabled IS NOT TRUE
    // location where dsx_availability.isAvailable=true. Mappings that don't
    // exist for a given (service, location) pair are not considered (a
    // missing row is not penalized as "required" or "not required" — it's
    // simply absent from the AND). The cross-section registry layers
    // conditional country requirements on top of this baseline at runtime.
    //
    // Previously this used OR logic against every mapping in the database
    // for a requirement, which made any field required globally as soon as
    // it was required in a single (service, location) row anywhere — see
    // TD-060.
    const personalInfoRequirementIds = Array.from(personalInfoFields.keys());

    // First, find the (service, location) pairs that are valid for this
    // candidate's package: services in the package, where the location is
    // not globally disabled and the service is actually available there.
    // Country.disabled is nullable, so `NOT: { disabled: true }` correctly
    // includes both disabled=false rows and disabled IS NULL rows
    // (DATABASE_STANDARDS Section 2.x; spec Edge Case 5).
    const availabilityRows = personalInfoRequirementIds.length > 0
      ? (await prisma.dSXAvailability.findMany({
          where: {
            serviceId: { in: serviceIds },
            isAvailable: true,
            country: { NOT: { disabled: true } },
          },
          select: { serviceId: true, locationId: true },
        })) ?? []
      : [];

    const requiredByRequirementId = new Map<string, boolean>();

    if (personalInfoRequirementIds.length > 0 && availabilityRows.length > 0) {
      // Build the explicit (serviceId, locationId) pair list and query
      // dsx_mappings with an OR-of-pairs filter. Per the unique constraint
      // @@unique([serviceId, locationId, requirementId]) on dsx_mappings,
      // each (serviceId, locationId, requirementId) triple is unique, so
      // the resulting set has no duplicates that would skew aggregation.
      const pairFilters = availabilityRows.map(row => ({
        serviceId: row.serviceId,
        locationId: row.locationId,
      }));

      const dsxMappings = await prisma.dSXMapping.findMany({
        where: {
          requirementId: { in: personalInfoRequirementIds },
          OR: pairFilters,
        },
        select: {
          requirementId: true,
          serviceId: true,
          locationId: true,
          isRequired: true,
        },
      });

      // Group mapping rows by requirementId, then AND-aggregate isRequired
      // across the group. A requirement with zero applicable mapping rows
      // stays absent from the map and falls through to the default of
      // false in the response builder below (Edge Case 3 / Business Rule 3).
      const mappingsByRequirementId = new Map<string, boolean[]>();
      for (const mapping of dsxMappings ?? []) {
        const existing = mappingsByRequirementId.get(mapping.requirementId) ?? [];
        existing.push(mapping.isRequired);
        mappingsByRequirementId.set(mapping.requirementId, existing);
      }

      for (const [requirementId, flags] of mappingsByRequirementId.entries()) {
        // AND across the group: required only if every applicable row says
        // so. An empty group should not occur here (Map only contains keys
        // we pushed to), but if it ever did, every() over [] returns true
        // — guard explicitly so the empty-group case stays false.
        const baselineRequired = flags.length > 0 && flags.every(Boolean);
        requiredByRequirementId.set(requirementId, baselineRequired);
      }
    }
    // If availabilityRows is empty (e.g., none of the candidate's services
    // are available in any non-disabled location), every personal-info
    // field falls back to isRequired=false via the default lookup at line
    // ~262 below — matching spec Edge Cases 1, 2.

    // Step 7: Build response with pre-fill and lock information
    const fields = Array.from(personalInfoFields.values())
      .map(({ requirement, displayOrder }) => {
        const fieldData: FieldMetadata = (requirement.fieldData as unknown as FieldMetadata) || {};
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

        const isRequired = requiredByRequirementId.get(requirement.id) ?? false;

        return {
          requirementId: requirement.id,
          name: requirement.name,
          fieldKey: requirement.fieldKey,
          dataType: fieldData.dataType || 'text',
          isRequired,
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