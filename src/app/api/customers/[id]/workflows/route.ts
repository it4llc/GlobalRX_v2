import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permission-utils';

// GET: Fetch workflows for a specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view workflows
    if (!hasPermission(session.user, 'workflows', 'view') && !hasPermission(session.user, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: customerId } = await params;

    // Verify the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch workflows for this customer
    const workflows = await prisma.workflows.findMany({
      where: {
        workflow_packages: {
          some: {
            packages: {
              customerId: customerId
            }
          }
        },
        disabled: false,
      },
      include: {
        workflow_packages: {
          include: {
            packages: true
          }
        },
        workflow_sections: true,
        communication_templates: true,
        users_workflows_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        users_workflows_updatedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected format
    const transformedWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      defaultLanguage: workflow.defaultLanguage,
      expirationDays: workflow.expirationDays,
      autoCloseEnabled: workflow.autoCloseEnabled,
      extensionAllowed: workflow.extensionAllowed,
      extensionDays: workflow.extensionDays,
      disabled: workflow.disabled,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      createdBy: workflow.users_workflows_createdByIdTousers,
      updatedBy: workflow.users_workflows_updatedByIdTousers,
      packageCount: workflow.workflow_packages.length,
      sectionCount: workflow.workflow_sections.length,
      templateCount: workflow.communication_templates.length,
      packageIds: workflow.workflow_packages.map(wp => wp.packageId),
      customerId: customerId
    }));

    return NextResponse.json(transformedWorkflows);
  } catch (error) {
    console.error('Error fetching customer workflows:', error);
    return NextResponse.json(
      { error: 'Error fetching customer workflows' },
      { status: 500 }
    );
  }
}