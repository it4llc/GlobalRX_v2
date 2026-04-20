// src/app/api/workflows/route-prisma.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workflowCreateSchema } from "@/types/workflow";
import { hasPermission } from "@/lib/permission-utils";
import logger from '@/lib/logger';

/**
 * GET /api/workflows
 *
 * Retrieves workflows with filtering, search, and pagination support.
 *
 * Required permissions: customer_config.view or admin
 *
 * Query params:
 *   - page?: number (default: 1)
 *   - pageSize?: number (default: 10)
 *   - status?: string | 'all'
 *   - includeDisabled?: boolean (default: false)
 *   - search?: string (searches name and description)
 *
 * Returns: { workflowCount: number, totalCount: number, totalPages: number, page: number, workflows: Workflow[] }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 500: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Workflows API: Starting request');
    
    const session = await getServerSession(authOptions);
    if (!session) {
      logger.warn('Workflows API: No session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info('Workflows API: User authenticated', {
      userId: session.user.id,
      permissions: session.user.permissions
    });

    // Check if user has permission to access workflows via customer_config permission
    // BUG FIX: Changed from 'workflows'/'customers' to 'customer_config' to match User Admin permission key
    if (!hasPermission(session.user, "customer_config", "view") &&
        !hasPermission(session.user, "admin")) {
      logger.warn('Workflows API: User lacks permission', { userId: session.user.id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status') || undefined;
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    const search = searchParams.get('search') || undefined;

    // Build filter object
    const filter: any = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (!includeDisabled) {
      filter.disabled = false;
    }

    if (search) {
      filter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get workflows with filtering and pagination using the new Workflow model
    const [workflows, totalCount] = await Promise.all([
      prisma.workflow.findMany({
        where: filter,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          packages: true,
          sections: true
        }
      }),
      prisma.workflow.count({ where: filter })
    ]);

    logger.info('Workflows API: Found workflows', { count: workflows.length, totalCount });

    // Transform the data to match the expected format
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
      packages: workflow.packages || [],
      packagesCount: workflow.packages?.length || 0,
      sectionCount: workflow.sections?.length || 0,
      sections: workflow.sections || []
    }));

    return NextResponse.json({
      workflowCount: transformedWorkflows.length,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      page,
      workflows: transformedWorkflows
    });
  } catch (error: unknown) {
    logger.error('Error fetching workflows', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "Error fetching workflows", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 *
 * Creates a new workflow with the specified configuration.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Request body:
 *   - All fields from workflowCreateSchema (name, description, status, settings, customerId, etc.)
 *
 * Returns: Created workflow object with packages and sections
 *
 * Errors:
 *   - 400: Validation failed
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to create workflows via customer_config permission
    // BUG FIX: Changed from 'workflows'/'customers' to 'customer_config' to match User Admin permission key
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;
    const body = await request.json();
    
    // Validate request body using Zod schema
    const validationResult = workflowCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error },
        { status: 400 }
      );
    }

    const workflowData = validationResult.data;

    // Create workflow without package relationship (packages will link to workflows)
    const workflowCreateData = {
      ...workflowData,
      // Add user tracking fields
      createdById: userId,
      updatedById: userId,
    };

    // Create the workflow
    const newWorkflow = await prisma.workflow.create({
      data: workflowCreateData
    });

    // Fetch the complete workflow with associations
    const completeWorkflow = await prisma.workflow.findUnique({
      where: { id: newWorkflow.id },
      include: {
        packages: true,
        sections: true
      }
    });

    return NextResponse.json(completeWorkflow, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating workflow', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "Error creating workflow", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}