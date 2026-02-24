// src/app/api/dsx/update-field-order/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger, { logDatabaseError } from '@/lib/logger';

// Helper function to check permissions
function hasPermission(permissions: any, module: string): boolean {
  if (!permissions) return false;

  // For super admin format (* string or array with *)
  if (permissions === '*') return true;
  if (Array.isArray(permissions) && permissions.includes('*')) return true;

  // Check granular permissions
  if (typeof permissions === 'object') {
    if (permissions[module]) {
      if (typeof permissions[module] === 'boolean') return permissions[module];
      if (typeof permissions[module] === 'object' && permissions[module].edit === true) {
        return true;
      }
      if (Array.isArray(permissions[module]) &&
          (permissions[module].includes('*') || permissions[module].includes('edit'))) {
        return true;
      }
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    const body = await request.json();
    const { serviceId, fieldOrders } = body;

    if (!serviceId || !fieldOrders) {
      return NextResponse.json(
        { error: "Missing required parameters: serviceId and fieldOrders are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(fieldOrders)) {
      return NextResponse.json(
        { error: "fieldOrders must be an array of { requirementId, displayOrder } objects" },
        { status: 400 }
      );
    }

    logger.info('Updating field order for service', { serviceId, fieldOrderCount: fieldOrders.length });

    // Use a transaction to update all field orders atomically
    const result = await prisma.$transaction(async (tx) => {
      const updates = [];
      const created = [];
      const failed = [];

      // First, check which records exist
      const existingRecords = await tx.serviceRequirement.findMany({
        where: {
          serviceId,
          requirementId: {
            in: fieldOrders.map(fo => fo.requirementId)
          }
        },
        select: {
          requirementId: true
        }
      });

      const existingRequirementIds = new Set(existingRecords.map(r => r.requirementId));
      logger.debug('Found existing ServiceRequirement records', { existingRecordCount: existingRecords.length });

      for (const fieldOrder of fieldOrders) {
        const { requirementId, displayOrder } = fieldOrder;

        if (!requirementId || typeof displayOrder !== 'number') {
          logger.warn('Invalid field order entry', { fieldOrder, reason: 'Invalid data' });
          failed.push({ requirementId, reason: 'Invalid data' });
          continue;
        }

        if (existingRequirementIds.has(requirementId)) {
          // Update existing record
          logger.debug('Updating displayOrder for requirement', { requirementId, displayOrder });
          const updated = await tx.serviceRequirement.updateMany({
            where: {
              serviceId,
              requirementId
            },
            data: {
              displayOrder
            }
          });

          if (updated.count > 0) {
            updates.push({ requirementId, displayOrder });
          } else {
            failed.push({ requirementId, reason: 'Update failed' });
          }
        } else {
          // Record doesn't exist - this is a problem!
          logger.warn('ServiceRequirement record not found', { serviceId, requirementId });

          // Try to create it with the display order
          try {
            await tx.serviceRequirement.create({
              data: {
                serviceId,
                requirementId,
                displayOrder
              }
            });
            created.push({ requirementId, displayOrder });
            logger.info('Created missing ServiceRequirement record', { requirementId, displayOrder });
          } catch (createError) {
            logger.error('Failed to create ServiceRequirement record', {
              requirementId,
              error: createError instanceof Error ? createError.message : 'Unknown error'
            });
            failed.push({ requirementId, reason: 'Create failed' });
          }
        }
      }

      return {
        success: true,
        updatedCount: updates.length,
        createdCount: created.length,
        failedCount: failed.length,
        updates,
        created,
        failed
      };
    });

    logger.info('Field order update result', {
      updated: result.updatedCount,
      created: result.createdCount,
      failed: result.failedCount
    });

    if (result.failedCount > 0) {
      logger.error('Failed to update some field orders', { failed: result.failed });
    }

    return NextResponse.json(result);
  } catch (error) {
    logDatabaseError('update_field_order', error as Error, session?.user?.id);
    return NextResponse.json(
      { error: "Failed to update field order", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}