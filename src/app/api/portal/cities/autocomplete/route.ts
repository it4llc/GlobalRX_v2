// src/app/api/portal/cities/autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic route
export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/cities/autocomplete
 * Get city suggestions for autocomplete
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const stateId = searchParams.get('stateId');

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // For now, we'll check if there are any stored city entries
    // In the future, this will query the city_entries table
    // For initial implementation, we'll just return an empty array
    // since the database schema updates are pending

    // Placeholder: In production, this would query actual city data
    // const cities = await prisma.cityEntry.findMany({
    //   where: {
    //     city: {
    //       startsWith: query,
    //       mode: 'insensitive'
    //     },
    //     ...(stateId && { stateId })
    //   },
    //   select: {
    //     city: true
    //   },
    //   distinct: ['city'],
    //   take: 10
    // });

    // For now, return some mock suggestions for testing
    const mockCities = [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Phoenix',
      'Philadelphia',
      'San Antonio',
      'San Diego',
      'Dallas',
      'San Jose'
    ];

    const suggestions = mockCities
      .filter(city => city.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 5);

    return NextResponse.json(suggestions);
  } catch (error) {
    logger.error('Error fetching city suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch city suggestions' },
      { status: 500 }
    );
  }
}