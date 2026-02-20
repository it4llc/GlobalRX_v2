// scripts/clear-customer-data.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCustomerData() {
  console.log('Starting customer data cleanup...');

  try {
    // Show current counts before deletion
    const counts = await Promise.all([
      prisma.workflow.count(),
      prisma.packageService.count(),
      prisma.package.count(),
      prisma.customerService.count(),
      prisma.customer.count()
    ]);

    console.log('\nCurrent data counts:');
    console.log(`  Workflows: ${counts[0]}`);
    console.log(`  Package Services: ${counts[1]}`);
    console.log(`  Packages: ${counts[2]}`);
    console.log(`  Customer Services: ${counts[3]}`);
    console.log(`  Customers: ${counts[4]}`);

    console.log('\nDeleting customer-related data in proper order...');

    // Delete in order to respect foreign key constraints
    // 1. Delete workflows (depends on packages) - workflows have cascade delete for sections
    console.log('1. Deleting workflows...');
    const deletedWorkflows = await prisma.workflow.deleteMany({});
    console.log(`   Deleted ${deletedWorkflows.count} workflows`);

    // 2. Delete package services (depends on packages and services)
    console.log('2. Deleting package services...');
    const deletedPackageServices = await prisma.packageService.deleteMany({});
    console.log(`   Deleted ${deletedPackageServices.count} package services`);

    // 3. Delete packages (depends on customers)
    console.log('3. Deleting packages...');
    const deletedPackages = await prisma.package.deleteMany({});
    console.log(`   Deleted ${deletedPackages.count} packages`);

    // 4. Delete customer services (depends on customers and services)
    console.log('4. Deleting customer services...');
    const deletedCustomerServices = await prisma.customerService.deleteMany({});
    console.log(`   Deleted ${deletedCustomerServices.count} customer services`);

    // 5. Delete customers (this will also handle master/billing account relationships)
    console.log('5. Deleting customers...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`   Deleted ${deletedCustomers.count} customers`);

    // Verify everything is cleaned up
    const finalCounts = await Promise.all([
      prisma.workflow.count(),
      prisma.packageService.count(),
      prisma.package.count(),
      prisma.customerService.count(),
      prisma.customer.count()
    ]);

    console.log('\nFinal data counts:');
    console.log(`  Workflows: ${finalCounts[0]}`);
    console.log(`  Package Services: ${finalCounts[1]}`);
    console.log(`  Packages: ${finalCounts[2]}`);
    console.log(`  Customer Services: ${finalCounts[3]}`);
    console.log(`  Customers: ${finalCounts[4]}`);

    if (finalCounts.every(count => count === 0)) {
      console.log('\n✅ Customer data cleanup completed successfully!');
      console.log('All customer-related records have been removed.');
    } else {
      console.log('\n⚠️  Warning: Some records may still remain.');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
    console.log('\nThis could be due to foreign key constraints.');
    console.log('You may need to check for any remaining dependencies.');
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will delete ALL customer data including:');
console.log('   - All customers (master accounts and subaccounts)');
console.log('   - All packages associated with customers');
console.log('   - All workflows and workflow sections');
console.log('   - All customer-service relationships');
console.log('   - All package-service relationships');
console.log('');
console.log('   Services, users, and other data will NOT be affected.');
console.log('');

// Run the cleanup
clearCustomerData();