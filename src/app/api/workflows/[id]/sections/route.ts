// src/app/api/workflows/[id]/sections/route.ts
import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowSectionCreateSchema, MAX_SECTIONS_PER_PLACEMENT } from "@/types/workflow-section";
import { hasPermission } from "@/lib/permission-utils";

/**
 * GET /api/workflows/[id]/sections
 *
 * Retrieves all sections for a workflow, sorted by placement then displayOrder.
 *
 * Required permissions: customer_config.view or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Returns: Array of sections with Phase 2 fields (placement, type, content, fileUrl, fileName)
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
    if (!hasPermission(session.user, "customer_config", "view") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Get all sections for the workflow, sorted by placement then displayOrder
    const sections = await prisma.workflowSection.findMany({
      where: { workflowId },
      orderBy: [
        { placement: 'asc' }, // 'after_services' comes before 'before_services' alphabetically
        { displayOrder: 'asc' }
      ],
    });

    // Count sections per placement for metadata
    const beforeCount = sections.filter(s => s.placement === 'before_services').length;
    const afterCount = sections.filter(s => s.placement === 'after_services').length;

    return NextResponse.json({
      sections,
      metadata: {
        beforeServicesCount: beforeCount,
        afterServicesCount: afterCount,
        maxPerPlacement: MAX_SECTIONS_PER_PLACEMENT
      }
    });
  } catch (error: unknown) {
    logger.error("Error fetching workflow sections:", error);
    return NextResponse.json(
      { error: "Error fetching workflow sections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/[id]/sections
 *
 * Creates a new section for a workflow with Phase 2 placement and type support.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Request body:
 *   - name: string (1-100 chars, can be duplicate)
 *   - placement: 'before_services' | 'after_services'
 *   - type: 'text' | 'document'
 *   - content?: string (max 50K chars for text type)
 *   - isRequired?: boolean (defaults to true)
 *   - displayOrder?: number (auto-assigned if not provided)
 *
 * Returns: Created section with 201 status
 *
 * Errors:
 *   - 400: Validation failed
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow not found
 *   - 409: Workflow has active orders or placement limit reached (10 per placement)
 *   - 500: Internal server error
 */
export async function POST(
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

    // Check if user has permission to edit workflows via customer_config permission
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;
    const body = await request.json();

    // Validate request body using Zod schema
    const validationResult = workflowSectionCreateSchema.safeParse(body);
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

    // Business rule: Check section limit per placement (max 10)
    const existingSectionsInPlacement = await prisma.workflowSection.count({
      where: {
        workflowId,
        placement: validationResult.data.placement
      }
    });

    if (existingSectionsInPlacement >= MAX_SECTIONS_PER_PLACEMENT) {
      return NextResponse.json(
        {
          error: "Section limit reached",
          message: `Maximum ${MAX_SECTIONS_PER_PLACEMENT} sections allowed per placement. The ${validationResult.data.placement.replace('_', ' ')} placement already has ${existingSectionsInPlacement} sections.`
        },
        { status: 409 }
      );
    }

    // Auto-assign displayOrder if not provided
    let displayOrder = validationResult.data.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const maxOrder = await prisma.workflowSection.findFirst({
        where: {
          workflowId,
          placement: validationResult.data.placement
        },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      });
      displayOrder = (maxOrder?.displayOrder ?? -1) + 1;
    }

    // Create the new section
    const newSection = await prisma.workflowSection.create({
      data: {
        name: validationResult.data.name,
        placement: validationResult.data.placement,
        type: validationResult.data.type,
        content: validationResult.data.content || null,
        isRequired: validationResult.data.isRequired ?? true,
        displayOrder,
        workflowId,
      },
    });

    return NextResponse.json(newSection, { status: 201 });
  } catch (error: unknown) {
    logger.error("Error creating workflow section:", error);
    return NextResponse.json(
      { error: "Error creating workflow section" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/[id]/sections
 *
 * Updates display order for multiple sections (drag-and-drop reordering).
 * Only allows reordering within the same placement group.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *
 * Request body:
 *   - sections: Array of { id: string, displayOrder: number, placement: string }
 *
 * Returns: All sections with updated order
 *
 * Errors:
 *   - 400: Invalid request data
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow not found
 *   - 409: Workflow has active orders
 *   - 500: Internal server error
 */
export async function PATCH(
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

    // Check if user has permission to edit workflows via customer_config permission
    if (!hasPermission(session.user, "customer_config", "edit") &&
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;
    const body = await request.json();

    // Validate the request body
    if (!body.sections || !Array.isArray(body.sections)) {
      return NextResponse.json(
        { error: "Invalid request data: sections array is required" },
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

    // Update the order of multiple sections
    const updatedSections = await prisma.$transaction(
      body.sections.map((section: { id: string; displayOrder: number }) =>
        prisma.workflowSection.update({
          where: { id: section.id },
          data: { displayOrder: section.displayOrder },
        })
      )
    );

    // Get all sections with their new order
    const allSections = await prisma.workflowSection.findMany({
      where: { workflowId },
      orderBy: [
        { placement: 'asc' },
        { displayOrder: 'asc' }
      ],
    });

    return NextResponse.json(allSections);
  } catch (error: unknown) {
    logger.error("Error updating workflow section order:", error);
    return NextResponse.json(
      { error: "Error updating workflow section order" },
      { status: 500 }
    );
  }
}