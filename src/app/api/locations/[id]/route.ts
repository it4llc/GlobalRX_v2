// src/app/api/locations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Update a location by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const data = await request.json();

    // Validate required fields
    if (!data.countryName || !data.twoLetter || !data.threeLetter || !data.numeric) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update with consistent field naming
    const location = await prisma.country.update({
      where: { id },
      data: {
        name: data.countryName,
        code2: data.twoLetter,
        code3: data.threeLetter,
        numeric: data.numeric,
        subregion1: data.subregion1 || null,
        subregion2: data.subregion2 || null,
        subregion3: data.subregion3 || null,
      },
    });

    return NextResponse.json(location);
  } catch (error: unknown) {
    logger.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}