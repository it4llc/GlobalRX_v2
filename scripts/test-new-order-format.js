// scripts/test-new-order-format.js
const { PrismaClient } = require('@prisma/client');
const { OrderNumberService } = require('../dist/lib/services/order-number.service');

const prisma = new PrismaClient();

async function testNewOrderFormat() {
  try {
    // Find the test customer user
    const customerUser = await prisma.user.findFirst({
      where: {
        email: 'customer@test.com',
        userType: 'customer',
      },
    });

    if (!customerUser || !customerUser.customerId) {
      console.log('Customer user not found.');
      return;
    }

    console.log(`Customer ID: ${customerUser.customerId}`);

    // Use OrderNumberService to generate the order number with collision handling
    const customerId = customerUser.customerId;
    const orderNumber = await OrderNumberService.generateOrderNumber(customerId);

    console.log(`Generated Order Number: ${orderNumber}`);
    // The OrderNumberService handles date, customer code, and sequence internally

    // Create the order
    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumber,
        customerId: customerUser.customerId,
        userId: customerUser.id,
        statusCode: 'draft',
        subject: {
          firstName: 'Test',
          lastName: 'Format',
          email: 'test.format@example.com',
        },
        notes: 'Testing new order number format',
      },
    });

    console.log('\n✓ Successfully created order with new format!');
    console.log(`  Order ID: ${order.id}`);
    console.log(`  Order Number: ${order.orderNumber}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewOrderFormat();