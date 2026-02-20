// src/app/api/portal/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic route
export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/services
 * Get available services for the authenticated customer
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

    // Get services assigned to this customer
    const customerServices = await prisma.customerService.findMany({
      where: {
        customerId: customerId,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            disabled: true,
          },
        },
      },
    });

    // Filter out disabled services and map to the format we need
    const availableServices = customerServices
      .filter(cs => !cs.service.disabled)
      .map(cs => ({
        id: cs.service.id,
        name: cs.service.name,
        category: cs.service.category,
      }));

    return NextResponse.json(availableServices);
  } catch (error) {
    console.error('Error fetching customer services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}