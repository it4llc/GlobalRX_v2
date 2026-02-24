// src/app/api/services/[id]/toggle-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

// PATCH: Toggle the disabled status of a service
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

    // Find the current service
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Toggle the disabled status
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        disabled: !service.disabled,
        updatedById: userId,
      },
    });

    return NextResponse.json(updatedService);
  } catch (error) {
    logger.error("Error toggling service status:", error);
    return NextResponse.json(
      { error: "Error toggling service status" },
      { status: 500 }
    );
  }
}