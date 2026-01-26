// scripts/test-new-order-format.js
const { PrismaClient } = require('@prisma/client');

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

    // Create a new order directly using Prisma to test the format
    // We'll manually generate the order number using the same logic
    const customerId = customerUser.customerId;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const hash = customerId.replace(/-/g, '').substring(0, 8);

    let customerCode = '';
    for (let i = 0; i < 3; i++) {
      const hexPair = hash.substring(i * 2, i * 2 + 2);
      const index = parseInt(hexPair, 16) % chars.length;
      customerCode += chars.charAt(index);
    }

    const date = new Date();
    const dateStr = date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');

    // Get today's order count for this customer
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await prisma.order.count({
      where: {
        customerId: customerId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    const orderNumber = `${dateStr}-${customerCode}-${sequence}`;

    console.log(`Generated Order Number: ${orderNumber}`);
    console.log(`  Date: ${dateStr}`);
    console.log(`  Customer Code: ${customerCode} (consistent for this customer)`);
    console.log(`  Sequence: ${sequence} (order #${count + 1} today)`);

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