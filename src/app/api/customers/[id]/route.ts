// src/app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updating a customer
const customerUpdateSchema = z.object({
  name: z.string().min(1, "Customer name is required").optional(),
  address: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email("Invalid email address").optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  masterAccountId: z.string().uuid().optional().nullable(),
  billingAccountId: z.string().uuid().optional().nullable(),
  invoiceTerms: z.string().optional().nullable(),
  invoiceContact: z.string().optional().nullable(),
  invoiceMethod: z.string().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).optional(),
  // Branding fields
  primaryColor: z.string().optional().nullable(),
  secondaryColor: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  // Data retention setting
  dataRetentionDays: z.union([
    z.number().int().positive().optional().nullable(),
    z.string().transform(val => val === '' ? null : parseInt(val)).optional().nullable()
  ]),
});

/**
 * Check if a user has permission for a specific resource and action
 * Handles both object-based and array-based permission structures
 */
function hasPermission(user: any, resource: string, action?: string): boolean {
  if (!user?.permissions) return false;
  
  // Case 1: Star permission array like {"customers": ["*"]}
  if (Array.isArray(user.permissions[resource])) {
    return user.permissions[resource].includes('*');
  }
  
  // Case 2: Object with boolean flags like {"customers": {"view": true}}
  if (typeof user.permissions[resource] === 'object' && action) {
    return !!user.permissions[resource][action];
  }
  
  // If we have the resource but no action specified
  return !!user.permissions[resource];
}

/**
 * @route GET /api/customers/[id]
 * @desc Get a specific customer by ID
 * @access Private - Requires customers.view permission
 */
