// src/app/api/workflows/[id]/sections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowSectionCreateSchema } from "@/types/workflow";

// GET: Fetch all sections for a workflow
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
    if (!session.user.permissions?.workflows?.view && !session.user.permissions?.admin) {
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

    // Get all sections for the workflow
    const sections = await prisma.workflowSection.findMany({
      where: { workflowId },
      orderBy: { displayOrder: 'asc' },
      include: {
        dependentOn: true,
        translations: true,
        dependentSections: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error fetching workflow sections:", error);
    return NextResponse.json(
      { error: "Error fetching workflow sections" },
      { status: 500 }
    );
  }
}

// POST: Create a new section for a workflow
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows
    if (!session.user.permissions?.workflows?.edit && !session.user.permissions?.admin) {
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

    // Create the new section
    const newSection = await prisma.workflowSection.create({
      data: {
        ...validationResult.data,
        workflowId,
      },
    });

    // Get the complete section with relationships
    const completeSection = await prisma.workflowSection.findUnique({
      where: { id: newSection.id },
      include: {
        dependentOn: true,
        translations: true,
      },
    });

    return NextResponse.json(completeSection, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow section:", error);
    return NextResponse.json(
      { error: "Error creating workflow section" },
      { status: 500 }
    );
  }
}

// PATCH: Update section order for multiple sections
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit workflows
    if (!session.user.permissions?.workflows?.edit && !session.user.permissions?.admin) {
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
      orderBy: { displayOrder: 'asc' },
      include: {
        dependentOn: true,
        translations: true,
      },
    });

    return NextResponse.json(allSections);
  } catch (error) {
    console.error("Error updating workflow section order:", error);
    return NextResponse.json(
      { error: "Error updating workflow section order" },
      { status: 500 }
    );
  }
}