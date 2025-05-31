// src/app/api/workflows/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowUpdateSchema } from "@/types/workflow";
import { hasPermission } from "@/lib/permission-utils";

// GET: Fetch a single workflow by ID
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    
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

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        package: {
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
    const transformedWorkflow = {
      ...workflow,
      packageIds: [workflow.packageId],
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
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const workflowId = params.id;
    
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
    const body = await request.json();
    
    // Log the request body for debugging
    console.log("Workflow update request body:", JSON.stringify(body, null, 2));
    
    // Validate request body using Zod schema
    const validationResult = workflowUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Workflow validation error:", JSON.stringify(validationResult.error, null, 2));
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error },
        { status: 400 }
      );
    }

    const { packageIds, ...workflowData } = validationResult.data;

    // Check if workflow exists
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Update the packageId if provided
    let updateData: any = {
      ...workflowData,
      updatedById: userId,
    };

    // If packageIds are provided, update the packageId
    if (packageIds && packageIds.length > 0) {
      updateData.packageId = packageIds[0];
    }

    // Update workflow
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData,
      include: {
        package: {
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

    // Transform the data
    const transformedWorkflow = {
      ...updatedWorkflow,
      packageIds: [updatedWorkflow.packageId],
    };

    return NextResponse.json(transformedWorkflow);
  } catch (error) {
    console.error("Error updating workflow:", error);
    return NextResponse.json(
      { error: "Error updating workflow", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a workflow
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const workflowId = params.id;
    
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

    // First check if the workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
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
  } catch (error) {
    console.error("Error deleting workflow:", error);
    return NextResponse.json(
      { error: "Error deleting workflow" },
      { status: 500 }
    );
  }
}