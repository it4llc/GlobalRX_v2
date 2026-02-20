// scripts/simple-clear-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCustomerData() {
  console.log('Starting simple customer data cleanup...');

  try {
    // Test if Prisma client is working
    console.log('Testing Prisma client...');
    const customerCount = await prisma.customer.count();
    console.log(`Found ${customerCount} customers`);

    // Show current counts
    console.log('\nCurrent counts:');
    try {
      const workflowCount = await prisma.workflow.count();
      console.log(`Workflows: ${workflowCount}`);
    } catch (e) {
      console.log('Workflows: Error -', e.message);
    }

    try {
      const packageServiceCount = await prisma.packageService.count();
      console.log(`Package Services: ${packageServiceCount}`);
    } catch (e) {
      console.log('Package Services: Error -', e.message);
    }

    try {
      const packageCount = await prisma.package.count();
      console.log(`Packages: ${packageCount}`);
    } catch (e) {
      console.log('Packages: Error -', e.message);
    }

    try {
      const customerServiceCount = await prisma.customerService.count();
      console.log(`Customer Services: ${customerServiceCount}`);
    } catch (e) {
      console.log('Customer Services: Error -', e.message);
    }

    // Now try to delete in order
    console.log('\nDeleting data...');

    // 1. Try to delete workflows first (they depend on packages)
    try {
      const result0 = await prisma.workflow.deleteMany({});
      console.log(`✅ Deleted ${result0.count} workflows`);
    } catch (e) {
      console.log(`❌ Failed to delete workflows: ${e.message}`);
    }

    // 2. Try to delete package services
    try {
      const result1 = await prisma.packageService.deleteMany({});
      console.log(`✅ Deleted ${result1.count} package services`);
    } catch (e) {
      console.log(`❌ Failed to delete package services: ${e.message}`);
    }

    // 3. Try to delete packages
    try {
      const result2 = await prisma.package.deleteMany({});
      console.log(`✅ Deleted ${result2.count} packages`);
    } catch (e) {
      console.log(`❌ Failed to delete packages: ${e.message}`);
    }

    // 4. Try to delete customer services
    try {
      const result3 = await prisma.customerService.deleteMany({});
      console.log(`✅ Deleted ${result3.count} customer services`);
    } catch (e) {
      console.log(`❌ Failed to delete customer services: ${e.message}`);
    }

    // 5. Finally delete customers
    try {
      const result4 = await prisma.customer.deleteMany({});
      console.log(`✅ Deleted ${result4.count} customers`);
    } catch (e) {
      console.log(`❌ Failed to delete customers: ${e.message}`);
    }

    // Verify final counts
    console.log('\nFinal verification:');
    const finalCustomerCount = await prisma.customer.count();
    console.log(`Remaining customers: ${finalCustomerCount}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCustomerData();