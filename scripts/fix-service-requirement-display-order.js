// scripts/fix-service-requirement-display-order.js
// One-time migration to fix existing ServiceRequirement records with displayOrder = 999

const { PrismaClient } = require('@prisma/client');

async function fixDisplayOrders() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting ServiceRequirement displayOrder migration...');

    // Get all services that have requirements with default displayOrder (999)
    const servicesWithDefaultOrder = await prisma.service.findMany({
      where: {
        serviceRequirements: {
          some: {
            displayOrder: 999
          }
        }
      },
      include: {
        serviceRequirements: {
          where: {
            displayOrder: 999
          },
          orderBy: {
            createdAt: 'asc' // Use creation order as default sequence
          }
        }
      }
    });

    console.log(`Found ${servicesWithDefaultOrder.length} services with requirements needing display order fixes`);

    let totalUpdated = 0;

    // Process each service
    for (const service of servicesWithDefaultOrder) {
      console.log(`\nProcessing service: ${service.name} (${service.id})`);
      console.log(`  - ${service.serviceRequirements.length} requirements to update`);

      // Update each requirement with sequential display order
      for (let i = 0; i < service.serviceRequirements.length; i++) {
        const sr = service.serviceRequirements[i];
        const newDisplayOrder = i * 10;

        await prisma.serviceRequirement.update({
          where: {
            id: sr.id
          },
          data: {
            displayOrder: newDisplayOrder
          }
        });

        console.log(`    Updated requirement ${sr.id} to displayOrder ${newDisplayOrder}`);
        totalUpdated++;
      }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} ServiceRequirement records.`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  fixDisplayOrders()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDisplayOrders };