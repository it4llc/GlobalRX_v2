// /GlobalRX_v2/src/app/api/candidate/application/[token]/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import type { CandidatePortalStructureResponse, CandidatePortalSection } from '@/types/candidate-portal';

/**
 * GET /api/candidate/application/[token]/structure
 *
 * Retrieves the list of sections the candidate needs to complete.
 * Assembles sections from workflow and package services.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Path params:
 *   - token: The invitation token
 *
 * Returns: { invitation: CandidateInvitationInfo, sections: CandidatePortalSection[] }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Next.js 15: params is a Promise that must be awaited before destructuring
    const { token } = await params;

    // Step 1: Check for candidate session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('candidate_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse session data
    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch (error) {
      logger.error('Failed to parse candidate session', {
        event: 'candidate_session_parse_error'
      });
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Step 2: Verify token matches
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Load invitation with all related data
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
      include: {
        order: {
          include: {
            customer: true,
            orderItems: {
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

    // Step 4: Derive package from order services
    // Get unique service IDs from the order items
    const serviceIds = Array.from(new Set(
      invitation.order.orderItems.map(item => item.serviceId).filter(Boolean)
    ));

    // Find packages that contain exactly these services
    const packages = await prisma.package.findMany({
      where: {
        customerId: invitation.order.customerId,
        disabled: false
      },
      include: {
        workflow: {
          include: {
            sections: true
          }
        },
        packageServices: {
          include: {
            service: true
          }
        }
      }
    });

    // Find the package that best matches the ordered services
    const orderedPackage = packages.find(pkg => {
      const pkgServiceIds = pkg.packageServices.map(ps => ps.serviceId);
      return pkgServiceIds.length === serviceIds.length &&
        serviceIds.every(id => pkgServiceIds.includes(id));
    });

    // Step 5: Build section list
    const sections: CandidatePortalSection[] = [];
    let sectionOrder = 0;

    // Add before_services workflow sections
    if (orderedPackage?.workflow?.sections) {
      const beforeSections = orderedPackage.workflow.sections
        .filter(s => s.placement === 'before_services' && !s.disabled)
        .sort((a, b) => a.order - b.order);

      for (const section of beforeSections) {
        sections.push({
          id: section.id,
          title: section.title,
          type: 'workflow_section',
          placement: 'before_services',
          status: 'not_started',
          order: sectionOrder++,
          functionalityType: null
        });
      }
    }

    // Add service sections (deduplicated by functionality type)
    const servicesByType = new Map<string, typeof invitation.order.orderItems[0][]>();

    for (const item of invitation.order.orderItems) {
      if (item.service?.functionalityType) {
        const type = item.service.functionalityType;
        if (!servicesByType.has(type)) {
          servicesByType.set(type, []);
        }
        servicesByType.get(type)!.push(item);
      }
    }

    // Add service sections in fixed order
    const serviceTypeOrder = ['idv', 'record', 'verification-edu', 'verification-emp'];
    const serviceTitleMap: Record<string, string> = {
      'idv': 'Identity Verification',
      'record': 'Address History',
      'verification-edu': 'Education History',
      'verification-emp': 'Employment History'
    };

    for (const funcType of serviceTypeOrder) {
      if (servicesByType.has(funcType)) {
        sections.push({
          id: `service_${funcType}`,
          title: serviceTitleMap[funcType] || funcType,
          type: 'service_section',
          placement: 'services',
          status: 'not_started',
          order: sectionOrder++,
          functionalityType: funcType
        });
      }
    }

    // Add after_services workflow sections
    if (orderedPackage?.workflow?.sections) {
      const afterSections = orderedPackage.workflow.sections
        .filter(s => s.placement === 'after_services' && !s.disabled)
        .sort((a, b) => a.order - b.order);

      for (const section of afterSections) {
        sections.push({
          id: section.id,
          title: section.title,
          type: 'workflow_section',
          placement: 'after_services',
          status: 'not_started',
          order: sectionOrder++,
          functionalityType: null
        });
      }
    }

    // Step 6: Build response
    const response: CandidatePortalStructureResponse = {
      invitation: {
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        companyName: invitation.order.customer?.name || 'Unknown Company'
      },
      sections
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get candidate application structure', {
      event: 'candidate_structure_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}