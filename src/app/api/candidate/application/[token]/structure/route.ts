// /GlobalRX_v2/src/app/api/candidate/application/[token]/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
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

    // Step 1: Check for candidate session using the service
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    const sessionData = await CandidateSessionService.getSession();

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify token matches
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Load invitation with all related data including package
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
      include: {
        order: {
          include: {
            customer: true
          }
        },
        package: {
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
        }
      }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Step 4: Get the package directly from the invitation
    const orderedPackage = invitation.package;

    if (!orderedPackage) {
      console.error('No package found on invitation:', invitation.id);
      return NextResponse.json({ error: 'No package associated with invitation' }, { status: 500 });
    }

    console.log('Using package from invitation:', orderedPackage.name);

    // Step 5: Build section list
    const sections: CandidatePortalSection[] = [];
    let sectionOrder = 0;

    // Add before_services workflow sections
    if (orderedPackage?.workflow?.sections) {
      const beforeSections = orderedPackage.workflow.sections
        .filter(s => s.placement === 'before_services')
        .sort((a, b) => a.displayOrder - b.displayOrder); // WorkflowSection uses 'displayOrder'

      for (const section of beforeSections) {
        sections.push({
          id: section.id,
          title: section.name, // WorkflowSection uses 'name' not 'title'
          type: 'workflow_section',
          placement: 'before_services',
          status: 'not_started',
          order: sectionOrder++,
          functionalityType: null
        });
      }
    }

    // Add service sections from package services (deduplicated by functionality type)
    const servicesByType = new Map<string, typeof orderedPackage.packageServices[0][]>();

    for (const packageService of orderedPackage.packageServices) {
      if (packageService.service?.functionalityType) {
        const type = packageService.service.functionalityType;
        if (!servicesByType.has(type)) {
          servicesByType.set(type, []);
        }
        servicesByType.get(type)!.push(packageService);
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
        .filter(s => s.placement === 'after_services')
        .sort((a, b) => a.displayOrder - b.displayOrder); // WorkflowSection uses 'displayOrder'

      for (const section of afterSections) {
        sections.push({
          id: section.id,
          title: section.name, // WorkflowSection uses 'name' not 'title'
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