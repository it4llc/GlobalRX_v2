// src/app/api/locations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import logger from "@/lib/logger";

// GET all locations - ultra minimal version for debugging
export async function GET(request: NextRequest) {
  logger.info("API locations GET request initiated", {
    method: 'GET',
    endpoint: '/api/locations',
    timestamp: Date.now()
  });
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      logger.warn("Unauthorized access attempt to locations API", {
        endpoint: '/api/locations',
        method: 'GET',
        timestamp: Date.now()
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Just try to fetch all records with no filtering
    try {
      logger.debug("Fetching all countries from database", {
        operation: 'findMany',
        table: 'country'
      });

      // The simplest possible query
      const locations = await prisma.country.findMany();

      logger.info("Successfully retrieved locations", {
        count: locations.length,
        operation: 'findMany'
      });
      
      // Return the raw data
      return NextResponse.json(locations);
    } catch (dbError) {
      logger.error("Database error while fetching locations", {
        error: dbError.message,
        stack: dbError.stack,
        operation: 'findMany',
        table: 'country'
      });
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("API error in locations GET endpoint", {
      error: error.message,
      stack: error.stack,
      endpoint: '/api/locations',
      method: 'GET'
    });
    return NextResponse.json(
      { error: `GET Error: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST a new location (keeping this minimal too)
export async function POST(request: NextRequest) {
  logger.info("API locations POST request initiated", {
    method: 'POST',
    endpoint: '/api/locations',
    timestamp: Date.now()
  });
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const data = await request.json();
      logger.debug("Location data received", {
        hasCountryName: !!data.countryName,
        hasTwoLetter: !!data.twoLetter,
        hasThreeLetter: !!data.threeLetter,
        hasParentId: !!data.parentId
      });

      // Validate required fields
      if (!data.countryName || !data.twoLetter || !data.threeLetter) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Check if parent exists when parentId is provided
      let parentLocation = null;
      if (data.parentId) {
        parentLocation = await prisma.country.findUnique({
          where: { id: data.parentId }
        });
        
        if (!parentLocation) {
          return NextResponse.json(
            { error: "Parent location not found" },
            { status: 404 }
          );
        }
      }

      // Create location with modified codes for subregions
      let locationData = {
        name: data.countryName,
        numeric: data.numeric || null,
        subregion1: data.subregion1 || null,
        subregion2: data.subregion2 || null,
        subregion3: data.subregion3 || null,
        disabled: false,
        parentId: data.parentId || null
      };

      // If this is a subregion, create unique codes by combining parent code with a suffix
      if (parentLocation) {
        // Create a sanitized suffix from the subregion name (sent as countryName for subregions)
        const namePart = data.countryName || '';
        const suffix = namePart.replace(/[^A-Z0-9]/gi, '').substring(0, 3).toUpperCase();

        // Also add timestamp to ensure uniqueness
        const timestamp = Date.now().toString().slice(-4);

        // Store the original parent codes in the metadata for UI display purposes
        locationData['code2'] = `${parentLocation.code2}_${suffix}_${timestamp}`;
        locationData['code3'] = `${parentLocation.code3}_${suffix}_${timestamp}`;
      } else {
        // For countries, use the provided codes
        locationData['code2'] = data.twoLetter.toUpperCase();
        locationData['code3'] = data.threeLetter.toUpperCase();
      }

      logger.debug("Creating location", {
        hasName: !!locationData.name,
        hasCode2: !!locationData['code2'],
        hasCode3: !!locationData['code3'],
        hasParentId: !!locationData.parentId
      });
      
      // Create the location
      const location = await prisma.country.create({
        data: locationData,
      });
      
      logger.info("Location created successfully", {
        locationId: location.id,
        name: location.name,
        operation: 'create'
      });
      return NextResponse.json(location, { status: 201 });
    } catch (dbError) {
      logger.error("Database error creating location", {
        error: dbError.message,
        operation: 'create',
        table: 'country'
      });
      return NextResponse.json(
        { error: `Database create error: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("API error in locations POST endpoint", {
      error: error.message,
      stack: error.stack,
      endpoint: '/api/locations',
      method: 'POST'
    });
    return NextResponse.json(
      { error: `POST Error: ${error.message}` },
      { status: 500 }
    );
  }
}