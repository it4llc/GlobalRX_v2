// scripts/aggressive-cleanup-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function aggressiveCleanup() {
  try {
    console.log('🧹 Starting aggressive customer cleanup...');

    // Get all customers
    const allCustomers = await prisma.customer.findMany({
      include: {
        users: true,
        orders: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${allCustomers.length} total customers`);

    // Group customers by name
    const customersByName = new Map();

    for (const customer of allCustomers) {
      if (!customersByName.has(customer.name)) {
        customersByName.set(customer.name, []);
      }
      customersByName.get(customer.name).push(customer);
    }

    console.log(`Found ${customersByName.size} unique customer names`);

    // For each group, keep only the one with users or orders, otherwise the first one
    const customersToKeep = [];
    const customersToDelete = [];

    for (const [name, customers] of customersByName) {
      if (customers.length === 1) {
        customersToKeep.push(customers[0]);
        console.log(`✅ KEEPING: ${name} (only one)`);
      } else {
        // Find the best one to keep
        const withUsers = customers.find(c => c.users.length > 0);
        const withOrders = customers.find(c => c.orders.length > 0);
        const toKeep = withUsers || withOrders || customers[0]; // First one if no data

        customersToKeep.push(toKeep);

        const toDelete = customers.filter(c => c.id !== toKeep.id);
        customersToDelete.push(...toDelete);

        console.log(`✅ KEEPING: ${name} (${toKeep.users.length} users, ${toKeep.orders.length} orders)`);
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

    // Delete the duplicate customers
    const deleteIds = customersToDelete.map(c => c.id);

    await prisma.customer.deleteMany({
      where: {
        id: {
          in: deleteIds
        }
      }
    });

    console.log(`\n🎉 Cleanup complete! Deleted ${customersToDelete.length} duplicate customers.`);

    // Show final customer list
    const finalCustomers = await prisma.customer.findMany({
      include: {
        users: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            userType: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log('\n📋 Final clean customer list:');
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
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

aggressiveCleanup().catch(console.error);