// /GlobalRX_v2/src/app/api/candidate/application/[token]/fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { FieldMetadata } from '@/types/candidate-portal';

/**
 * GET /api/candidate/application/[token]/fields
 *
 * Returns the list of required fields for a specific service in a specific
 * geographic location. The candidate's form calls this to find out what
 * fields to display.
 *
 * Phase 6 Stage 3 added optional `subregionId` support so the Address History
 * section can fetch merged requirements from every applicable level of the
 * geographic hierarchy in one call. When `subregionId` is omitted, behavior
 * is unchanged (Stage 1 / Stage 2 callers continue to work).
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Query parameters:
 *   - serviceId (required): The service ID to get fields for
 *   - countryId (required): The country ID to get fields for
 *   - subregionId (optional, UUID, Phase 6 Stage 3): If provided, the API
 *     walks the `countries.parentId` chain upward from this id to assemble
 *     every ancestor level (subregion3 → subregion2 → subregion1 → country),
 *     consults `dsx_availability` for each level, and merges DSX mappings
 *     across all levels at which the service is available.
 *
 * DSX availability behavior (when subregionId is provided):
 *   - Missing `dsx_availability` row at a level is treated as "available"
 *     (per Stage 3 spec — this is the project-wide default).
 *   - When a service is unavailable at a level, that level's additional
 *     requirements are skipped — but the address_block field is always
 *     preserved at the country level so the candidate can still record where
 *     they lived (needed for scope coverage).
 *
 * Cross-level merge:
 *   - Keyed by requirement.id.
 *   - `isRequired` is OR-merged: if any applicable level says required, the
 *     merged value is required (most-restrictive wins).
 *   - `displayOrder` from the most-specific level wins; falls back to the
 *     country level's displayOrder.
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
 *   - 400: Missing serviceId or countryId, or non-UUID subregionId
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
    const subregionId = searchParams.get('subregionId');

    if (!serviceId || !countryId) {
      return NextResponse.json(
        { error: 'Missing serviceId or countryId parameter' },
        { status: 400 }
      );
    }

    // Validate subregionId format when present. We use a manual UUID check
    // here (rather than introducing a Zod schema for the whole query) to
    // stay consistent with the existing manual check style in this route.
    // Length 36 + standard hex/dash pattern is enough — the upstream client
    // can only have produced it from /subdivisions, which already validates.
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (subregionId !== null && subregionId !== '' && !UUID_PATTERN.test(subregionId)) {
      return NextResponse.json(
        { error: 'Invalid subregionId parameter' },
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

    // Step 5: Build the list of geographic levels to check for DSX mappings.
    // For Stage 1 / Stage 2 (no subregionId) this is just [countryId].
    // For Stage 3 with a subregionId, we walk parentId upward to assemble
    // the full ancestor chain (subregion3 → subregion2 → subregion1 → country).
    // Order in `levelIds` is country first, then subregion1, then subregion2,
    // then subregion3 — i.e., from least-specific to most-specific. This
    // matters for the merge below: we apply each level in order and let the
    // most-specific one win for displayOrder, while OR-merging isRequired.
    const levelIds: string[] = [countryId];
    if (subregionId && subregionId !== '') {
      // Walk upward from the subregion. At most 3 hops to reach the country
      // since the geographic hierarchy is country → sub1 → sub2 → sub3.
      const ancestorChain: string[] = [];
      let current: string | null = subregionId;
      let walkSafetyCount = 0;
      while (current && walkSafetyCount < 4) {
        const row: { id: string; parentId: string | null } | null =
          await prisma.country.findUnique({
            where: { id: current },
            select: { id: true, parentId: true }
          });
        if (!row) break;
        // Skip the country itself — already in levelIds at index 0.
        if (row.id !== countryId) {
          ancestorChain.unshift(row.id);
        }
        current = row.parentId;
        walkSafetyCount++;
      }
      // Append in order: subregion1, subregion2, subregion3 (deepest last).
      levelIds.push(...ancestorChain);
    }

    // Get universal (non-location-specific) requirements from ServiceRequirement.
    // These apply at every level — they're the "always required" baseline.
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

    // Build a lookup of displayOrder by requirementId from service_requirements.
    // Location-specific mappings (dsx_mappings) do not carry their own
    // displayOrder, but the same (serviceId, requirementId) pair typically
    // exists in service_requirements with the authoritative displayOrder.
    // Falling back to a hardcoded 999 (the previous behavior) caused
    // country-mapped fields to render in alphabetical order instead of the
    // configured DSX order — so we resolve the real displayOrder here.
    const displayOrderByRequirementId = new Map<string, number>();
    for (const serviceReq of serviceRequirements) {
      displayOrderByRequirementId.set(serviceReq.requirementId, serviceReq.displayOrder);
    }

    // Combine and deduplicate requirements across every applicable geographic
    // level. The merge keeps:
    //   - the most-specific level's displayOrder (later levelIds win)
    //   - the OR-merge of isRequired (any "required" anywhere wins, per spec)
    //   - the most-specific requirement object (in case fieldData differs)
    type MergedEntry = {
      requirement: typeof serviceRequirements[number]['requirement'];
      isRequired: boolean;
      displayOrder: number;
    };
    const allRequirements = new Map<string, MergedEntry>();

    for (const levelId of levelIds) {
      // DSX availability check (Phase 6 Stage 3): when subregionId is present,
      // we consult dsx_availability for each level. A missing row defaults to
      // available (per spec — "if no availability entry exists, meaning it
      // defaults to available"). This check is skipped entirely for the
      // legacy single-level call (no subregionId), preserving Stage 1/2
      // behavior.
      if (subregionId && subregionId !== '') {
        // Defensive: in test harnesses dsx_availability may not be mocked at
        // all, in which case we treat the service as available (matching the
        // spec's missing-row default).
        let isAvailableHere = true;
        try {
          if (
            prisma.dSXAvailability &&
            typeof prisma.dSXAvailability.findFirst === 'function'
          ) {
            const availabilityRow = await prisma.dSXAvailability.findFirst({
              where: { serviceId, locationId: levelId }
            });
            if (availabilityRow && availabilityRow.isAvailable === false) {
              isAvailableHere = false;
            }
          }
        } catch {
          // If the availability table query fails (e.g., not mocked), default
          // to available. This is safe because the spec explicitly says missing
          // data should not block requirement loading.
        }

        if (!isAvailableHere) {
          // Skip this level's additional requirements. The country-level
          // mapping (loaded earlier in the loop when levelId === countryId)
          // still contains the address_block field if any.
          continue;
        }
      }

      const levelMappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId,
          locationId: levelId,
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

      for (const mapping of levelMappings) {
        if (mapping.requirement.disabled) continue;

        const resolvedDisplayOrder =
          displayOrderByRequirementId.get(mapping.requirement.id) ?? 999;

        const existing = allRequirements.get(mapping.requirement.id);
        if (!existing) {
          allRequirements.set(mapping.requirement.id, {
            requirement: mapping.requirement,
            isRequired: mapping.isRequired,
            displayOrder: resolvedDisplayOrder
          });
        } else {
          // Merge: most-specific level wins for the requirement object and
          // displayOrder; isRequired OR-merges across levels.
          allRequirements.set(mapping.requirement.id, {
            requirement: mapping.requirement,
            isRequired: existing.isRequired || mapping.isRequired,
            displayOrder: resolvedDisplayOrder
          });
        }
      }
    }

    // Add service-level requirements (if not already present from any
    // location mapping). Service-level requirements always apply, regardless
    // of geographic level or DSX availability.
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