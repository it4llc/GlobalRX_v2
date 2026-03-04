// /GlobalRX_v2/src/app/api/comment-templates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createCommentTemplateSchema,
  commentTemplateListSchema
} from '@/lib/schemas/commentTemplateSchemas';
import { z } from 'zod';
import logger from '@/lib/logger';

/**
 * GET /api/comment-templates
 *
 * Retrieves all active comment templates with their availability configurations,
 * plus all services and status options for building the availability grid.
 *
 * Required permissions: comment_management (internal users only)
 *
 * Query parameters: None
 *
 * Returns: {
 *   templates: CommentTemplate[] - Active templates with availability arrays
 *   services: Service[] - All non-disabled services with categories for grid rows
 *   statuses: string[] - Hardcoded status values for grid columns
 * }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (vendors/customers cannot access)
 */
export async function GET(request: NextRequest) {
  // Step 1: Auth check — ALWAYS first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check - comment management is restricted to internal users only
  // Business rule: vendors and customers should never have access to comment templates
  // as these are internal workflow tools for order fulfillment
  if (session.user.type === 'vendor' || session.user.type === 'customer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (!session.user.permissions?.comment_management) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Step 3: Fetch data
  try {
    const [templates, services, orderStatuses] = await Promise.all([
      // Get all active templates with their availabilities
      prisma.commentTemplate.findMany({
        where: {
          isActive: true
        },
        include: {
          availabilities: true
        },
        orderBy: {
          shortName: 'asc'
        }
      }),
      // Get all services with their categories
      prisma.service.findMany({
        select: {
          code: true,
          name: true,
          category: true
        },
        where: {
          disabled: false
        },
        orderBy: {
          name: 'asc'
        }
      }),
      // Business requirement: Use hardcoded status values for Phase 1 implementation
      // These represent the standard order workflow progression and match UI expectations
      // Future phases may make these dynamic, but for now consistency is prioritized
      Promise.resolve([
        { statusCode: 'DRAFT' },
        { statusCode: 'SUBMITTED' },
        { statusCode: 'PROCESSING' },
        { statusCode: 'COMPLETED' }
      ])
    ]);

    // Transform services to include category
    const servicesWithCategory = services.map(service => ({
      code: service.code,
      name: service.name,
      category: service.category || undefined
    }));

    // Extract unique statuses
    const statuses = [...new Set(orderStatuses.map(o => o.statusCode))];

    const responseData = {
      templates,
      services: servicesWithCategory,
      statuses
    };

    // Validate response structure
    const validated = commentTemplateListSchema.parse(responseData);

    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    logger.error('Error fetching comment templates', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comment-templates
 *
 * Creates a new comment template with audit trail tracking.
 * Validates uniqueness of shortName among active templates.
 *
 * Required permissions: comment_management (internal users only)
 *
 * Body: {
 *   shortName: string (1-50 chars, unique among active templates)
 *   longName: string (1-100 chars, descriptive name)
 *   templateText: string (1-1000 chars, may contain [placeholders])
 * }
 *
 * Returns: CommentTemplate with empty availabilities array
 *
 * Errors:
 *   - 400: Invalid input or duplicate short name
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (vendors/customers cannot create)
 */
export async function POST(request: NextRequest) {
  // Step 1: Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  if (session.user.type === 'vendor' || session.user.type === 'customer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (!session.user.permissions?.comment_management) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Step 3: Parse and validate request body
  try {
    const body = await request.json();
    const validatedData = createCommentTemplateSchema.parse(body);

    // Step 4: Business rule validation - shortName must be unique among active templates
    // Inactive templates don't count for uniqueness to allow name reuse after deactivation
    const existingTemplate = await prisma.commentTemplate.findFirst({
      where: {
        shortName: validatedData.shortName,
        isActive: true
      }
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'A template with this short name already exists' },
        { status: 400 }
      );
    }

    // Step 5: Create the template
    const newTemplate = await prisma.commentTemplate.create({
      data: {
        shortName: validatedData.shortName,
        longName: validatedData.longName,
        templateText: validatedData.templateText,
        createdBy: session.user.id,
        updatedBy: session.user.id
      },
      include: {
        availabilities: true
      }
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating comment template', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}