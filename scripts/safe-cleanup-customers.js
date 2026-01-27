// scripts/safe-cleanup-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function safeCleanup() {
  try {
    console.log('🧹 Starting safe customer cleanup with proper cascade handling...');

    // Get all customers with their relationships
    const allCustomers = await prisma.customer.findMany({
      include: {
        users: true,
        orders: true,
        services: true,
        packages: true,
        customerUsers: true,
        billedAccounts: true,
        subaccounts: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${allCustomers.length} total customers`);

    // Group customers by name to identify duplicates
    const customersByName = new Map();
    for (const customer of allCustomers) {
      if (!customersByName.has(customer.name)) {
        customersByName.set(customer.name, []);
      }
      customersByName.get(customer.name).push(customer);
    }

    // Identify customers to keep vs delete
    const customersToKeep = [];
    const customersToDelete = [];

    for (const [name, customers] of customersByName) {
      if (customers.length === 1) {
        customersToKeep.push(customers[0]);
        console.log(`✅ KEEPING: ${name} (only one)`);
      } else {
        // Priority: 1) Has users, 2) Has orders, 3) Has services, 4) First one
        const withUsers = customers.find(c => c.users.length > 0);
        const withOrders = customers.find(c => c.orders.length > 0);
        const withServices = customers.find(c => c.services.length > 0);
        const toKeep = withUsers || withOrders || withServices || customers[0];

        customersToKeep.push(toKeep);
        const toDelete = customers.filter(c => c.id !== toKeep.id);
        customersToDelete.push(...toDelete);

        console.log(`✅ KEEPING: ${name} (${toKeep.users.length} users, ${toKeep.orders.length} orders, ${toKeep.services.length} services)`);
        console.log(`❌ REMOVING: ${toDelete.length} duplicates of "${name}"`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Keeping: ${customersToKeep.length} customers`);
    console.log(`  Deleting: ${customersToDelete.length} customers`);

    if (customersToDelete.length === 0) {
      console.log('✨ No cleanup needed!');
      return;
    }

    // Delete customers one by one with proper cascade handling
    for (const customer of customersToDelete) {
      console.log(`🗑️  Deleting: ${customer.name} (${customer.id.substring(0, 8)}...)`);

      try {
        // Use transaction to ensure consistency
        await prisma.$transaction(async (tx) => {
          // Delete related records first
          await tx.customerUser.deleteMany({ where: { customerId: customer.id } });
          await tx.customerService.deleteMany({ where: { customerId: customer.id } });
          await tx.orderStatusHistory.deleteMany({
            where: {
              order: { customerId: customer.id }
            }
          });
          await tx.orderData.deleteMany({
            where: {
              orderItem: {
                order: { customerId: customer.id }
              }
            }
          });
          await tx.orderDocument.deleteMany({
            where: {
              orderItem: {
                order: { customerId: customer.id }
              }
            }
          });
          await tx.orderItem.deleteMany({
            where: {
              order: { customerId: customer.id }
            }
          });
          await tx.order.deleteMany({ where: { customerId: customer.id } });

          // Delete the customer
          await tx.customer.delete({ where: { id: customer.id } });
        });

        console.log(`    ✅ Deleted successfully`);
      } catch (error) {
        console.log(`    ❌ Error deleting: ${error.message}`);
      }
    }

    // Show final results
    const finalCustomers = await prisma.customer.findMany({
      include: {
        users: {
          select: { email: true, firstName: true, lastName: true, userType: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`\n✨ Cleanup complete! Final customer count: ${finalCustomers.length}`);
    console.log('\n📋 Clean customer list:');
    finalCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name}`);
      customer.users.forEach(user => {
        console.log(`   👤 ${user.firstName} ${user.lastName} (${user.email}) - ${user.userType}`);
      });
      if (customer.users.length === 0) {
        console.log(`   👤 No users assigned`);
      }
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

safeCleanup().catch(console.error);