// src/app/api/workflows/route-prisma.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workflowCreateSchema } from "@/types/workflow";
import { hasPermission } from "@/lib/permission-utils";

// GET: Fetch workflows with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    console.log("Workflows API: Starting request");
    
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("Workflows API: No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Workflows API: User authenticated", { 
      user: session.user.email, 
      permissions: session.user.permissions 
    });

    // Check if user has permission to access workflows (either directly or via customers permission)
    if (!hasPermission(session.user, "workflows", "view") && 
        !hasPermission(session.user, "customers", "view") && 
        !hasPermission(session.user, "admin")) {
      console.log("Workflows API: User lacks permission");
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
          package: true,
          sections: true
        }
      }),
      prisma.workflow.count({ where: filter })
    ]);

    console.log(`Workflows API: Found ${workflows.length} workflows`);

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
      packageId: workflow.packageId,
      package: workflow.package,
      sectionCount: workflow.sections.length,
      sections: workflow.sections
    }));

    return NextResponse.json({
      workflowCount: transformedWorkflows.length,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      page,
      workflows: transformedWorkflows
    });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return NextResponse.json(
      { error: "Error fetching workflows", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to create workflows (either directly or via customers permission)
    if (!hasPermission(session.user, "workflows", "edit") && 
        !hasPermission(session.user, "customers", "edit") && 
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

    const { packageIds, ...workflowData } = validationResult.data;

    // Check if a package ID is provided
    if (!packageIds || packageIds.length === 0) {
      return NextResponse.json(
        { error: "A package must be selected for the workflow" },
        { status: 400 }
      );
    }

    // Use the first packageId from the array (since we now support only one package per workflow)
    const packageId = packageIds[0];

    // Create workflow with direct package relationship
    const workflowCreateData = {
      ...workflowData,
      packageId: packageId,
      // Add any required fields
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
        package: true,
        sections: true
      }
    });

    return NextResponse.json(completeWorkflow, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow:", error);
    return NextResponse.json(
      { error: "Error creating workflow", details: error.message },
      { status: 500 }
    );
  }
}