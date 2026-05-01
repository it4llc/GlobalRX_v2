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
 *   - token: The invitation token (string, required)
 *
 * Response shape:
 * {
 *   invitation: {
 *     firstName: string         // Candidate's first name
 *     lastName: string          // Candidate's last name
 *     status: string            // One of: pending, in_progress, completed, expired
 *     expiresAt: string         // ISO date when invitation expires
 *     companyName: string       // Name of the customer who sent the invitation
 *   },
 *   sections: [{
 *     id: string                // Unique identifier for this section
 *     title: string             // Display name shown to the candidate
 *     type: string              // One of: workflow_section, service_section
 *     placement: string         // One of: before_services, services, after_services
 *     status: string            // One of: not_started, in_progress, complete
 *     order: number             // Sort position within its placement group
 *     functionalityType?: string // For service sections: idv, record, verification-edu, verification-emp
 *   }]
 * }
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 *   - 500: No package associated with invitation
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

    // Step 2: Input validation - validate token format
    if (!token || typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ error: 'Invalid token parameter' }, { status: 400 });
    }

    // Step 3: Verify token matches session
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 4: Load invitation with all related data including package
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
    // Phase 5 Stage 3 added packageId to CandidateInvitation for direct access
    // Previously we had to traverse through order -> order items -> package
    const orderedPackage = invitation.package;

    if (!orderedPackage) {
      logger.error('No package found on invitation', { invitationId: invitation.id });
      return NextResponse.json({ error: 'No package associated with invitation' }, { status: 500 });
    }

    logger.debug('Using package from invitation', { packageName: orderedPackage.name, packageId: orderedPackage.id });

    // Step 5: Build section list
    const sections: CandidatePortalSection[] = [];
    let sectionOrder = 0;

    // Add Personal Information section as the very first section
    // Check if there are any personal info fields configured for this package
    const hasPersonalInfoFields = true; // For now, always show it. Later we can check DSX config
    if (hasPersonalInfoFields) {
      sections.push({
        id: 'personal_info',
        title: 'Personal Information',
        type: 'personal_info',
        placement: 'before_services',
        status: 'not_started',
        order: sectionOrder++,
        functionalityType: null
      });
    }

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
        // Get all service IDs for this functionality type
        const servicesForType = servicesByType.get(funcType)!;
        const serviceIds = servicesForType.map(ps => ps.service.id);

        sections.push({
          id: `service_${funcType}`,
          title: serviceTitleMap[funcType] || funcType,
          type: 'service_section',
          placement: 'services',
          status: 'not_started',
          order: sectionOrder++,
          functionalityType: funcType,
          serviceIds // Include service IDs for the form to use
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