// src/app/api/dsx/toggle-required/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permission-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dsx/toggle-required
 * Toggle the required status of a DSX mapping
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (process.env.NODE_ENV !== 'development' && !hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    const body = await request.json();
    const { serviceId, locationId, requirementId, isRequired } = body;

    if (!serviceId || !locationId || !requirementId) {
      return NextResponse.json(
        { error: "Missing required parameters: serviceId, locationId, and requirementId are required" },
        { status: 400 }
      );
    }

    // Find the existing mapping
    const existingMapping = await prisma.dSXMapping.findFirst({
      where: {
        serviceId,
        locationId,
        requirementId
      }
    });

    if (!existingMapping) {
      // If no mapping exists and we're setting to required, create it
      if (isRequired) {
        const newMapping = await prisma.dSXMapping.create({
          data: {
            serviceId,
            locationId,
            requirementId,
            isRequired: true
          }
        });
        return NextResponse.json({
          success: true,
          mapping: newMapping,
          message: "Created new required mapping"
        });
      } else {
        // No mapping exists and we're setting to not required - nothing to do
        return NextResponse.json({
          success: true,
          message: "No mapping exists to update"
        });
      }
    }

    // Update the existing mapping
    const updatedMapping = await prisma.dSXMapping.update({
      where: {
        id: existingMapping.id
      },
      data: {
        isRequired: isRequired === true
      }
    });

    return NextResponse.json({
      success: true,
      mapping: updatedMapping,
      message: `Mapping ${isRequired ? 'marked as required' : 'marked as optional'}`
    });
  } catch (error: unknown) {
    logger.error('Error toggling required status:', error);
    return NextResponse.json(
      { error: "Failed to toggle required status", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dsx/toggle-required
 * Bulk update required status for multiple mappings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (process.env.NODE_ENV !== 'development' && !hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    const body = await request.json();
    const { serviceId, updates } = body;

    if (!serviceId || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Missing required parameters: serviceId and updates array are required" },
        { status: 400 }
      );
    }

    // Process all updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const update of updates) {
        const { locationId, requirementId, isRequired } = update;

        if (!locationId || !requirementId) continue;

        // Find or create the mapping
        const existingMapping = await tx.dSXMapping.findFirst({
          where: {
            serviceId,
            locationId,
            requirementId
          }
        });

        if (existingMapping) {
          // Update existing mapping
          const updated = await tx.dSXMapping.update({
            where: { id: existingMapping.id },
            data: { isRequired: isRequired === true }
          });
          results.push(updated);
        } else if (isRequired) {
          // Create new mapping only if marking as required
          const created = await tx.dSXMapping.create({
            data: {
              serviceId,
              locationId,
              requirementId,
              isRequired: true
            }
          });
          results.push(created);
        }
      }

      return results;
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.length,
      message: `Updated ${result.length} mappings`
    });
  } catch (error: unknown) {
    logger.error('Error bulk updating required status:', error);
    return NextResponse.json(
      { error: "Failed to bulk update required status", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}