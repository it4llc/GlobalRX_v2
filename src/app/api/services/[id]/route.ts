// src/app/api/services/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

// GET: Fetch a single service by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceId = params.id;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
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

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Get usage count (packages that use this service)
    const packagesCount = await prisma.package.count({
      where: {
        services: {
          path: "$[*]",
          array_contains: service.id,
        },
      },
    });

    const serviceWithUsage = {
      ...service,
      usage: packagesCount,
    };

    return NextResponse.json(serviceWithUsage);
  } catch (error) {
    console.error("Error fetching service:", error);
    return NextResponse.json(
      { error: "Error fetching service" },
      { status: 500 }
    );
  }
}

// PUT: Update a service
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID from session
    const userId = session.user.id;

    const serviceId = params.id;
    const body = await request.json();
    const { name, category, description, functionalityType } = body;

    // Validate required fields
    if (!name || !category || !functionalityType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Update service
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name,
        category,
        description,
        functionalityType,
        updatedById: userId,
      },
    });

    return NextResponse.json(updatedService);
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: "Error updating service" },
      { status: 500 }
    );
  }
}

// PATCH: Typically used for partial updates, but we'll use it specifically for toggling disabled state
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID from session
    const userId = session.user.id;

    const serviceId = params.id;
    const body = await request.json();
    
    // Check if the request is to toggle the disabled state
    if (body.action === "toggleDisabled") {
      const existingService = await prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!existingService) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      // Toggle the disabled state
      const updatedService = await prisma.service.update({
        where: { id: serviceId },
        data: {
          disabled: !existingService.disabled,
          updatedById: userId,
        },
      });

      return NextResponse.json(updatedService);
    }

    // If not toggling disabled state, treat as a partial update
    const { name, category, description, functionalityType } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (functionalityType !== undefined) updateData.functionalityType = functionalityType;
    updateData.updatedById = userId;

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: updateData,
    });

    return NextResponse.json(updatedService);
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: "Error updating service" },
      { status: 500 }
    );
  }
}