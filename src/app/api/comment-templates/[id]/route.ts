// /GlobalRX_v2/src/app/api/comment-templates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateCommentTemplateSchema } from '@/lib/schemas/commentTemplateSchemas';
import logger from '@/lib/logger';

/**
 * GET /api/comment-templates/[id]
 *
 * Gets a single comment template with its availability
 *
 * Required permissions: comment_management
 *
 * Returns: CommentTemplate with availabilities
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Template not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const template = await prisma.commentTemplate.findUnique({
      where: { id: params.id },
      include: {
        availabilities: true
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    logger.error('Error fetching comment template', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/comment-templates/[id]
 *
 * Updates an existing comment template
 *
 * Required permissions: comment_management
 *
 * Body: { shortName?: string, longName?: string, templateText?: string, isActive?: boolean }
 *
 * Returns: CommentTemplate
 *
 * Errors:
 *   - 400: Invalid input or duplicate short name
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Template not found
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  if (!session.user.permissions?.comment_management) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Step 3: Check if template exists
  const existing = await prisma.commentTemplate.findUnique({
    where: { id: params.id }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Step 4: Input validation
  const body = await request.json();

  const validation = updateCommentTemplateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 5: Business logic
  try {
    // Check for duplicate short name if it's being changed
    if (validation.data.shortName && validation.data.shortName !== existing.shortName) {
      const duplicate = await prisma.commentTemplate.findFirst({
        where: {
          shortName: validation.data.shortName,
          isActive: true,
          id: { not: params.id }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'A template with this short name already exists' },
          { status: 400 }
        );
      }
    }

    // Update the template
    const updated = await prisma.commentTemplate.update({
      where: { id: params.id },
      data: {
        ...validation.data,
        updatedBy: session.user.id
      },
      include: {
        availabilities: true
      }
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error('Error updating comment template', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comment-templates/[id]
 *
 * Deletes a template (hard delete if never used, soft delete if used)
 *
 * Required permissions: comment_management
 *
 * Returns: { success: boolean }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Template not found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    // Get the template
    const template = await prisma.commentTemplate.findUnique({
      where: { id: params.id }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.hasBeenUsed) {
      // Business rule: Used templates must be soft deleted to preserve audit trail
      // This ensures that any existing references to this template remain valid
      // and historical data integrity is maintained
      await prisma.commentTemplate.update({
        where: { id: params.id },
        data: {
          isActive: false,
          updatedBy: session.user.id
        }
      });

      return NextResponse.json(
        { success: true, message: 'Template deactivated (has been used)' },
        { status: 200 }
      );
    } else {
      // Business rule: Unused templates can be hard deleted to clean up database
      // Use transaction to ensure referential integrity when removing both
      // the template and its availability records
      await prisma.$transaction(async (tx) => {
        // First delete all availability records to avoid foreign key constraint violation
        await tx.commentTemplateAvailability.deleteMany({
          where: { templateId: params.id }
        });

        // Then delete the template itself
        await tx.commentTemplate.delete({
          where: { id: params.id }
        });
      });

      return NextResponse.json(
        { success: true, message: 'Template permanently deleted' },
        { status: 200 }
      );
    }
  } catch (error) {
    logger.error('Error deleting comment template', { error, templateId: params.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}