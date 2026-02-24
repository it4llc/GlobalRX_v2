// scripts/check-service-requirements.js
// Diagnostic script to check ServiceRequirement records for a specific service

const { PrismaClient } = require('@prisma/client');

async function checkServiceRequirements(serviceName = null) {
  const prisma = new PrismaClient();

  try {
    console.log('=== Service Requirements Diagnostic Check ===\n');

    // Get all services or specific service
    const whereClause = serviceName
      ? { name: { contains: serviceName, mode: 'insensitive' } }
      : {};

    const services = await prisma.service.findMany({
      where: whereClause,
      include: {
        serviceRequirements: {
          orderBy: {
            displayOrder: 'asc'
          },
          include: {
            requirement: true
          }
        }
      }
    });

    if (services.length === 0) {
      console.log('No services found matching criteria');
      return;
    }

    for (const service of services) {
      console.log(`\n📦 Service: ${service.name}`);
      console.log(`   ID: ${service.id}`);
      console.log(`   Requirements: ${service.serviceRequirements.length}`);

      if (service.serviceRequirements.length > 0) {
        console.log('\n   Display Order | Requirement Name | Requirement ID');
        console.log('   ' + '-'.repeat(70));

        for (const sr of service.serviceRequirements) {
          const displayOrder = String(sr.displayOrder).padEnd(13);
          const reqName = (sr.requirement.name || 'Unnamed').padEnd(30);
          console.log(`   ${displayOrder} | ${reqName} | ${sr.requirement.id}`);
        }

        // Check for issues
        const duplicateOrders = {};
        const defaultOrders = [];

        service.serviceRequirements.forEach(sr => {
          if (sr.displayOrder === 999) {
            defaultOrders.push(sr.requirement.name);
          }
          if (duplicateOrders[sr.displayOrder]) {
            duplicateOrders[sr.displayOrder].push(sr.requirement.name);
          } else {
            duplicateOrders[sr.displayOrder] = [sr.requirement.name];
          }
        });

        // Report issues
        if (defaultOrders.length > 0) {
          console.log('\n   ⚠️  WARNING: Requirements with default displayOrder (999):');
          defaultOrders.forEach(name => console.log(`      - ${name}`));
        }

        const hasDuplicates = Object.values(duplicateOrders).some(arr => arr.length > 1);
        if (hasDuplicates) {
          console.log('\n   ⚠️  WARNING: Duplicate displayOrder values found:');
          Object.entries(duplicateOrders).forEach(([order, names]) => {
            if (names.length > 1) {
              console.log(`      - Order ${order}: ${names.join(', ')}`);
            }
          });
        }

        if (!defaultOrders.length && !hasDuplicates) {
          console.log('\n   ✅ Display order looks good - no issues detected');
        }
      }
    }

  } catch (error) {
    console.error('Error checking service requirements:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
const serviceName = process.argv[2]; // Optional service name filter
checkServiceRequirements(serviceName)
  .then(() => {
    console.log('\n=== Check complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });