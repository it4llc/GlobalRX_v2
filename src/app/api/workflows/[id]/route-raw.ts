// src/app/api/workflows/[id]/route-raw.ts
import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowUpdateSchema } from "@/types/workflow";
import { hasPermission } from "@/lib/permission-utils";

// GET: Fetch a single workflow by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view workflows
    if (!hasPermission(session.user, "workflows", "view") && !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    // Use raw SQL to fetch workflow
    try {
      const workflowResult = await prisma.$queryRaw`
        SELECT * FROM workflows WHERE id = ${workflowId}
      `;

      if (!Array.isArray(workflowResult) || workflowResult.length === 0) {
        return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
      }

      const workflow = workflowResult[0];

      // Fetch associated packages
      const packagesResult = await prisma.$queryRaw`
        SELECT p.id, p.name 
        FROM workflow_packages wp
        JOIN packages p ON wp."packageId" = p.id
        WHERE wp."workflowId" = ${workflowId}
      `;

      workflow.packages = packagesResult || [];
      workflow.packageIds = packagesResult.map((p: any) => p.id);

      return NextResponse.json(workflow);
    } catch (error: unknown) {
      logger.error("Error fetching workflow with raw SQL:", error);
      throw error;
    }
  } catch (error: unknown) {
    logger.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Error fetching workflow" },
      { status: 500 }
    );
  }
}

// PUT: Update a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows
    if (!hasPermission(session.user, "workflows", "edit") && !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;
    const workflowId = params.id;
    const body = await request.json();
    
    // Validate request body using Zod schema
    const validationResult = workflowUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error },
        { status: 400 }
      );
    }

    const { packageIds, ...workflowData } = validationResult.data;

    // Check if workflow exists using raw SQL
    const existingWorkflowResult = await prisma.$queryRaw`
      SELECT * FROM workflows WHERE id = ${workflowId}
    `;

    if (!Array.isArray(existingWorkflowResult) || existingWorkflowResult.length === 0) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const now = new Date();

    // Update workflow using raw SQL
    await prisma.$executeRaw`
      UPDATE workflows
      SET
        name = COALESCE(${workflowData.name}, name),
        description = ${workflowData.description !== undefined ? workflowData.description : existingWorkflowResult[0].description},
        status = COALESCE(${workflowData.status}, status),
        "defaultLanguage" = COALESCE(${workflowData.defaultLanguage}, "defaultLanguage"),
        "expirationDays" = COALESCE(${workflowData.expirationDays}, "expirationDays"),
        "autoCloseEnabled" = COALESCE(${workflowData.autoCloseEnabled}, "autoCloseEnabled"),
        "extensionAllowed" = COALESCE(${workflowData.extensionAllowed}, "extensionAllowed"),
        "extensionDays" = ${workflowData.extensionDays !== undefined ? workflowData.extensionDays : existingWorkflowResult[0].extensionDays},
        disabled = COALESCE(${workflowData.disabled}, disabled),
        "updatedById" = ${userId},
        "updatedAt" = ${now}
      WHERE id = ${workflowId}
    `;

    // Update package associations if provided
    if (packageIds !== undefined) {
      // Delete existing associations
      await prisma.$executeRaw`
        DELETE FROM workflow_packages WHERE "workflowId" = ${workflowId}
      `;

      // Create new associations
      if (packageIds.length > 0) {
        for (const packageId of packageIds) {
          const packageLinkId = crypto.randomUUID();
          await prisma.$executeRaw`
            INSERT INTO workflow_packages (id, "workflowId", "packageId", "createdAt", "updatedAt")
            VALUES (${packageLinkId}, ${workflowId}, ${packageId}, ${now}, ${now})
          `;
        }
      }
    }

    // Fetch updated workflow
    const updatedWorkflowResult = await prisma.$queryRaw`
      SELECT * FROM workflows WHERE id = ${workflowId}
    `;

    const updatedWorkflow = updatedWorkflowResult[0];

    // Fetch associated packages
    const packagesResult = await prisma.$queryRaw`
      SELECT p.id, p.name 
      FROM workflow_packages wp
      JOIN packages p ON wp."packageId" = p.id
      WHERE wp."workflowId" = ${workflowId}
    `;

    updatedWorkflow.packages = packagesResult || [];
    updatedWorkflow.packageIds = packagesResult.map((p: any) => p.id);

    return NextResponse.json(updatedWorkflow);
  } catch (error: unknown) {
    logger.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Error updating workflow" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to delete workflows
    if (!hasPermission(session.user, "workflows", "delete") && !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    // Check if workflow exists
    const existingWorkflowResult = await prisma.$queryRaw`
      SELECT * FROM workflows WHERE id = ${workflowId}
    `;

    if (!Array.isArray(existingWorkflowResult) || existingWorkflowResult.length === 0) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Delete associated records first (cascade delete)
    await prisma.$executeRaw`
      DELETE FROM workflow_packages WHERE "workflowId" = ${workflowId}
    `;

    await prisma.$executeRaw`
      DELETE FROM workflow_sections WHERE "workflowId" = ${workflowId}
    `;

    await prisma.$executeRaw`
      DELETE FROM workflow_translations WHERE "workflowId" = ${workflowId}
    `;

    await prisma.$executeRaw`
      DELETE FROM communication_templates WHERE "workflowId" = ${workflowId}
    `;

    // Delete the workflow
    await prisma.$executeRaw`
      DELETE FROM workflows WHERE id = ${workflowId}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Error deleting workflow" },
      { status: 500 }
    );
  }
}