// /GlobalRX_v2/src/app/api/candidate/application/[token]/scope/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
// Phase 7 Stage 1: single source of truth for the PackageService.scope JSON
// shape. Both this route and the validation engine import normalizeRawScope
// from packageScopeShape.ts so the two interpretations cannot drift.
import {
  normalizeRawScope,
  type RawPackageServiceScope,
} from '@/lib/candidate/validation/packageScopeShape';

// Zod schema for query parameters.
// Phase 6 Stage 3 added 'record' so the new AddressHistorySection can fetch
// its scope. Record-type services (criminal, civil, bankruptcy, etc.) all
// share the single Address History section, so the scope is resolved by
// functionality type rather than by individual service id.
const scopeQuerySchema = z.object({
  functionalityType: z.enum(['verification-edu', 'verification-emp', 'record'])
});

/**
 * GET /api/candidate/application/[token]/scope
 *
 * Returns the scope requirements for a specific functionality type within the candidate's package.
 * The form uses this to display the scope instructions and to know the minimum/expected number of entries.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Query params:
 *   - functionalityType (required): 'verification-edu', 'verification-emp',
 *     or 'record' (added in Phase 6 Stage 3 for the Address History section).
 *     For 'record', the descriptive string says "address" (e.g., "Please
 *     provide all address history for the past 7 years"). Degree-specific
 *     scope types are not legal for 'record' — they fall through to 'all'.
 *
 * Response:
 * {
 *   functionalityType: string
 *   serviceId: string
 *   scopeType: 'count_exact' | 'count_specific' | 'time_based' | 'all'
 *   scopeValue: number | null
 *   scopeDescription: string
 * }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found or service not found in package
 *   - 410: Invitation expired or already completed
 *   - 400: Missing or invalid functionalityType
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

    // Step 3: Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const functionalityType = searchParams.get('functionalityType');

    const validation = scopeQuerySchema.safeParse({ functionalityType });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid functionality type' }, { status: 400 });
    }

    const { functionalityType: validatedFunctionalityType } = validation.data;

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

    // Step 5: Find the service in the package that matches the functionality type
    const packageServices = await prisma.packageService.findMany({
      where: {
        packageId: invitation.packageId
      },
      include: {
        service: true
      },
      orderBy: { service: { name: 'asc' } }
    });

    // Find the service that matches the requested functionality type
    const matchingPackageService = packageServices.find(
      ps => ps.service.functionalityType === validatedFunctionalityType
    );

    if (!matchingPackageService) {
      return NextResponse.json({ error: 'Service not found in package' }, { status: 404 });
    }

    // Step 6: Extract and format scope information
    //
    // Phase 7 Stage 1 refactor: the JSON-shape → normalized-scope mapping was
    // moved to `src/lib/candidate/validation/packageScopeShape.ts` so the
    // validation engine and this route share one definition. We still build
    // the English `scopeDescription` string here to preserve the route's
    // public contract (existing ScopeDisplay components consume English).
    const rawScope = matchingPackageService.scope as RawPackageServiceScope | null;
    const normalized = normalizeRawScope(rawScope, validatedFunctionalityType);
    const { scopeType, scopeValue } = normalized;

    // Map the functionality type to a human-readable noun used in the scope
    // description ("Please provide your complete <typeLabel> history"). The
    // record type (Phase 6 Stage 3) collapses all record-style services
    // (criminal, civil, bankruptcy) into one "address" wording.
    const typeLabel =
      validatedFunctionalityType === 'verification-edu'
        ? 'education'
        : validatedFunctionalityType === 'verification-emp'
        ? 'employment'
        : 'address';
    const isRecord = validatedFunctionalityType === 'record';

    // Build the English description from the normalized output. The mapping
    // here mirrors the same wording the route used pre-refactor so callers
    // see no behavior change.
    let scopeDescription: string;
    switch (scopeType) {
      case 'count_exact':
        if (isRecord) {
          // Pre-refactor wording rule (preserved exactly):
          //   - rawScope === null OR a misconfigured degree-style scope on
          //     record → "Please provide your current address" (the
          //     record-default).
          //   - rawScope.type === 'current-address' → same wording.
          //   - rawScope.type === 'most-recent' → "Please provide your most
          //     recent address" (count_exact 1 for the record functionality).
          if (rawScope?.type === 'most-recent') {
            scopeDescription = `Please provide your most recent address`;
          } else {
            scopeDescription = `Please provide your current address`;
          }
        } else {
          scopeDescription = `Please provide your most recent ${typeLabel} entry`;
        }
        break;
      case 'count_specific': {
        const qty = scopeValue ?? 0;
        if (isRecord) {
          if (rawScope?.type === 'last-x-addresses') {
            scopeDescription = `Please provide your last ${qty} ${qty === 1 ? 'address' : 'addresses'}`;
          } else {
            scopeDescription = `Please provide your most recent ${qty} ${qty === 1 ? 'address' : 'addresses'}`;
          }
        } else {
          const entryWord = qty === 1 ? 'entry' : 'entries';
          scopeDescription = `Please provide your most recent ${qty} ${typeLabel} ${entryWord}`;
        }
        break;
      }
      case 'time_based': {
        const years = scopeValue ?? 0;
        scopeDescription = isRecord
          ? `Please provide all addresses where you have lived in the past ${years} years`
          : `Please provide all ${typeLabel} for the past ${years} years`;
        break;
      }
      case 'highest_degree':
        scopeDescription = `Please provide your highest degree (post high school)`;
        break;
      case 'highest_degree_inc_hs':
        scopeDescription = `Please provide your highest degree (including high school)`;
        break;
      case 'all_degrees':
        scopeDescription = `Please provide all degrees (post high school)`;
        break;
      case 'all':
      default:
        scopeDescription = isRecord
          ? `Please provide your complete address history`
          : `Please provide your complete ${typeLabel} history`;
        break;
    }

    // Step 7: Return scope information
    return NextResponse.json({
      functionalityType: validatedFunctionalityType,
      serviceId: matchingPackageService.serviceId,
      scopeType,
      scopeValue,
      scopeDescription
    });

  } catch (error) {
    logger.error('Failed to get candidate scope information', {
      event: 'candidate_scope_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}