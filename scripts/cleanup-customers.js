// scripts/cleanup-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupCustomers() {
  try {
    console.log('🧹 Starting customer cleanup...');

    // Get all customers
    const allCustomers = await prisma.customer.findMany({
      include: {
        users: true,
        orders: true,
        packages: true,
        services: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${allCustomers.length} total customers`);

    // Find customers to keep:
    // 1. Those with users
    // 2. First instance of each unique name (to keep variety)
    const customersToKeep = [];
    const seenNames = new Set();

    for (const customer of allCustomers) {
      const shouldKeep =
        customer.users.length > 0 || // Has users
        customer.orders.length > 0 || // Has orders
        customer.packages.length > 0 || // Has packages
        customer.services.length > 0 || // Has services
        (!seenNames.has(customer.name) && customersToKeep.length < 5); // First of name and under limit

      if (shouldKeep) {
        customersToKeep.push(customer);
        seenNames.add(customer.name);
        console.log(`✅ KEEPING: ${customer.name} (${customer.users.length} users, ${customer.orders.length} orders)`);
      } else {
        console.log(`❌ REMOVING: ${customer.name} (${customer.id.substring(0, 8)}...)`);
      }
    }

    // Get IDs of customers to delete
    const keepIds = customersToKeep.map(c => c.id);
    const customersToDelete = allCustomers.filter(c => !keepIds.includes(c.id));

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

    console.log('\n📋 Final customer list:');
    finalCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name}`);
      customer.users.forEach(user => {
        console.log(`   👤 ${user.firstName} ${user.lastName} (${user.email}) - ${user.userType}`);
      });
      if (customer.users.length === 0) {
        console.log(`   👤 No users`);
      }
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupCustomers().catch(console.error);