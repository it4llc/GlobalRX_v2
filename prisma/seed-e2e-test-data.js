// seed-e2e-test-data.js - Test data for E2E tests
const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating E2E test data...');

    // Hash password for test users
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash('password123', salt);

    // Create test customer
    let customer;
    try {
      customer = await prisma.customer.findFirst({
        where: { name: 'ACME Corporation' }
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            id: 'acme-corp-id',
            name: 'ACME Corporation',
            address: '123 Main St',
            contactName: 'Admin User',
            contactEmail: 'admin@acmecorp.com',
            contactPhone: '555-0123',
          }
        });
      }
    } catch (error) {
      // If customer already exists with that ID, find it
      customer = await prisma.customer.findUnique({
        where: { id: 'acme-corp-id' }
      });
    }

    // Create customer user
    await prisma.user.upsert({
      where: { email: 'customer@acmecorp.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'customer@acmecorp.com',
        password: hashedPassword,
        firstName: 'Customer',
        lastName: 'User',
        userType: 'customer',
        customerId: customer.id,
        permissions: {
          customers: { view: true }
        },
      },
    });

    // Create internal test user
    await prisma.user.upsert({
      where: { email: 'internal@globalrx.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'internal@globalrx.com',
        password: hashedPassword,
        firstName: 'Internal',
        lastName: 'User',
        userType: 'internal',
        permissions: {
          customers: ['*'],
          orders: ['*'],
          services: ['*'],
        },
      },
    });

    // Create admin test user
    await prisma.user.upsert({
      where: { email: 'admin@globalrx.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'admin@globalrx.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        userType: 'admin',
        permissions: {
          customers: ['*'],
          orders: ['*'],
          services: ['*'],
          users: ['*'],
          admin: true,
        },
      },
    });

    // Get the internal user ID for order creation
    const internalUser = await prisma.user.findUnique({
      where: { email: 'internal@globalrx.com' }
    });

    // Create a test country for location
    let testCountry;
    try {
      testCountry = await prisma.country.findFirst({
        where: { code2: 'US' }
      });
      if (!testCountry) {
        testCountry = await prisma.country.create({
          data: {
            id: 'country-us',
            name: 'United States',
            code2: 'US',
            code3: 'USA',
          }
        });
      }
    } catch (error) {
      console.log('Country creation error:', error.message);
      testCountry = { id: 'country-us' };
    }

    // Create test services if they don't exist
    let criminalCheck;
    try {
      criminalCheck = await prisma.service.findFirst({
        where: { code: 'CRIM_CHK' }
      });
      if (!criminalCheck) {
        criminalCheck = await prisma.service.create({
          data: {
            id: 'service-criminal-check',
            name: 'Criminal Background Check',
            description: 'Comprehensive criminal history check',
            category: 'background-check',
            code: 'CRIM_CHK',
          }
        });
      }
    } catch (error) {
      console.log('Service creation error:', error.message);
      criminalCheck = { id: 'service-criminal-check' };
    }

    // Create test orders
    try {
      const testOrder = await prisma.order.findFirst({
        where: { orderNumber: '20240310-ABC-0001' }
      });

      if (!testOrder) {
        await prisma.order.create({
          data: {
            id: 'order-123',
            orderNumber: '20240310-ABC-0001',
            customerId: customer.id,
            userId: internalUser.id,
            statusCode: 'processing',
            subject: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john.doe@example.com'
            },
            totalPrice: 75.00,
            submittedAt: new Date('2024-03-10T10:00:00Z'),
            createdAt: new Date('2024-03-10T09:00:00Z'),
            updatedAt: new Date('2024-03-10T10:00:00Z'),
          }
        });
      }
    } catch (error) {
      console.log('Order creation error:', error.message);
    }

    // Create order with services
    try {
      const orderWithServices = await prisma.order.findFirst({
        where: { orderNumber: '20240310-ABC-0002' }
      });

      if (!orderWithServices) {
        const newOrderWithServices = await prisma.order.create({
          data: {
            id: 'order-with-services',
            orderNumber: '20240310-ABC-0002',
            customerId: customer.id,
            userId: internalUser.id,
            statusCode: 'processing',
            subject: {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane.smith@example.com'
            },
            totalPrice: 75.00,
            submittedAt: new Date('2024-03-10T11:00:00Z'),
            createdAt: new Date('2024-03-10T10:00:00Z'),
            updatedAt: new Date('2024-03-10T11:00:00Z'),
          }
        });

        // Create order items for the services order
        await prisma.orderItem.create({
          data: {
            id: 'order-item-1',
            orderId: newOrderWithServices.id,
            serviceId: criminalCheck.id,
            locationId: testCountry.id,
            status: 'processing',
            price: 75.00,
          }
        });
      }
    } catch (error) {
      console.log('Order with services creation error:', error.message);
    }

    // Create order with comments
    try {
      const orderWithComments = await prisma.order.findFirst({
        where: { orderNumber: '20240310-ABC-0003' }
      });

      if (!orderWithComments) {
        const newOrderWithComments = await prisma.order.create({
          data: {
            id: 'order-with-comments',
            orderNumber: '20240310-ABC-0003',
            customerId: customer.id,
            userId: internalUser.id,
            statusCode: 'processing',
            subject: {
              firstName: 'Bob',
              lastName: 'Johnson',
              email: 'bob.johnson@example.com'
            },
            totalPrice: 75.00,
            submittedAt: new Date('2024-03-10T12:00:00Z'),
            createdAt: new Date('2024-03-10T11:00:00Z'),
            updatedAt: new Date('2024-03-10T12:00:00Z'),
          }
        });

        // Create order item for comments
        const orderItemWithComments = await prisma.orderItem.create({
          data: {
            id: 'order-item-comments',
            orderId: newOrderWithComments.id,
            serviceId: criminalCheck.id,
            locationId: testCountry.id,
            status: 'processing',
            price: 75.00,
          }
        });

        // Create comment template if it doesn't exist
        let commentTemplate;
        try {
          commentTemplate = await prisma.commentTemplate.findFirst({
            where: { shortName: 'General' }
          });
          if (!commentTemplate) {
            commentTemplate = await prisma.commentTemplate.create({
              data: {
                shortName: 'General',
                longName: 'General Comment',
                templateText: 'General comment template',
              }
            });
          }
        } catch (error) {
          console.log('Comment template creation error:', error.message);
        }

        // Create service comments if template exists
        if (commentTemplate) {
          try {
            await prisma.serviceComment.createMany({
              data: [
                {
                  orderItemId: orderItemWithComments.id,
                  templateId: commentTemplate.id,
                  finalText: 'Documents received and under review',
                  isInternalOnly: false,
                  createdBy: internalUser.id,
                  createdAt: new Date('2024-03-10T12:30:00Z'),
                },
                {
                  orderItemId: orderItemWithComments.id,
                  templateId: commentTemplate.id,
                  finalText: 'Additional information may be required',
                  isInternalOnly: false,
                  createdBy: internalUser.id,
                  createdAt: new Date('2024-03-10T13:00:00Z'),
                },
                {
                  orderItemId: orderItemWithComments.id,
                  templateId: commentTemplate.id,
                  finalText: 'Internal: Check with vendor about delay',
                  isInternalOnly: true,
                  createdBy: internalUser.id,
                  createdAt: new Date('2024-03-10T13:30:00Z'),
                },
                {
                  orderItemId: orderItemWithComments.id,
                  templateId: commentTemplate.id,
                  finalText: 'Staff note: Priority customer',
                  isInternalOnly: true,
                  createdBy: internalUser.id,
                  createdAt: new Date('2024-03-10T14:00:00Z'),
                }
              ],
              skipDuplicates: true,
            });
          } catch (error) {
            console.log('Service comments creation error:', error.message);
          }
        }
      }
    } catch (error) {
      console.log('Order with comments creation error:', error.message);
    }

    // Create order for different customer (for permission testing)
    let otherCustomer;
    try {
      otherCustomer = await prisma.customer.findFirst({
        where: { name: 'Other Corp' }
      });
      if (!otherCustomer) {
        otherCustomer = await prisma.customer.create({
          data: {
            id: 'other-corp-id',
            name: 'Other Corp',
            address: '789 Other St',
            contactName: 'Other Admin',
            contactEmail: 'admin@othercorp.com',
            contactPhone: '555-0789',
          }
        });
      }
    } catch (error) {
      otherCustomer = await prisma.customer.findUnique({
        where: { id: 'other-corp-id' }
      });
    }

    try {
      const otherOrder = await prisma.order.findFirst({
        where: { orderNumber: '20240310-XYZ-0001' }
      });

      if (!otherOrder) {
        await prisma.order.create({
          data: {
            id: 'other-customer-order',
            orderNumber: '20240310-XYZ-0001',
            customerId: otherCustomer.id,
            userId: internalUser.id,
            statusCode: 'processing',
            subject: {
              firstName: 'Alice',
              lastName: 'Cooper',
              email: 'alice.cooper@example.com'
            },
            totalPrice: 75.00,
            submittedAt: new Date('2024-03-10T15:00:00Z'),
            createdAt: new Date('2024-03-10T14:00:00Z'),
            updatedAt: new Date('2024-03-10T15:00:00Z'),
          }
        });
      }
    } catch (error) {
      console.log('Other customer order creation error:', error.message);
    }

    console.log('E2E test data created successfully');
    console.log('Created test users:');
    console.log('- customer@acmecorp.com (password: password123)');
    console.log('- internal@globalrx.com (password: password123)');
    console.log('- admin@globalrx.com (password: password123)');
    console.log('Created test orders: 20240310-ABC-0001, 20240310-ABC-0002, 20240310-ABC-0003, 20240310-XYZ-0001');

  } catch (error) {
    console.error('Error creating E2E test data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });