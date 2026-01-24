// src/app/api/locations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

// GET all locations - ultra minimal version for debugging
export async function GET(request: NextRequest) {
  console.log("API: GET /api/locations called - DEBUGGING VERSION");
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("API: Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Just try to fetch all records with no filtering
    try {
      console.log("API: Attempting to fetch ALL countries with no filtering");
      
      // The simplest possible query
      const locations = await prisma.country.findMany();
      
      console.log(`API: Successfully found ${locations.length} locations`);
      
      // Return the raw data
      return NextResponse.json(locations);
    } catch (dbError) {
      console.error("Database error:", dbError);
      console.error("Error stack:", dbError.stack);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API Error in GET locations:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: `GET Error: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST a new location (keeping this minimal too)
export async function POST(request: NextRequest) {
  console.log("API: POST /api/locations called");
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const data = await request.json();
      console.log("API: Location data received:", data);

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

      console.log("Creating location with data:", locationData);
      
      // Create the location
      const location = await prisma.country.create({
        data: locationData,
      });
      
      console.log("API: Location created successfully:", location);
      return NextResponse.json(location, { status: 201 });
    } catch (dbError) {
      console.error("Database error creating location:", dbError);
      return NextResponse.json(
        { error: `Database create error: ${dbError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API Error in POST location:", error);
    return NextResponse.json(
      { error: `POST Error: ${error.message}` },
      { status: 500 }
    );
  }
}