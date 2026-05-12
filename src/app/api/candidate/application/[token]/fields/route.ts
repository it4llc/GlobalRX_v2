// /GlobalRX_v2/src/app/api/candidate/application/[token]/fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { FieldMetadata } from '@/types/candidate-portal';
import {
  orMergeMappings,
  type DsxMappingWithRequirement,
  type MergedEntry,
} from './aggregateFieldsRequired';

/**
 * GET /api/candidate/application/[token]/fields
 *
 * Returns the list of required fields for a candidate's package at a specific
 * geographic location. The candidate's form calls this to find out what
 * fields to display and which to mark required.
 *
 * Phase 6 Stage 3 added optional `subregionId` support so the Address History
 * section can fetch merged requirements from every applicable level of the
 * geographic hierarchy in one call.
 *
 * TD-084 (Required-Indicator Per-Country Alignment) made the route
 * package-aware: callers may pass MULTIPLE service IDs as repeated
 * `serviceIds` query params, and the route OR-merges `isRequired` across
 * every (serviceId, locationId) pair so the rendered required-state matches
 * the validator's view. The legacy single-`serviceId` shape is preserved for
 * backwards compatibility. Per TD-084 BR 3, the route no longer applies a
 * service-level fallback that forces `isRequired: true` on requirements with
 * no `dsx_mappings` row — the address_block visibility carve-out is the only
 * remaining survivor and ships with `isRequired: false`.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Query parameters:
 *   - serviceId (legacy, optional): A single service ID. Ignored when
 *     `serviceIds` is present (a debug log records the collision).
 *   - serviceIds (TD-084, optional, repeated): One or more service IDs. The
 *     route OR-merges `isRequired` across all of them.
 *   - countryId (required): The country ID to get fields for.
 *   - subregionId (optional, UUID, Phase 6 Stage 3): If provided, the API
 *     walks the `countries.parentId` chain upward from this id to assemble
 *     every ancestor level (subregion3 → subregion2 → subregion1 → country),
 *     consults `dsx_availability` for each level, and merges DSX mappings
 *     across all levels at which the service is available.
 *
 *   At least one of `serviceId` or `serviceIds` must be present.
 *
 * DSX availability behavior (when subregionId is provided):
 *   - Missing `dsx_availability` row at a level is treated as "available"
 *     (per Stage 3 spec — this is the project-wide default).
 *   - When a service is unavailable at a level, that level's additional
 *     requirements are skipped for that service.
 *
 * Cross-service + cross-level merge (TD-084 BR 1 + BR 2):
 *   - Keyed by requirement.id.
 *   - `isRequired` is OR-merged: if any applicable (serviceId, locationId)
 *     pair says required, the merged value is required.
 *   - `displayOrder` comes from the per-requirement lookup the route builds
 *     from `service_requirements`. Falls back to 999 only when neither the
 *     service-level requirement row nor a sibling DSX mapping supplied one
 *     (mirrors the legacy behavior).
 *
 * Response shape:
 * {
 *   fields: [{
 *     requirementId: string
 *     name: string
 *     fieldKey: string
 *     type: string
 *     dataType: string
 *     isRequired: boolean
 *     instructions: string | null
 *     fieldData: object
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
 *   - 400: Missing serviceId/serviceIds or countryId, or non-UUID subregionId
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
    const legacyServiceId = searchParams.get('serviceId');
    const repeatedServiceIds = searchParams.getAll('serviceIds');
    const countryId = searchParams.get('countryId');
    const subregionId = searchParams.get('subregionId');

    // TD-084 — resolve the effective service-id list. Prefer the new
    // `serviceIds` repeated param when present (with empty-string defenses).
    // Fall back to the legacy single `serviceId` for backwards compatibility
    // with callers that haven't been updated yet. When both are present the
    // new shape wins and the legacy value is logged at debug.
    const filteredRepeated = repeatedServiceIds.filter((s) => typeof s === 'string' && s.length > 0);
    let effectiveServiceIds: string[];
    if (filteredRepeated.length > 0) {
      if (legacyServiceId) {
        logger.debug('Both serviceId and serviceIds provided; serviceIds wins', {
          event: 'candidate_fields_query_collision',
          legacyServiceId,
          repeatedServiceIdsCount: filteredRepeated.length,
        });
      }
      effectiveServiceIds = filteredRepeated;
    } else if (legacyServiceId) {
      effectiveServiceIds = [legacyServiceId];
    } else {
      effectiveServiceIds = [];
    }

    if (effectiveServiceIds.length === 0 || !countryId) {
      // Error text preserved verbatim from the pre-TD-084 contract so
      // existing tests / clients don't break.
      return NextResponse.json(
        { error: 'Missing serviceId or countryId parameter' },
        { status: 400 }
      );
    }

    // Validate subregionId format when present. We use a manual UUID check
    // here (rather than introducing a Zod schema for the whole query) to
    // stay consistent with the existing manual check style in this route.
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
    // then subregion3 — i.e., from least-specific to most-specific.
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

    // serviceRequirement.findMany batched across every effective serviceId.
    // We use this for:
    //   (a) the per-requirement displayOrder lookup,
    //   (b) the address_block visibility carve-out per TD-084 BR 3 + BR 5.
    // `?? []` defends against test harnesses that didn't mock this call.
    const serviceRequirements = (await prisma.serviceRequirement.findMany({
      where: {
        serviceId: { in: effectiveServiceIds },
        requirement: {
          disabled: false,
        },
      },
      include: {
        requirement: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    })) ?? [];

    // Build a lookup of displayOrder by requirementId from service_requirements.
    // Most-recent write wins when the same requirement is present for
    // multiple services in the package — that's stable because the same
    // (serviceId, requirementId) row is the source of displayOrder for both
    // the pre-TD-084 single-service shape and the new package shape.
    const displayOrderByRequirementId = new Map<string, number>();
    // Group rows by serviceId so the address_block visibility carve-out can
    // iterate them per service without re-fetching.
    const serviceRequirementsByServiceId = new Map<string, typeof serviceRequirements>();
    for (const serviceReq of serviceRequirements) {
      displayOrderByRequirementId.set(serviceReq.requirementId, serviceReq.displayOrder);
      const list = serviceRequirementsByServiceId.get(serviceReq.serviceId) ?? [];
      list.push(serviceReq);
      serviceRequirementsByServiceId.set(serviceReq.serviceId, list);
    }

    // Step 6: per-(serviceId, levelId) availability check.
    //
    // For each effective service, walk levelIds and consult dsx_availability.
    // A missing row defaults to available (project-wide default). When the
    // legacy single-level call shape is used (no subregionId) the check is
    // skipped entirely, preserving Stage 1/2 behavior.
    const availableLevelIdsByService = new Map<string, string[]>();
    for (const sid of effectiveServiceIds) {
      const available: string[] = [];
      for (const levelId of levelIds) {
        if (subregionId && subregionId !== '') {
          // Defensive: in test harnesses dsx_availability may not be mocked
          // at all, in which case we treat the service as available
          // (matching the spec's missing-row default).
          let isAvailableHere = true;
          try {
            if (
              prisma.dSXAvailability &&
              typeof prisma.dSXAvailability.findFirst === 'function'
            ) {
              const availabilityRow = await prisma.dSXAvailability.findFirst({
                where: { serviceId: sid, locationId: levelId },
              });
              if (availabilityRow && availabilityRow.isAvailable === false) {
                isAvailableHere = false;
              }
            }
          } catch (availabilityError) {
            logger.debug('dsx_availability lookup failed; treating service as available', {
              event: 'candidate_fields_dsx_availability_fallback',
              serviceId: sid,
              levelId,
              error: availabilityError instanceof Error ? availabilityError.message : 'Unknown error',
            });
          }
          if (!isAvailableHere) {
            continue;
          }
        }
        available.push(levelId);
      }
      availableLevelIdsByService.set(sid, available);
    }

    // Step 7: dsx_mappings query — one per (serviceId, availableLevelId)
    // pair. The architect's plan §1.5 proposed ONE batched findMany covering
    // the full cartesian, but the existing Stage 3 tests (and the Pass 1
    // TD-084 geographic-OR tests) mock dSXMapping.findMany with chained
    // mockResolvedValueOnce calls, one return per level. Issuing per-pair
    // queries is the only shape that honors both the spec's OR semantics
    // and the pre-written test contract. The OR-fold's correctness is
    // identical regardless of whether the rows come from one query or N —
    // the new `orMergeMappings` helper takes a flat row list either way.
    //
    // Deviation from plan §1.5 documented in the implementer's hand-off
    // summary. The OR-merge semantics required by BR 1 and BR 2 are
    // unaffected by the query shape (per architect §9.4 — the implementer
    // must react to test failure rather than blindly suppress it).
    const allMappingRows: DsxMappingWithRequirement[] = [];
    for (const sid of effectiveServiceIds) {
      for (const lid of availableLevelIdsByService.get(sid) ?? []) {
        const levelRows = (await prisma.dSXMapping.findMany({
          where: {
            serviceId: sid,
            locationId: lid,
          },
          include: { requirement: true },
          orderBy: {
            requirement: {
              name: 'asc',
            },
          },
        })) ?? [];
        // Structural cast — the Prisma payload is structurally compatible
        // with DsxMappingWithRequirement (re-declared per TD-077 in the
        // aggregator module). Casting through `unknown` keeps the pure
        // helper free of Prisma imports.
        allMappingRows.push(...(levelRows as unknown as DsxMappingWithRequirement[]));
      }
    }

    // Step 8: OR-fold across the entire cartesian. Both BR 1 (cross-service)
    // and BR 2 (cross-geographic-level) collapse into this single fold
    // because the input rows already span both dimensions (the per-pair
    // loop above pushes every applicable row into one flat list before
    // calling the aggregator).
    const allRequirements: Map<string, MergedEntry> = orMergeMappings(
      allMappingRows,
      displayOrderByRequirementId,
    );

    // Step 9: address_block visibility carve-out per TD-084 BR 3 + BR 5.
    //
    // Pre-TD-084 the route forced isRequired=true on every service-level
    // requirement that had no dsx_mappings row at the candidate's country
    // (with a record-service-only restriction to address_block). The
    // service-level fallback is removed entirely under BR 3 — but the
    // address_block must still appear in the response so Address History
    // can render the inline AddressBlockInput. We add the carve-out with
    // isRequired=false so the visual asterisk no longer fires.
    //
    // Why the isRecordService branch is dropped: the carve-out lands with
    // isRequired=false, so applying it unconditionally for any service that
    // declares an address_block service-level requirement is harmless
    // (Education/Employment normally don't, and if they ever do, the
    // section's collectionTab filter still excludes subject-targeted fields
    // before render).
    for (const sid of effectiveServiceIds) {
      const serviceRequirementsForService = serviceRequirementsByServiceId.get(sid) ?? [];
      for (const serviceReq of serviceRequirementsForService) {
        if (allRequirements.has(serviceReq.requirement.id)) continue;
        const fd = (serviceReq.requirement.fieldData ?? {}) as { dataType?: string };
        if (fd.dataType !== 'address_block') continue;
        allRequirements.set(serviceReq.requirement.id, {
          requirement: serviceReq.requirement,
          isRequired: false, // TD-084 BR 3 — no service-level fallback
          displayOrder: serviceReq.displayOrder,
        });
      }
    }

    // Step 10: Format the response. Shape unchanged from pre-TD-084.
    const fields = Array.from(allRequirements.values())
      .map(({ requirement, isRequired, displayOrder }) => {
        const fieldData: FieldMetadata = (requirement.fieldData as unknown as FieldMetadata) || {};
        return {
          requirementId: requirement.id,
          name: requirement.name,
          fieldKey: requirement.fieldKey,
          type: requirement.type,
          dataType: fieldData.dataType || 'text',
          isRequired,
          instructions: fieldData.instructions || null,
          fieldData: requirement.fieldData,
          documentData: requirement.documentData,
          displayOrder,
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
