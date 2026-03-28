// /GlobalRX_v2/src/app/api/comment-templates/[id]/availability/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateAvailabilitySchema } from '@/lib/schemas/commentTemplateSchemas';
import logger from '@/lib/logger';

/**
 * GET /api/comment-templates/[id]/availability
 *
 * Gets availability grid for a template
 *
 * Required permissions: comment_management
 *
 * Returns: { availabilities: CommentTemplateAvailability[] }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Template not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check
  if (!session.user.permissions?.comment_management) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    // Check template exists
    const template = await prisma.commentTemplate.findUnique({
      where: { id: id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get availabilities
    const availabilities = await prisma.commentTemplateAvailability.findMany({
      where: { templateId: id },
      orderBy: [
        { serviceCode: 'asc' },
        { status: 'asc' }
      ]
    });

    return NextResponse.json({ availabilities }, { status: 200 });
  } catch (error) {
    logger.error('Error fetching availability', { error, templateId: id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/comment-templates/[id]/availability
 *
 * Updates availability grid for a template using replace-all strategy.
 * This implements the grid UI behavior where all availability selections
 * are replaced atomically to match the current grid state.
 *
 * Required permissions: comment_management
 *
 * Body: {
 *   availabilities: Array<{
 *     serviceCode: string - Must be valid service code
 *     status: string - Must be valid order status
 *   }>
 * }
 *
 * Returns: { availabilities: CommentTemplateAvailability[] } - Complete updated list
 *
 * Errors:
 *   - 400: Invalid input (malformed request or invalid service/status codes)
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Template not found
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check
  if (!session.user.permissions?.comment_management) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    // Check template exists
    const template = await prisma.commentTemplate.findUnique({
      where: { id: id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate input
    const body = await request.json();
    const validation = updateAvailabilitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Replace all availabilities in a transaction to ensure data consistency
    // This implements the grid UI pattern where the entire availability state
    // is replaced to match exactly what the user has selected in the interface
    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing availability records for this template
      await tx.commentTemplateAvailability.deleteMany({
        where: { templateId: id }
      });

      // Create new availability records from the current grid state
      // Only create records if the user has made selections
      if (validation.data.availabilities.length > 0) {
        await tx.commentTemplateAvailability.createMany({
          data: validation.data.availabilities.map(a => ({
            templateId: id,
            serviceCode: a.serviceCode,
            status: a.status
          }))
        });
      }

      // Return the complete updated availability list for UI refresh
      return await tx.commentTemplateAvailability.findMany({
        where: { templateId: id },
        orderBy: [
          { serviceCode: 'asc' },
          { status: 'asc' }
        ]
      });
    });

    return NextResponse.json({ availabilities: result }, { status: 200 });
  } catch (error) {
    logger.error('Error updating availability', { error, templateId: id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}