// /GlobalRX_v2/src/app/api/packages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, Prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * GET /api/packages
 *
 * Retrieves packages for the current customer.
 *
 * Required permissions: Must be a customer user
 *
 * Query params:
 *   - hasWorkflow?: boolean - if true, only returns packages with active workflows
 *
 * Returns: Array of package objects with id, name, description, and hasWorkflow flag
 *
 * Example Response:
 * ```json
 * [
 *   {
 *     "id": "pkg_123",
 *     "name": "Standard Background Check",
 *     "description": "Basic employment screening package",
 *     "hasWorkflow": true,
 *     "workflow": {
 *       "name": "Standard Workflow",
 *       "description": "Default screening workflow",
 *       "expirationDays": 30,
 *       "reminderEnabled": true
 *     }
 *   }
 * ]
 * ```
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Not a customer user or no customerId
 *   - 500: Database or server error
 */
export async function GET(request: NextRequest) {
  // Step 1: Authentication check — always first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Check if user is a customer user with customerId
  if (session.user.userType !== 'customer' || !session.user.customerId) {
    return NextResponse.json(
      { error: 'Forbidden — must be a customer user' },
      { status: 403 }
    );
  }

  // Step 3: Parse query parameters
  const { searchParams } = new URL(request.url);
  const hasWorkflowFilter = searchParams.get('hasWorkflow') === 'true';

  try {
    // Step 4: Query packages for the customer
    const whereClause: Prisma.PackageWhereInput = {
      customerId: session.user.customerId
    };

    // If hasWorkflow filter is applied, only include packages with workflows
    if (hasWorkflowFilter) {
      whereClause.workflowId = { not: null };
    }

    const packages = await prisma.package.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        workflowId: true,
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            expirationDays: true,
            reminderEnabled: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Transform response to include hasWorkflow flag and workflow details
    const packagesWithWorkflowFlag = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      hasWorkflow: !!pkg.workflowId,
      workflow: pkg.workflow ? {
        name: pkg.workflow.name,
        description: pkg.workflow.description,
        expirationDays: pkg.workflow.expirationDays,
        reminderEnabled: pkg.workflow.reminderEnabled
      } : null
    }));

    return NextResponse.json(packagesWithWorkflowFlag, { status: 200 });

  } catch (error) {
    logger.error('Failed to fetch packages', {
      event: 'packages_fetch_failure',
      customerId: session.user.customerId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}