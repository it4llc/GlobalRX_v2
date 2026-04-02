import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageCustomers } from '@/lib/auth-utils';

// GET: Fetch workflows for a specific customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions using the centralized auth utility
    // BUG FIX: Previously used inline permission checking that only looked for
    // legacy 'workflows.view', 'customers.view', and 'admin' permissions. This caused 403 Forbidden errors
    // when internal users had the new module-based permissions (customer_config, global_config)
    // but not the old format. The centralized canManageCustomers() function properly
    // handles both permission formats and user type restrictions.
    if (!canManageCustomers(session.user)) {
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

    // Fetch workflows for this customer using the updated schema with direct package relationship
    const workflows = await prisma.workflow.findMany({
      where: {
        package: {
          customerId: customerId
        },
        disabled: false,
      },
      include: {
        package: true,
        sections: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected format with updated structure
    const transformedWorkflows = workflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      defaultLanguage: workflow.defaultLanguage,
      expirationDays: workflow.expirationDays,
      autoCloseEnabled: workflow.autoCloseEnabled,
      extensionAllowed: workflow.extensionAllowed,
      extensionDays: workflow.extensionDays,
      // Include reminder fields
      reminderEnabled: workflow.reminderEnabled,
      reminderFrequency: workflow.reminderFrequency,
      maxReminders: workflow.maxReminders,
      disabled: workflow.disabled,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      packageId: workflow.packageId,
      package: workflow.package,
      sectionCount: workflow.sections.length,
      sections: workflow.sections,
      // For compatibility with existing frontend code
      packageIds: [workflow.packageId],
      customerId: customerId
    }));

    return NextResponse.json(transformedWorkflows);
  } catch (error: unknown) {
    logger.error('Error fetching customer workflows:', error);
    return NextResponse.json(
      { error: 'Error fetching customer workflows' },
      { status: 500 }
    );
  }
}