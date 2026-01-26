// scripts/create-test-order.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestOrder() {
  try {
    // Find the test customer user
    const customerUser = await prisma.user.findFirst({
      where: {
        email: 'customer@test.com',
        userType: 'customer',
      },
    });

    if (!customerUser || !customerUser.customerId) {
      console.log('Customer user not found. Please run: node scripts/create-test-customer-user.js');
      return;
    }

    console.log(`Found customer user: ${customerUser.email}`);
    console.log(`Customer ID: ${customerUser.customerId}`);

    // Create a few test orders with different statuses
    const orders = [
      {
        orderNumber: `TEST-${Date.now()}-001`,
        customerId: customerUser.customerId,
        userId: customerUser.id,
        statusCode: 'completed',
        subject: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@example.com',
          dateOfBirth: '1985-03-15',
        },
        notes: 'Background check completed successfully',
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        orderNumber: `TEST-${Date.now()}-002`,
        customerId: customerUser.customerId,
        userId: customerUser.id,
        statusCode: 'processing',
        subject: {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@example.com',
          dateOfBirth: '1990-07-22',
        },
        notes: 'Currently processing background verification',
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        orderNumber: `TEST-${Date.now()}-003`,
        customerId: customerUser.customerId,
        userId: customerUser.id,
        statusCode: 'submitted',
        subject: {
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob.johnson@example.com',
          dateOfBirth: '1978-11-05',
        },
        notes: 'New order submitted for processing',
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        orderNumber: `TEST-${Date.now()}-004`,
        customerId: customerUser.customerId,
        userId: customerUser.id,
        statusCode: 'draft',
        subject: {
          firstName: 'Alice',
          lastName: 'Williams',
        },
        notes: 'Draft order - not yet submitted',
      },
    ];

    console.log('\nCreating test orders...');

    for (const orderData of orders) {
      const order = await prisma.order.create({
        data: orderData,
      });

      console.log(`✓ Created ${orderData.statusCode} order: ${order.orderNumber}`);

      // Add status history for non-draft orders
      if (orderData.statusCode !== 'draft') {
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'draft',
            toStatus: orderData.statusCode,
            changedBy: customerUser.id,
            reason: `Order ${orderData.statusCode}`,
          },
        });
      }
    }

    // Get order statistics
    const stats = await prisma.order.groupBy({
      by: ['statusCode'],
      where: {
        customerId: customerUser.customerId,
      },
      _count: true,
    });

    console.log('\n========================================');
    console.log('Order Statistics for Test Customer:');
    console.log('========================================');

    const total = stats.reduce((sum, stat) => sum + stat._count, 0);
    console.log(`Total Orders: ${total}`);

    stats.forEach((stat) => {
      console.log(`${stat.statusCode}: ${stat._count}`);
    });

    console.log('========================================\n');
    console.log('You can now login to the portal and see these orders!');
    console.log('Email: customer@test.com');
    console.log('Password: customer123');

  } catch (error) {
    console.error('Error creating test orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestOrder();