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
    const type = searchParams.get('type'); // 'states', 'counties', etc.

    // Handle state/territory requests for address blocks
    if (type === 'states') {
      // Get all first-level subregions (states/provinces/territories)
      // First get all top-level countries
      const countries = await prisma.country.findMany({
        where: {
          parentId: null,
        },
        select: {
          id: true,
        }
      });

      // Then get all their direct children (states/provinces)
      const states = await prisma.country.findMany({
        where: {
          parentId: {
            in: countries.map(c => c.id)
          },
          disabled: { not: true }
        },
        select: {
          id: true,
          name: true,
          code2: true,
          subregion1: true,
        },
        orderBy: {
          name: 'asc',
        }
      });

      return NextResponse.json(states.map(state => ({
        id: state.id,
        name: state.subregion1 || state.name,
        code: state.code2,
      })));
    }

    // Handle county requests for a specific state
    if (type === 'counties' && parentId) {
      const counties = await prisma.country.findMany({
        where: {
          parentId: parentId,
          disabled: { not: true }
        },
        select: {
          id: true,
          name: true,
          subregion2: true,
        },
        orderBy: {
          name: 'asc',
        }
      });

      return NextResponse.json(counties.map(county => ({
        id: county.id,
        name: county.subregion2 || county.name,
      })));
    }

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
      // Get subcountries/regions for a specific location
      const subregions = await prisma.country.findMany({
        where: {
          parentId: parentId,
        },
        select: {
          id: true,
          name: true,
          code2: true,
          disabled: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const sublocationsWithAvailability = subregions.map(region => ({
        ...region,
        available: !region.disabled,
        hasSublocations: false, // Could check for further sub-levels
        level: 1, // Add level for compatibility
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