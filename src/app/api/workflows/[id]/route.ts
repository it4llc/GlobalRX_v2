// src/app/api/workflows/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowUpdateSchema } from "@/types/workflow";
import { hasPermission } from "@/lib/permission-utils";
import logger from '@/lib/logger';

/**
 * GET /api/workflows/[id]
 *
 * Retrieves a single workflow by ID with packages and sections.
 *
 * Required permissions: customer_config.view or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Returns: Workflow object with packages, sections, and user metadata
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow not found
 *   - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view workflows via customer_config permission
    // BUG FIX: Changed from 'workflows'/'customers' to 'customer_config' to match User Admin permission key
    if (!hasPermission(session.user, "customer_config", "view") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        packages: {
          select: {
            id: true,
            name: true,
          },
        },
        sections: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Transform the data to match expected format
    // Make sure all fields are explicitly included to avoid missing new fields
    const transformedWorkflow = {
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
      // Include Phase 2 fields
      emailSubject: workflow.emailSubject,
      emailBody: workflow.emailBody,
      gapToleranceDays: workflow.gapToleranceDays,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      createdById: workflow.createdById,
      updatedById: workflow.updatedById,
      customerId: workflow.customerId,
      // Include related data
      packages: workflow.packages,
      packagesCount: workflow.packages.length,
      sections: workflow.sections,
      createdBy: workflow.createdBy,
      updatedBy: workflow.updatedBy
    };

    return NextResponse.json(transformedWorkflow);
  } catch (error: unknown) {
    logger.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Error fetching workflow" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/[id]
 *
 * Updates a workflow's configuration and metadata including Phase 2 email/gap fields.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Request body:
 *   - All fields from workflowUpdateSchema (name, description, status, settings, etc.)
 *   - Phase 2 fields: emailSubject (max 200), emailBody (max 5000), gapToleranceDays (1-365 or null)
 *
 * Returns: Updated workflow object with packages and sections
 *
 * Errors:
 *   - 400: Validation failed
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow not found
 *   - 409: Workflow has active orders (draft/processing)
 *   - 500: Internal server error
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;
    const workflowId = params.id;
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows via customer_config permission
    // BUG FIX: Changed from 'workflows'/'customers' to 'customer_config' to match User Admin permission key
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;
    const body = await request.json();
    
    // Log the request body for debugging
    logger.info("Workflow update request body:", JSON.stringify(body, null, 2));
    
    // Validate request body using Zod schema
    const validationResult = workflowUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      logger.error("Workflow validation error:", JSON.stringify(validationResult.error, null, 2));
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error },
        { status: 400 }
      );
    }

    const workflowData = validationResult.data;

    // Check if workflow exists
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Business rule: Check if workflow has active orders (draft or processing status)
    const activeOrdersCount = await prisma.order.count({
      where: {
        statusCode: { in: ['draft', 'processing'] },
        customer: {
          packages: {
            some: {
              workflowId: workflowId
            }
          }
        }
      }
    });

    if (activeOrdersCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot modify workflow with active orders",
          message: "This workflow has orders in draft or processing status. Complete or cancel these orders before making changes."
        },
        { status: 409 }
      );
    }

    // Update data
    let updateData: Record<string, unknown> = {
      ...workflowData,
      updatedById: userId,
    };

    // Update workflow
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData,
      include: {
        packages: {
          select: {
            id: true,
            name: true,
          },
        },
        sections: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedWorkflow);
  } catch (error: unknown) {
    logger.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Error updating workflow", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]
 *
 * Soft deletes a workflow by setting disabled flag. Prevents deletion if packages are assigned.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Returns: { message: "Workflow deleted successfully" }
 *
 * Errors:
 *   - 400: Cannot delete - workflow has assigned packages
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow not found
 *   - 500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;
    const workflowId = params.id;
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to delete workflows via customer_config permission
    // BUG FIX: Changed from 'workflows'/'customers' to 'customer_config' to match User Admin permission key
    if (!hasPermission(session.user, "customer_config", "delete") &&
        !hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // First check if the workflow exists and count packages using it
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        packages: true
      }
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Phase 1 Business Rule: Block deletion if packages are assigned
    // This enforces referential integrity since packages depend on workflows
    if (workflow.packages && workflow.packages.length > 0) {
      return NextResponse.json(
        {
          error: `This workflow cannot be deleted because it is assigned to ${workflow.packages.length} package(s). Please reassign or remove the workflow from those packages first.`,
          packagesCount: workflow.packages.length
        },
        { status: 400 }
      );
    }

    // Soft delete the workflow by setting disabled to true
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        disabled: true,
        updatedAt: new Date(),
        updatedById: session.user.id,
      },
    });

    return NextResponse.json({ message: "Workflow deleted successfully" });
  } catch (error: unknown) {
    logger.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Error deleting workflow" },
      { status: 500 }
    );
  }
}