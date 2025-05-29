// src/app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema
const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email address").optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  masterAccountId: z.string().uuid().optional().nullable(),
  billingAccountId: z.string().uuid().optional().nullable(),
  invoiceTerms: z.string().optional().nullable(),
  invoiceContact: z.string().optional().nullable(),
  invoiceMethod: z.string().optional().nullable(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

// Helper function to check permissions with array structure
function hasPermission(permissions: any, resource: string, action: string): boolean {
  if (!permissions || !permissions[resource]) {
    return false;
  }
  
  // If permissions are stored as arrays (e.g., customers: ["*"])
  if (Array.isArray(permissions[resource])) {
    return permissions[resource].includes('*') || 
           permissions[resource].includes(action);
  }
  
  // If permissions are stored as objects (e.g., customers: { view: true })
  return !!permissions[resource][action];
}

/**
 * @route GET /api/customers
 * @desc Get a list of customers with pagination and filtering
 * @access Private - Requires customers.view permission
 */
export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/customers - Starting request processing");
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("GET /api/customers - No session found");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log("GET /api/customers - Session found, user:", session.user?.email);
    console.log("GET /api/customers - Permissions:", JSON.stringify(session.user?.permissions));

    // Check permissions - UPDATED to work with array structure
    const hasViewPermission = hasPermission(session.user.permissions, 'customers', 'view');
    console.log("GET /api/customers - Has view permission:", hasViewPermission);
    
    if (!hasViewPermission) {
      console.log("GET /api/customers - Permission denied");
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '25');
    const search = searchParams.get('search') || '';
    const masterOnly = searchParams.get('masterOnly') === 'true';
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    
    console.log("GET /api/customers - Query params:", { page, pageSize, search, masterOnly, includeDisabled });

    // Build the query
    const where: any = {};
    
    // Filtering logic
    if (!includeDisabled) {
      where.disabled = false;
    }
    
    if (masterOnly) {
      where.masterAccountId = null;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    console.log("GET /api/customers - Where clause:", JSON.stringify(where));

    try {
      console.log("GET /api/customers - Executing database queries");
      
      // Execute the query with enhanced relations
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            // Include services relation (based on prisma schema)
            services: {
              include: {
                service: true
              }
            },
            // Use the exact relation names from the schema
            masterAccount: true,
            billingAccount: true,
            // Count related records
            _count: {
              select: {
                subaccounts: true,
                packages: true
              }
            }
          },
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.customer.count({ where }),
      ]);
      
      console.log(`GET /api/customers - Found ${customers.length} customers out of ${total} total`);

      // Format the response with additional customer details
      const formattedCustomers = customers.map(customer => ({
        id: customer.id,
        name: customer.name,
        contactName: customer.contactName,
        contactEmail: customer.contactEmail,
        contactPhone: customer.contactPhone,
        address: customer.address,
        invoiceTerms: customer.invoiceTerms,
        invoiceContact: customer.invoiceContact,
        invoiceMethod: customer.invoiceMethod,
        // Include master account details if available
        masterAccount: customer.masterAccount ? {
          id: customer.masterAccount.id,
          name: customer.masterAccount.name
        } : null,
        // Include billing account details if available
        billingAccount: customer.billingAccount ? {
          id: customer.billingAccount.id,
          name: customer.billingAccount.name
        } : null,
        masterAccountId: customer.masterAccountId,
        billingAccountId: customer.billingAccountId,
        subaccountsCount: customer._count.subaccounts,
        packagesCount: customer._count.packages,
        disabled: customer.disabled,
        // Format services for easier consumption
        services: customer.services.map(cs => ({
          id: cs.service.id,
          name: cs.service.name,
          category: cs.service.category
        })),
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }));

      console.log("GET /api/customers - Successfully formatted response");
      
      return NextResponse.json({
        data: formattedCustomers,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (dbError) {
      console.error("GET /api/customers - Database error:", dbError);
      return NextResponse.json(
        { error: 'Database error', details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/customers:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/customers
 * @desc Create a new customer
 * @access Private - Requires customers.create permission
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - UPDATED to work with array structure
    if (!hasPermission(session.user.permissions, 'customers', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate the request body
    const body = await request.json();
    const validationResult = customerSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const { serviceIds, ...customerData } = data;

    // Validation for master and billing account relationships
    if (data.masterAccountId) {
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

    // Create the customer with transaction to handle service relationships
    const customer = await prisma.$transaction(async (tx) => {
      // Create the customer
      const newCustomer = await tx.customer.create({
        data: customerData,
      });

      // Create service relationships if provided
      if (serviceIds && serviceIds.length > 0) {
        await Promise.all(
          serviceIds.map(serviceId =>
            tx.customerService.create({
              data: {
                customerId: newCustomer.id,
                serviceId,
              },
            })
          )
        );
      }

      return newCustomer;
    });

    // Return the created customer with services relation
    const createdCustomerWithRelations = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        services: {
          include: {
            service: true
          }
        }
      }
    });

    return NextResponse.json(createdCustomerWithRelations, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/customers:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}