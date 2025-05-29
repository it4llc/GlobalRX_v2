// src/app/api/workflows/[id]/sections/[sectionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';
import { workflowSectionUpdateSchema } from "@/types/workflow";

// GET: Fetch a single section by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
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

    const { id: workflowId, sectionId } = params;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Get the section
    const section = await prisma.workflowSection.findUnique({
      where: { 
        id: sectionId,
        workflowId, // Ensure section belongs to the specified workflow
      },
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

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (error) {
    console.error("Error fetching workflow section:", error);
    return NextResponse.json(
      { error: "Error fetching workflow section" },
      { status: 500 }
    );
  }
}

// PUT: Update a section
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
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
    const existingSection = await prisma.workflowSection.findUnique({
      where: { 
        id: sectionId,
        workflowId,
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // If dependsOnSection is provided, ensure it's not a circular dependency
    if (validationResult.data.dependsOnSection) {
      // Prevent self-dependency
      if (validationResult.data.dependsOnSection === sectionId) {
        return NextResponse.json(
          { error: "A section cannot depend on itself" },
          { status: 400 }
        );
      }

      // Check for circular dependencies
      const targetSection = await prisma.workflowSection.findUnique({
        where: { id: validationResult.data.dependsOnSection },
        include: { dependentOn: true },
      });

      if (!targetSection) {
        return NextResponse.json(
          { error: "Dependent section not found" },
          { status: 400 }
        );
      }

      // Check if target section directly or indirectly depends on this section
      let currentSection = targetSection;
      while (currentSection?.dependsOnSection) {
        if (currentSection.dependsOnSection === sectionId) {
          return NextResponse.json(
            { error: "Circular dependency detected" },
            { status: 400 }
          );
        }
        
        currentSection = await prisma.workflowSection.findUnique({
          where: { id: currentSection.dependsOnSection },
        });
      }
    }

    // Update the section
    const updatedSection = await prisma.workflowSection.update({
      where: { id: sectionId },
      data: validationResult.data,
    });

    // Get the complete updated section with relationships
    const completeSection = await prisma.workflowSection.findUnique({
      where: { id: sectionId },
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

    return NextResponse.json(completeSection);
  } catch (error) {
    console.error("Error updating workflow section:", error);
    return NextResponse.json(
      { error: "Error updating workflow section" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a section
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
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

    const { id: workflowId, sectionId } = params;

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Check if section exists and belongs to the workflow
    const existingSection = await prisma.workflowSection.findUnique({
      where: { 
        id: sectionId,
        workflowId,
      },
    });

    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check if this section is a dependency for other sections
    const dependentSections = await prisma.workflowSection.findMany({
      where: { dependsOnSection: sectionId },
    });

    if (dependentSections.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete this section because other sections depend on it",
          dependentSections: dependentSections.map(s => ({ id: s.id, name: s.name })),
        },
        { status: 400 }
      );
    }

    // Delete the section
    await prisma.workflowSection.delete({
      where: { id: sectionId },
    });

    // Reorder remaining sections to fill the gap
    const remainingSections = await prisma.workflowSection.findMany({
      where: { 
        workflowId,
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
  } catch (error) {
    console.error("Error deleting workflow section:", error);
    return NextResponse.json(
      { error: "Error deleting workflow section" },
      { status: 500 }
    );
  }
}