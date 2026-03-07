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

  // Step 2: Permission check
  // For fetching templates for commenting (with serviceType/serviceStatus), allow fulfillment permission
  // For managing templates (no params), require comment_management permission
  const searchParams = request.nextUrl.searchParams;
  const serviceType = searchParams.get('serviceType');
  const serviceStatus = searchParams.get('serviceStatus');
  const isForCommenting = serviceType || serviceStatus;

  if (isForCommenting) {
    // Users with fulfillment permission can fetch templates for commenting
    const hasFulfillmentPermission =
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment === '*' ||
      (typeof session.user.permissions?.fulfillment === 'object' && session.user.permissions.fulfillment !== null);

    if (!hasFulfillmentPermission && session.user.type !== 'internal') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  } else {
    // Original permission check for template management
    if (session.user.type === 'vendor' || session.user.type === 'customer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!session.user.permissions?.comment_management) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Step 3: Fetch data
  try {
    // Build where clause for template filtering
    const templateWhere: any = { isActive: true };

    // If serviceType and serviceStatus are provided, filter templates by availability
    if (serviceType && serviceStatus) {
      // First get templates that have availability for this service/status combination
      const availableTemplateIds = await prisma.commentTemplateAvailability.findMany({
        where: {
          serviceCode: serviceType,
          status: serviceStatus
        },
        select: {
          templateId: true
        }
      });

      // If we found specific availabilities, filter to those templates
      if (availableTemplateIds.length > 0) {
        templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
      }
    }

    const [templates, services, orderStatuses] = await Promise.all([
      // Get templates (filtered if serviceType/serviceStatus provided)
      prisma.commentTemplate.findMany({
        where: templateWhere,
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
      // Use the new service status values
      Promise.resolve([
        { statusCode: 'Draft' },
        { statusCode: 'Submitted' },
        { statusCode: 'Processing' },
        { statusCode: 'Missing Information' },
        { statusCode: 'Completed' },
        { statusCode: 'Cancelled' },
        { statusCode: 'Cancelled-DNB' }
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