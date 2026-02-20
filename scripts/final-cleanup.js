// scripts/final-cleanup.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCleanup() {
  try {
    console.log('🧹 Final cleanup - keeping only essential accounts...');

    // Get all customers
    const allCustomers = await prisma.customer.findMany({
      include: {
        users: true
      }
    });

    console.log(`Found ${allCustomers.length} total customers`);

    // Identify customers to keep
    const customerWithUser = allCustomers.find(c =>
      c.users.some(u => u.email === 'customer@test.com')
    );
    const testCustomer = allCustomers.find(c => c.name === '1-Test Customer');

    console.log('\n✅ KEEPING:');
    if (customerWithUser) {
      console.log(`  - ${customerWithUser.name} (has user: ${customerWithUser.users[0].email})`);
    }
    if (testCustomer) {
      console.log(`  - ${testCustomer.name} (test account)`);
    }

    // Get customers to delete
    const keepIds = [];
    if (customerWithUser) keepIds.push(customerWithUser.id);
    if (testCustomer) keepIds.push(testCustomer.id);

    const customersToDelete = allCustomers.filter(c => !keepIds.includes(c.id));

    console.log(`\n❌ DELETING: ${customersToDelete.length} accounts`);
    customersToDelete.forEach(customer => {
      console.log(`  - ${customer.name}`);
    });

    if (customersToDelete.length === 0) {
      console.log('✨ No cleanup needed!');
      return;
    }

    // Delete customers one by one with proper cascade handling
    for (const customer of customersToDelete) {
      console.log(`🗑️  Deleting: ${customer.name}`);

      try {
        await prisma.$transaction(async (tx) => {
          // Delete all related records in the correct order
          await tx.customerUser.deleteMany({ where: { customerId: customer.id } });
          await tx.customerService.deleteMany({ where: { customerId: customer.id } });

          // Delete order-related records
          await tx.orderStatusHistory.deleteMany({
            where: { order: { customerId: customer.id } }
          });
          await tx.orderData.deleteMany({
            where: { orderItem: { order: { customerId: customer.id } } }
          });
          await tx.orderDocument.deleteMany({
            where: { orderItem: { order: { customerId: customer.id } } }
          });
          await tx.orderItem.deleteMany({
            where: { order: { customerId: customer.id } }
          });
          await tx.order.deleteMany({ where: { customerId: customer.id } });

          // Delete any workflows or packages that reference this customer
          await tx.workflow.deleteMany({ where: { packageId: { in:
            await tx.package.findMany({
              where: { customerId: customer.id },
              select: { id: true }
            }).then(packages => packages.map(p => p.id))
          }}});
          await tx.package.deleteMany({ where: { customerId: customer.id } });

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
        },
        services: {
          include: { service: { select: { name: true } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`\n🎉 Final cleanup complete! Remaining customers: ${finalCustomers.length}`);
    console.log('\n📋 Final customer list:');
    finalCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name}`);
      customer.users.forEach(user => {
        console.log(`   👤 ${user.firstName} ${user.lastName} (${user.email}) - ${user.userType}`);
      });
      if (customer.users.length === 0) {
        console.log(`   👤 No users assigned`);
      }
      console.log(`   🎯 Services: ${customer.services.length}`);
      customer.services.forEach(cs => {
        console.log(`      - ${cs.service.name}`);
      });
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

finalCleanup().catch(console.error);