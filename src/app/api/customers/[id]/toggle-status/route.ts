// src/app/api/customers/[id]/toggle-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * @route PATCH /api/customers/[id]/toggle-status
 * @desc Toggle the disabled status of a customer
 * @access Private - Requires customers.edit permission
 */
export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!session.user.permissions?.customers?.edit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: params.id }
    });

    if (!customer) {
      return NextResponse.json(
        { error: `Customer with ID ${params.id} not found` },
        { status: 404 }
      );
    }

    // Toggle the disabled status
    const updatedCustomer = await prisma.customer.update({
      where: { id: params.id },
      data: { disabled: !customer.disabled }
    });

    return NextResponse.json({
      id: updatedCustomer.id,
      disabled: updatedCustomer.disabled
    });
  } catch (error: unknown) {
    logger.error(`Error in PATCH /api/customers/${params.id}/toggle-status:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}