export async function GET(
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

    // Check permissions using the helper function
    if (!hasPermission(session.user, 'customers', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Get customer with related data
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        masterAccount: {
          select: { id: true, name: true }
        },
        billingAccount: {
          select: { id: true, name: true }
        },
        services: {
          include: {
            service: true
          }
        },
        subaccounts: {
          select: {
            id: true,
            name: true,
            disabled: true
          }
        },
        billedAccounts: {
          select: {
            id: true,
            name: true,
            disabled: true
          }
        },
        packages: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: `Customer with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Format services for easier consumption
    const formattedCustomer = {
      ...customer,
      serviceIds: customer.services.map(cs => cs.service.id),
      services: customer.services.map(cs => ({
        id: cs.service.id,
        name: cs.service.name,
        category: cs.service.category,
        description: cs.service.description,
        functionalityType: cs.service.functionalityType
      })),
    };

    return NextResponse.json(formattedCustomer);
  } catch (error) {
    console.error(`Error in GET /api/customers/${params.id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * @route PUT /api/customers/[id]
 * @desc Update a specific customer
 * @access Private - Requires customers.edit permission
 */
export async function PUT(
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

    // Check permissions using the helper function
    if (!hasPermission(session.user, 'customers', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: `Customer with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    const validationResult = customerUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const { serviceIds, ...customerData } = data;
    
    // Debug the customer data being sent to the database
    console.log("Customer update data:", JSON.stringify(customerData, null, 2));

    // Validation checks
    if (data.masterAccountId) {
      // Prevent circular references
      if (data.masterAccountId === id) {
        return NextResponse.json(
          { error: 'A customer cannot be its own master account' },
          { status: 400 }
        );
      }

      // Check if master account exists
      const masterExists = await prisma.customer.findUnique({
        where: { id: data.masterAccountId }
      });
      
      if (!masterExists) {
        return NextResponse.json(
          { error: 'Master account not found' },
          { status: 400 }
        );
      }
    }

    if (data.billingAccountId) {
      // Prevent circular references
      if (data.billingAccountId === id) {
        return NextResponse.json(
          { error: 'A customer cannot be its own billing account' },
          { status: 400 }
        );
      }

      // Check if billing account exists
      const billingExists = await prisma.customer.findUnique({
        where: { id: data.billingAccountId }
      });
      
      if (!billingExists) {
        return NextResponse.json(
          { error: 'Billing account not found' },
          { status: 400 }
        );
      }
    }

    // Update customer with transaction to handle service relationships
    try {
      // Extract fields from customerData that we know exist in the schema
      const { 
        name,
        address,
        contactName,
        contactEmail,
        contactPhone,
        invoiceTerms,
        invoiceContact,
        invoiceMethod,
        masterAccountId,
        billingAccountId
      } = customerData;
      
      // Create a clean object with only the fields that exist in the Prisma schema
      const validUpdateData = {
        name,
        address,
        contactName,
        contactEmail, 
        contactPhone,
        invoiceTerms,
        invoiceContact,
        invoiceMethod
      };
      
      // Log the cleaned data
      console.log("Cleaned data for Prisma update:", {
        validUpdateData,
        relationFields: { masterAccountId, billingAccountId },
        // Skip other fields that don't exist in the schema
        ignoredFields: "primaryColor, secondaryColor, accentColor, dataRetentionDays, etc."
      });
      
      // Prepare the update data with correct nested structure for relations
      const prismaUpdateData = {
        ...validUpdateData,
        // If masterAccountId is null, disconnect the relation, otherwise connect to the specified ID
        masterAccount: masterAccountId === null 
          ? { disconnect: true } 
          : masterAccountId 
            ? { connect: { id: masterAccountId } }
            : undefined,
        // If billingAccountId is null, disconnect the relation, otherwise connect to the specified ID
        billingAccount: billingAccountId === null 
          ? { disconnect: true } 
          : billingAccountId
            ? { connect: { id: billingAccountId } }
            : undefined
      };
      
      const updatedCustomer = await prisma.$transaction(async (tx) => {
        // Update the customer
        const customer = await tx.customer.update({
          where: { id },
          data: prismaUpdateData,
        });
        
        // Update service relationships if provided
        if (serviceIds !== undefined) {
          // Delete existing relationships
          await tx.customerService.deleteMany({
            where: { customerId: id }
          });
          
          // Create new relationships
          if (serviceIds.length > 0) {
            await Promise.all(
              serviceIds.map(serviceId =>
                tx.customerService.create({
                  data: {
                    customerId: id,
                    serviceId,
                  },
                })
              )
            );
          }
        }
        
        return customer;
      });
      
      // Fetch the updated customer with all its relations
      const completeCustomer = await prisma.customer.findUnique({
        where: { id },
        include: {
          masterAccount: {
            select: { id: true, name: true }
          },
          billingAccount: {
            select: { id: true, name: true }
          },
          services: {
            include: {
              service: true
            }
          },
          subaccounts: {
            select: {
              id: true,
              name: true,
              disabled: true
            }
          },
          billedAccounts: {
            select: {
              id: true,
              name: true,
              disabled: true
            }
          }
        }
      });
      
      // Format the response
      const formattedCustomer = {
        ...completeCustomer,
        serviceIds: completeCustomer.services.map(cs => cs.service.id),
        services: completeCustomer.services.map(cs => ({
          id: cs.service.id,
          name: cs.service.name,
          category: cs.service.category,
          description: cs.service.description,
          functionalityType: cs.service.functionalityType
        })),
      };
      
      return NextResponse.json(formattedCustomer);
    } catch (txError) {
      console.error("Transaction error:", txError);
      return NextResponse.json(
        { error: txError.message || 'Error updating customer data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`Error in PUT /api/customers/${params.id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/customers/[id]
 * @desc Delete a customer
 * @access Private - Requires customers.delete permission
 */
export async function DELETE(
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

    // Check permissions using the helper function
    if (!hasPermission(session.user, 'customers', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Check if customer has subaccounts or billed accounts
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subaccounts: true,
            billedAccounts: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: `Customer with ID ${id} not found` },
        { status: 404 }
      );
    }

    if (customer._count.subaccounts > 0) {
      return NextResponse.json(
        { error: `Cannot delete customer with ${customer._count.subaccounts} subaccounts` },
        { status: 400 }
      );
    }

    if (customer._count.billedAccounts > 0) {
      return NextResponse.json(
        { error: `Cannot delete customer with ${customer._count.billedAccounts} billed accounts` },
        { status: 400 }
      );
    }

    // Soft delete - set disabled flag instead of actually deleting
    await prisma.customer.update({
      where: { id },
      data: { disabled: true }
    });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error(`Error in DELETE /api/customers/${params.id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}