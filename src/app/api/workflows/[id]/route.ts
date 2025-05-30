// src/app/api/workflows/[id]/route-prisma.ts
import { NextRequest, NextResponse } from "next/server";
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

    // Check if user has permission to view workflows (either directly or via customers permission)
    if (!hasPermission(session.user, "workflows", "view") && 
        !hasPermission(session.user, "customers", "view") && 
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    const workflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
      include: {
        workflow_packages: {
          include: {
            packages: {
              select: {
                id: true,
                name: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        workflow_sections: {
          orderBy: {
            displayOrder: 'asc',
          },
          include: {
            workflow_sections: true,
            workflow_translations: true,
          },
        },
        communication_templates: true,
        workflow_translations: true,
        users_workflows_createdByIdTousers: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        users_workflows_updatedByIdTousers: {
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
    const transformedWorkflow = {
      ...workflow,
      createdBy: workflow.users_workflows_createdByIdTousers,
      updatedBy: workflow.users_workflows_updatedByIdTousers,
      packages: workflow.workflow_packages.map(wp => wp.packages),
      packageIds: workflow.workflow_packages.map(wp => wp.packageId),
      sections: workflow.workflow_sections,
      templates: workflow.communication_templates,
      translations: workflow.workflow_translations
    };

    return NextResponse.json(transformedWorkflow);
  } catch (error) {
    console.error("Error fetching workflow:", error);
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

    // Check if user has permission to edit workflows (either directly or via customers permission)
    if (!hasPermission(session.user, "workflows", "edit") && 
        !hasPermission(session.user, "customers", "edit") && 
        !hasPermission(session.user, "admin")) {
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

    // Check if workflow exists
    const existingWorkflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
      include: {
        workflow_packages: true,
      },
    });

    if (!existingWorkflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Update workflow in a transaction to handle both workflow and packages
    const updatedWorkflow = await prisma.$transaction(async (tx) => {
      // Update main workflow data
      const updated = await tx.workflows.update({
        where: { id: workflowId },
        data: {
          ...workflowData,
          updatedById: userId,
        },
      });

      // If packages are provided, update the workflow package associations
      if (packageIds !== undefined) {
        // Delete existing associations
        await tx.workflow_packages.deleteMany({
          where: { workflowId },
        });

        // Create new associations
        if (packageIds.length > 0) {
          await Promise.all(
            packageIds.map(packageId =>
              tx.workflow_packages.create({
                data: {
                  id: crypto.randomUUID(),
                  workflowId,
                  packageId,
                },
              })
            )
          );
        }
      }

      return updated;
    });

    // Fetch the complete updated workflow with associations
    const completeWorkflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
      include: {
        workflow_packages: {
          include: {
            packages: {
              select: {
                id: true,
                name: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        workflow_sections: {
          orderBy: {
            displayOrder: 'asc',
          },
          include: {
            workflow_sections: true,
            workflow_translations: true,
          },
        },
        communication_templates: true,
        workflow_translations: true,
        users_workflows_createdByIdTousers: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        users_workflows_updatedByIdTousers: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Transform the data
    const transformedWorkflow = {
      ...completeWorkflow,
      createdBy: completeWorkflow.users_workflows_createdByIdTousers,
      updatedBy: completeWorkflow.users_workflows_updatedByIdTousers,
      packages: completeWorkflow.workflow_packages.map(wp => wp.packages),
      packageIds: completeWorkflow.workflow_packages.map(wp => wp.packageId),
      sections: completeWorkflow.workflow_sections,
      templates: completeWorkflow.communication_templates,
      translations: completeWorkflow.workflow_translations
    };

    return NextResponse.json(transformedWorkflow);
  } catch (error) {
    console.error("Error updating workflow:", error);
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

    // Check if user has permission to delete workflows (either directly or via customers permission)
    if (!hasPermission(session.user, "workflows", "delete") && 
        !hasPermission(session.user, "workflows", "edit") && 
        !hasPermission(session.user, "customers", "edit") && 
        !hasPermission(session.user, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workflowId = params.id;

    // First check if the workflow exists
    const workflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Soft delete the workflow by setting disabled to true
    await prisma.workflows.update({
      where: { id: workflowId },
      data: {
        disabled: true,
        updatedAt: new Date(),
        updatedById: session.user.id,
      },
    });

    return NextResponse.json({ message: "Workflow deleted successfully" });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Error deleting workflow" },
      { status: 500 }
    );
  }
}