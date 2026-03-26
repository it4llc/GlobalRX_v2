// src/app/api/services/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import logger from '@/lib/logger';

// Define valid functionality types in the desired order
const VALID_FUNCTIONALITY_TYPES = ["record", "verification-edu", "verification-emp", "other"];

// GET: Fetch services with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const functionalityType = searchParams.get("functionalityType") || "";
    const includeDisabled = searchParams.get("includeDisabled") === "true";

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Build the filter
    interface ServiceFilter {
      OR?: Array<{
        name?: { contains: string; mode: "insensitive" };
        description?: { contains: string; mode: "insensitive" };
      }>;
      category?: { contains: string; mode: "insensitive" };
      functionalityType?: string;
      disabled?: boolean;
    }

    const filter: ServiceFilter = {};
    
    if (search) {
      filter.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (category && category !== 'all-categories') {
      filter.category = { contains: category, mode: "insensitive" };
    }
    
    if (functionalityType && functionalityType !== 'all-types') {
      filter.functionalityType = functionalityType;
    }
    
    if (!includeDisabled) {
      filter.disabled = false;
    }

    // Get services with filtering and pagination
    const [services, totalCount] = await Promise.all([
      prisma.service.findMany({
        where: filter,
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
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
      }),
      prisma.service.count({ where: filter }),
    ]);

    // Add a placeholder usage count for each service
    // This will be replaced with actual package counts in the future
    const servicesWithUsage = services.map((service) => {
      return {
        ...service,
        usage: 0 // Placeholder value
      };
    });

    // Get unique categories for filtering
    const categories = await prisma.service.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      services: servicesWithUsage,
      totalCount,
      totalPages,
      currentPage: page,
      categories: categories.map((c) => c.category),
      functionalityTypes: VALID_FUNCTIONALITY_TYPES, // Include valid functionality types in the response
    });
  } catch (error: unknown) {
    // Properly handle error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error fetching services', {
      error: errorMessage,
      stack: errorStack
    });

    return NextResponse.json(
      { error: "Error fetching services" },
      { status: 500 }
    );
  }
}

// Helper function to generate a unique code from service name
// BUG FIX: The Service model requires a non-null unique 'code' field, but the original
// POST endpoint didn't provide one, causing 500 errors. This function auto-generates
// codes from service names to ensure the database constraint is satisfied.
function generateServiceCode(name: string): string {
  // Convert service names to uppercase alphanumeric codes (matching existing pattern: BGCHECK, DRUGTEST)
  const baseCode = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special characters for code compatibility
    .replace(/\s+/g, '') // Remove spaces to create single-word codes
    .slice(0, 20); // Limit length for database compatibility and readability

  // Fallback to generic code if name results in empty string after processing
  return baseCode || 'SERVICE';
}

// POST: Create a new service
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID from session
    const userId = session.user.id;

    // Get request body
    const body = await request.json();
    const { name, category, description, functionalityType } = body;

    // Validate required fields
    if (!name || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate functionalityType
    const validFunctionalityType = VALID_FUNCTIONALITY_TYPES.includes(functionalityType)
      ? functionalityType
      : "other"; // Default to "other" if invalid

    // Generate a unique code from the service name
    // BUG FIX: Auto-generate the required 'code' field to prevent 500 errors
    let baseCode = generateServiceCode(name);
    let code = baseCode;
    let suffix = 1;
    const maxAttempts = 10; // Prevent infinite loop in case of many conflicts

    // Retry logic to handle unique constraint violations on the code field
    // If the generated code already exists, append a numeric suffix (e.g., BGCHECK1, BGCHECK2)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Create new service with generated code - this was the missing piece that caused the bug
        const newService = await prisma.service.create({
          data: {
            name,
            category,
            description,
            functionalityType: validFunctionalityType,
            code, // This field was missing in the original implementation
            createdById: userId,
            updatedById: userId,
          },
        });

        return NextResponse.json(newService, { status: 201 });
      } catch (createError: unknown) {
        // Handle Prisma unique constraint violations (P2002) by trying with numeric suffix
        if (createError && typeof createError === 'object' && 'code' in createError && createError.code === 'P2002') {
          // Generate new code with numeric suffix to ensure uniqueness
          code = baseCode + suffix;
          suffix++;
          // Continue to next attempt with the new code
        } else {
          // Re-throw any other error to be handled by outer catch
          throw createError;
        }
      }
    }

    // If we exhausted all attempts, throw an error
    throw new Error('Unable to generate unique service code after multiple attempts');
  } catch (error: unknown) {
    // Properly handle error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error creating service', {
      error: errorMessage,
      stack: errorStack
    });

    return NextResponse.json(
      { error: "Error creating service" },
      { status: 500 }
    );
  }
}