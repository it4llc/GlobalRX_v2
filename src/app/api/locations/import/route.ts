// src/app/api/locations/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parse } from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('csvFile') as File;

    if (!file) {
      return NextResponse.json(
        { error: "No CSV file provided" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    
    // Parse CSV
    const { data, errors } = parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Error parsing CSV file", details: errors },
        { status: 400 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: "CSV file contains no data" },
        { status: 400 }
      );
    }

    // Process the CSV data
    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      // Check if we have the required fields
      if (!row.countryName || !row.twoLetter || !row.threeLetter || !row.numeric) {
        skipped++;
        continue;
      }

      try {
        // Check for existing location with the same codes
        const existingLocation = await prisma.country.findFirst({
          where: {
            OR: [
              { code2: row.twoLetter },
              { code3: row.threeLetter }
            ]
          }
        });

        if (existingLocation) {
          skipped++;
          continue;
        }

        // Create new location with consistent field naming
        await prisma.country.create({
          data: {
            name: row.countryName,
            code2: row.twoLetter,
            code3: row.threeLetter,
            numeric: row.numeric,
            subregion1: row.subregion1 || null,
            subregion2: row.subregion2 || null,
            subregion3: row.subregion3 || null,
          }
        });

        imported++;
      } catch (error) {
        console.error("Error importing row:", error, row);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      message: `Successfully imported ${imported} locations. ${skipped} skipped.`
    });
  } catch (error) {
    console.error("Error importing locations:", error);
    return NextResponse.json(
      { error: "Failed to import locations" },
      { status: 500 }
    );
  }
}