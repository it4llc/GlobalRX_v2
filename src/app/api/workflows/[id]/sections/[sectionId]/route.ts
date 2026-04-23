// src/app/api/workflows/[id]/sections/[sectionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowSectionUpdateSchema } from "@/types/workflow-section";
import { hasPermission } from "@/lib/permission-utils";

/**
 * GET /api/workflows/[id]/sections/[sectionId]
 *
 * Retrieves a single workflow section by ID.
 *
 * Required permissions: customer_config.view or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *   - sectionId: UUID of the section
 *
 * Returns: Section object with Phase 2 fields
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow or section not found
 *   - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view workflows via customer_config permission
    if (!hasPermission(session.user, "customer_config", "view") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: workflowId, sectionId } = params;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Get the section
    const section = await prisma.workflowSection.findFirst({
      where: {
        id: sectionId,
        workflowId, // Ensure section belongs to the specified workflow
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (error: unknown) {
    logger.error("Error fetching workflow section:", error);
    return NextResponse.json(
      { error: "Error fetching workflow section" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/[id]/sections/[sectionId]
 *
 * Updates a workflow section with Phase 2 placement and content support.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *   - sectionId: UUID of the section
 *
 * Request body:
 *   - Partial section update (name, placement, type, content, etc.)
 *
 * Returns: Updated section
 *
 * Errors:
 *   - 400: Validation failed
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow or section not found
 *   - 409: Workflow has active orders or placement change would exceed limit
 *   - 500: Internal server error
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows via customer_config permission
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: workflowId, sectionId } = params;
    const body = await request.json();

    // Validate request body using Zod schema
    const validationResult = workflowSectionUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error },
        { status: 400 }
      );
    }

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Check if section exists and belongs to the workflow
    const existingSection = await prisma.workflowSection.findFirst({
      where: {
        id: sectionId,
        workflowId,
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Business rule: Check if workflow has active orders
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

    // If placement is changing, check if new placement would exceed limit
    if (validationResult.data.placement &&
        validationResult.data.placement !== existingSection.placement) {
      const { MAX_SECTIONS_PER_PLACEMENT } = await import("@/types/workflow-section");
      const sectionsInNewPlacement = await prisma.workflowSection.count({
        where: {
          workflowId,
          placement: validationResult.data.placement,
          id: { not: sectionId } // Don't count this section
        }
      });

      if (sectionsInNewPlacement >= MAX_SECTIONS_PER_PLACEMENT) {
        return NextResponse.json(
          {
            error: "Section limit reached in target placement",
            message: `Cannot move section to ${validationResult.data.placement.replace('_', ' ')}. Maximum ${MAX_SECTIONS_PER_PLACEMENT} sections allowed per placement.`
          },
          { status: 409 }
        );
      }

      // If placement changes, reset displayOrder to end of new placement
      const maxOrder = await prisma.workflowSection.findFirst({
        where: {
          workflowId,
          placement: validationResult.data.placement
        },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      });

      validationResult.data.displayOrder = (maxOrder?.displayOrder ?? -1) + 1;
    }

    // Update the section
    const updatedSection = await prisma.workflowSection.update({
      where: { id: sectionId },
      data: validationResult.data,
    });

    // If placement changed, compact displayOrder in the old placement
    if (validationResult.data.placement &&
        validationResult.data.placement !== existingSection.placement) {
      const remainingSections = await prisma.workflowSection.findMany({
        where: {
          workflowId,
          placement: existingSection.placement,
          displayOrder: { gt: existingSection.displayOrder }
        },
        orderBy: { displayOrder: 'asc' }
      });

      if (remainingSections.length > 0) {
        await prisma.$transaction(
          remainingSections.map((section, index) =>
            prisma.workflowSection.update({
              where: { id: section.id },
              data: { displayOrder: existingSection.displayOrder + index }
            })
          )
        );
      }
    }

    return NextResponse.json(updatedSection);
  } catch (error: unknown) {
    logger.error("Error updating workflow section:", error);
    return NextResponse.json(
      { error: "Error updating workflow section" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]/sections/[sectionId]
 *
 * Deletes a workflow section and compacts display order within placement.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *   - sectionId: UUID of the section
 *
 * Returns: { message: "Section deleted successfully" }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow or section not found
 *   - 409: Workflow has active orders
 *   - 500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows via customer_config permission
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: workflowId, sectionId } = params;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Check if section exists and belongs to the workflow
    const existingSection = await prisma.workflowSection.findFirst({
      where: {
        id: sectionId,
        workflowId,
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Business rule: Check if workflow has active orders
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

    // Delete the section (cascade delete will remove any file references)
    await prisma.workflowSection.delete({
      where: { id: sectionId },
    });

    // Compact display order within the same placement
    const remainingSections = await prisma.workflowSection.findMany({
      where: {
        workflowId,
        placement: existingSection.placement,
        displayOrder: { gt: existingSection.displayOrder },
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (remainingSections.length > 0) {
      await prisma.$transaction(
        remainingSections.map((section, index) =>
          prisma.workflowSection.update({
            where: { id: section.id },
            data: { displayOrder: existingSection.displayOrder + index },
          })
        )
      );
    }

    return NextResponse.json({ message: "Section deleted successfully" });
  } catch (error: unknown) {
    logger.error("Error deleting workflow section:", error);
    return NextResponse.json(
      { error: "Error deleting workflow section" },
      { status: 500 }
    );
  }
}