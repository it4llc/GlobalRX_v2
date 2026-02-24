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
    const filter: any = {};
    
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
    const servicesWithUsage = services.map(service => {
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
  } catch (error) {
    logger.error('Error fetching services', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "Error fetching services" },
      { status: 500 }
    );
  }
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

    // Create new service
    const newService = await prisma.service.create({
      data: {
        name,
        category,
        description,
        functionalityType: validFunctionalityType,
        createdById: userId,
        updatedById: userId,
      },
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    logger.error('Error creating service', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "Error creating service" },
      { status: 500 }
    );
  }
}