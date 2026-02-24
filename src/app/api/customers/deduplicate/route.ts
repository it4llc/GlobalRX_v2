// src/app/api/customers/deduplicate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import logger from '@/lib/logger';
import { getErrorDetails } from '@/lib/utils';

// Validation schema
const deduplicateSchema = z.object({
  keepCustomerId: z.string().uuid(),
  deleteCustomerIds: z.array(z.string().uuid()).min(1)
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'You must be logged in to perform this action' },
        { status: 401 }
      );
    }

    // 2. Authorization check - Require specific edit permission for deduplication
    // Deduplication is a destructive operation that modifies customer data
    if (!session.user?.permissions?.customers?.edit) {
      return NextResponse.json(
        { error: 'You need customers.edit permission to deduplicate customers' },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validationResult = deduplicateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const { keepCustomerId, deleteCustomerIds } = validationResult.data;

    // 4. Check if the customer to keep exists
    const keepCustomer = await prisma.customer.findUnique({
      where: { id: keepCustomerId }
    });

    if (!keepCustomer) {
      return NextResponse.json(
        { error: 'The customer to keep was not found in the database' },
        { status: 404 }
      );
    }

    // 5. Process each customer to delete
    for (const deleteCustomerId of deleteCustomerIds) {
      // Skip if trying to delete the keep customer (safeguard)
      if (deleteCustomerId === keepCustomerId) continue;

      // Check if the customer to delete exists
      const deleteCustomer = await prisma.customer.findUnique({
        where: { id: deleteCustomerId }
      });

      if (!deleteCustomer) {
        logger.warn('Customer to delete not found', { customerId: deleteCustomerId });
        continue;
      }

      try {
        // Begin transaction to ensure all operations succeed or fail together
        await prisma.$transaction(async (tx) => {
          // Move packages to keep customer
          await tx.package.updateMany({
            where: { customerId: deleteCustomerId },
            data: { customerId: keepCustomerId }
          });

          // Update subaccount relationships
          await tx.customer.updateMany({
            where: { masterAccountId: deleteCustomerId },
            data: { masterAccountId: keepCustomerId }
          });

          // Update billing relationships
          await tx.customer.updateMany({
            where: { billingAccountId: deleteCustomerId },
            data: { billingAccountId: keepCustomerId }
          });

          // Delete the duplicate customer
          await tx.customer.delete({
            where: { id: deleteCustomerId }
          });
        });
      } catch (txError: unknown) {
        logger.error('Transaction failed for customer', { customerId: deleteCustomerId, error: getErrorDetails(txError).message, stack: getErrorDetails(txError).stack });
        return NextResponse.json(
          { 
            error: `Failed to deduplicate customer ${deleteCustomerId}. Database operation failed.`,
            details: getErrorDetails(txError).message
          },
          { status: 500 }
        );
      }
    }

    // 6. Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Customers deduplicated successfully'
    });
  } catch (error: unknown) {
    logger.error('Error in deduplication process', { error: getErrorDetails(error).message, stack: getErrorDetails(error).stack });
    return NextResponse.json(
      { 
        error: 'An error occurred during deduplication',
        details: getErrorDetails(error).message
      },
      { status: 500 }
    );
  }
}