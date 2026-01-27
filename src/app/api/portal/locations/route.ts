// src/app/api/portal/locations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic route
export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/locations
 * Get available locations with hierarchy and availability status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const serviceId = searchParams.get('serviceId');

    if (!parentId || parentId === 'root') {
      // Get all countries
      const countries = await prisma.country.findMany({
        select: {
          id: true,
          name: true,
          code2: true,
          code3: true,
          disabled: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      // For now, assume no countries have sublocations to avoid performance issues
      // We can check this when a specific country is selected
      const locationsWithAvailability = countries.map(country => ({
        ...country,
        available: country.disabled !== true, // null or false means available
        hasSublocations: false, // We'll check this on-demand
      }));

      return NextResponse.json(locationsWithAvailability);
    } else {
      // Get subregions for a specific location
      const subregions = await prisma.region.findMany({
        where: {
          countryId: parentId,
        },
        select: {
          id: true,
          name: true,
          code: true,
          disabled: true,
          level: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const sublocationsWithAvailability = subregions.map(region => ({
        ...region,
        available: !region.disabled,
        hasSublocations: false, // Could check for further sub-levels
      }));

      return NextResponse.json(sublocationsWithAvailability);
    }
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}