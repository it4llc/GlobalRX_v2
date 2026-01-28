// Test customer services access
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking customer service access...\n');

  // Get customers
  const customers = await prisma.customer.findMany({
    take: 3,
    include: {
      services: {
        include: {
          service: true
        }
      }
    }
  });

  console.log(`Found ${customers.length} customers:`);
  customers.forEach(customer => {
    console.log(`\nCustomer: ${customer.name} (${customer.id})`);
    console.log(`  Services: ${customer.services.length}`);
    customer.services.forEach(cs => {
      console.log(`    - ${cs.service.name} (${cs.service.id})`);
    });
  });

  // Check specific requirement structures
  console.log('\n--- DSX Requirement Field Data ---');
  const fieldRequirements = await prisma.dSXRequirement.findMany({
    where: {
      type: 'field'
    },
    take: 5
  });

  fieldRequirements.forEach(req => {
    console.log(`\nRequirement: ${req.name}`);
    console.log(`  Type: ${req.type}`);
    console.log(`  Field Data:`, req.fieldData);
  });

  await prisma.$disconnect();
}

main().catch(console.error);