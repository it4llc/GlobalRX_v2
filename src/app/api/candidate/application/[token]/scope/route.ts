// /GlobalRX_v2/src/app/api/candidate/application/[token]/scope/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

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
    // Handle actual database scope format: {"type": "most-recent"} or {"type": "most-recent-x", "quantity": 2} or {"type": "past-x-years", "years": 7}
    // The scope column is Prisma JSON, so we narrow it to the shape we expect at runtime.
    interface PackageServiceScope {
      type?: string;
      quantity?: number;
      years?: number;
    }
    const rawScope = matchingPackageService.scope as PackageServiceScope | null;
    let scopeType: string;
    let scopeValue: number | null = null;
    let scopeDescription: string;

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

    // Degree-specific scope types are only meaningful for the education
    // functionality. For record (address history) we fall back to 'all' if
    // a misconfigured package somehow ends up with one — this is documented
    // in the technical plan's "scope endpoint label wording" risk.
    const isRecord = validatedFunctionalityType === 'record';
    const isDegreeScopeForNonEdu =
      isRecord &&
      rawScope &&
      (rawScope.type === 'highest-degree' ||
        rawScope.type === 'highest-degree-inc-highschool' ||
        rawScope.type === 'all-degrees');

    if (!rawScope || rawScope === null || isDegreeScopeForNonEdu) {
      // No scope (or an inapplicable degree-style scope landing on the
      // record functionality) means provide everything.
      scopeType = 'all';
      scopeValue = null;
      scopeDescription = isRecord
        ? `Please provide your complete address history`
        : `Please provide your complete ${typeLabel} history`;
    } else if (rawScope.type === 'most-recent') {
      // Most recent single entry
      scopeType = 'count_exact';
      scopeValue = 1;
      scopeDescription = isRecord
        ? `Please provide your most recent address`
        : `Please provide your most recent ${typeLabel} entry`;
    } else if (rawScope.type === 'most-recent-x' && rawScope.quantity) {
      // Most recent X entries
      scopeType = 'count_specific';
      scopeValue = rawScope.quantity;
      const entryWord = rawScope.quantity === 1 ? 'entry' : 'entries';
      scopeDescription = isRecord
        ? `Please provide your most recent ${rawScope.quantity} ${rawScope.quantity === 1 ? 'address' : 'addresses'}`
        : `Please provide your most recent ${rawScope.quantity} ${typeLabel} ${entryWord}`;
    } else if (rawScope.type === 'past-x-years' && rawScope.years) {
      // Past X years
      scopeType = 'time_based';
      scopeValue = rawScope.years;
      scopeDescription = isRecord
        ? `Please provide all addresses where you have lived in the past ${rawScope.years} years`
        : `Please provide all ${typeLabel} for the past ${rawScope.years} years`;
    } else if (rawScope.type === 'highest-degree') {
      // Highest degree (post high school)
      scopeType = 'highest_degree';
      scopeValue = 1;
      scopeDescription = `Please provide your highest degree (post high school)`;
    } else if (rawScope.type === 'highest-degree-inc-highschool') {
      // Highest degree (including high school)
      scopeType = 'highest_degree_inc_hs';
      scopeValue = 1;
      scopeDescription = `Please provide your highest degree (including high school)`;
    } else if (rawScope.type === 'all-degrees') {
      // All degrees (post high school)
      scopeType = 'all_degrees';
      scopeValue = null;
      scopeDescription = `Please provide all degrees (post high school)`;
    } else {
      // Fallback to all if we can't parse the scope
      scopeType = 'all';
      scopeValue = null;
      scopeDescription = isRecord
        ? `Please provide your complete address history`
        : `Please provide your complete ${typeLabel} history`;
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