// src/app/api/locations/[id]/toggle-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Toggle location status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`API: PATCH /api/locations/${params.id}/toggle-status called`);
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;

    // Get current location to check its status
    const currentLocation = await prisma.country.findUnique({
      where: { id },
    });

    if (!currentLocation) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    // Toggle the disabled status
    const newDisabledValue = !currentLocation.disabled;

    // Update the location status
    const location = await prisma.country.update({
      where: { id },
      data: {
        disabled: newDisabledValue,
      },
    });

    return NextResponse.json({
      id: location.id,
      countryName: location.name,
      twoLetter: location.code2,
      threeLetter: location.code3,
      numeric: location.numeric || "",
      subregion1: location.subregion1,
      subregion2: location.subregion2,
      subregion3: location.subregion3,
      status: location.disabled === true ? false : true
    });
  } catch (error) {
    console.error("Error toggling location status:", error);
    return NextResponse.json(
      { error: "Failed to toggle location status" },
      { status: 500 }
    );
  }
}