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
import { SERVICE_STATUSES } from '@/constants/service-status';

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

    // BUG FIX (March 8, 2026): Use session.user.userType not session.user.type
    // The session.user object from NextAuth only has 'userType' property, not 'type'
    // This was causing authorization failures when checking user access
    if (!hasFulfillmentPermission && session.user.userType !== 'internal') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  } else {
    // BUG FIX (March 8, 2026): Use session.user.userType not session.user.type
    // Original permission check for template management - fixed property access
    if (session.user.userType === 'vendor' || session.user.userType === 'customer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!session.user.permissions?.comment_management) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Step 3: Fetch data
  try {
    // Build where clause for template filtering
    interface TemplateWhereClause {
      isActive: boolean;
      id?: { in: string[] };
    }

    const templateWhere: TemplateWhereClause = { isActive: true };

    // If serviceType and serviceStatus are provided, filter templates by availability
    if (serviceType && serviceStatus) {
      logger.info('GET /api/comment-templates - Filtering by service/status', {
        serviceType,
        serviceStatus
      });

      // First get templates that have availability for this service/status combination

      // BUG FIX (March 20, 2026): Status case normalization required for proper filtering
      // Problem: Database had mixed casing (ALL CAPS, Title Case, lowercase) causing lookup failures
      // Root cause: Status values came from different sources with inconsistent casing
      // Solution: Normalize to lowercase to match database migration that standardized all statuses
      // This ensures comment template filtering works regardless of how status values are passed
      const normalizedStatus = serviceStatus.toLowerCase();

      logger.info('GET /api/comment-templates - Normalizing status', {
        originalStatus: serviceStatus,
        normalizedStatus
      });

      const availableTemplateIds = await prisma.commentTemplateAvailability.findMany({
        where: {
          serviceCode: serviceType,
          status: normalizedStatus
        },
        select: {
          templateId: true
        }
      });

      logger.info('GET /api/comment-templates - Found availabilities', {
        serviceType,
        serviceStatus,
        foundCount: availableTemplateIds.length,
        templateIds: availableTemplateIds.map(a => a.templateId)
      });

      // If we found specific availabilities, filter to those templates
      if (availableTemplateIds.length > 0) {
        templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
      } else {
        // BUG FIX: Prevent returning ALL active templates when no matches found
        // Previous behavior: When no availabilities matched the serviceType/status filter,
        // the code would skip adding the 'id' filter, causing Prisma to return ALL active templates.
        // This violated the API contract where filtering by service/status should only return
        // templates that are available for that specific combination.
        // Fix: Force empty result set by filtering on empty array when no matches found.
        logger.warn('GET /api/comment-templates - No templates available for service/status', {
          serviceType,
          serviceStatus
        });
        templateWhere.id = { in: [] };
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
      // Use the correct lowercase service status values from constants
      Promise.resolve(Object.values(SERVICE_STATUSES).map(status => ({ statusCode: status })))
    ]);

    // Transform services to include category
    const servicesWithCategory = services.map(service => ({
      code: service.code,
      name: service.name,
      category: service.category || undefined
    }));

    // Extract unique statuses
    const statuses = [...new Set(orderStatuses.map(o => o.statusCode))];

    // Sanitize templates to ensure templateText is never undefined
    const sanitizedTemplates = templates.map(template => ({
      ...template,
      templateText: template.templateText || ''  // Ensure templateText is always a string
    }));

    const responseData = {
      templates: sanitizedTemplates,
      services: servicesWithCategory,
      statuses
    };

    logger.info('GET /api/comment-templates - Returning data', {
      templateCount: templates.length,
      templateNames: templates.map(t => ({ id: t.id, shortName: t.shortName })),
      isFiltered: !!(serviceType && serviceStatus),
      filterParams: { serviceType, serviceStatus }
    });

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

  // Debug: Log session user details
  logger.info('POST /api/comment-templates - Session user details', {
    userId: session.user.id,
    userType: session.user.userType,
    permissions: session.user.permissions,
    hasCommentManagement: !!session.user.permissions?.comment_management
  });

  // Step 2: Permission check
  if (session.user.userType === 'vendor' || session.user.userType === 'customer') {
    logger.warn('POST /api/comment-templates - Blocked: vendor/customer user type', {
      userId: session.user.id,
      userType: session.user.userType
    });
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (!session.user.permissions?.comment_management) {
    logger.warn('POST /api/comment-templates - Blocked: no comment_management permission', {
      userId: session.user.id,
      permissions: session.user.permissions
    });
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Step 3: Parse and validate request body
  try {
    const body = await request.json();

    // Debug: Log raw request body
    logger.info('POST /api/comment-templates - Raw request body', {
      body: JSON.stringify(body),
      bodyKeys: Object.keys(body),
      bodyTypes: Object.entries(body).reduce((acc, [key, value]) => {
        acc[key] = typeof value;
        return acc;
      }, {} as Record<string, string>)
    });

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
      logger.warn('POST /api/comment-templates - Duplicate shortName found', {
        requestedShortName: validatedData.shortName,
        existingTemplateId: existingTemplate.id,
        existingTemplateName: existingTemplate.longName
      });
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
      // Debug: Log validation errors in detail
      logger.warn('POST /api/comment-templates - Validation failed', {
        validationErrors: error.errors,
        invalidFields: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
          expected: (e as any).expected,
          received: (e as any).received
        })),
        flattenedErrors: error.flatten()
      });

      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating comment template', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}