const { PrismaClient } = require('@prisma/client');

// Use development database to check what data should exist
const prisma = new PrismaClient();

async function checkDSXData() {
  try {
    // Check DSX Requirements
    const dsxRequirements = await prisma.dSXRequirement.findMany({
      include: {
        serviceRequirements: {
          include: {
            service: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`\n=== DSX Requirements (${dsxRequirements.length} total) ===`);
    dsxRequirements.forEach(req => {
      console.log(`\nRequirement: ${req.name} (${req.type})`);
      console.log(`  ID: ${req.id}`);
      if (req.serviceRequirements.length > 0) {
        console.log(`  Associated Services:`);
        req.serviceRequirements.forEach(sr => {
          console.log(`    - ${sr.service.name} (Order: ${sr.displayOrder})`);
        });
      }
    });

    // Check ServiceRequirement associations
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      include: {
        service: { select: { name: true } },
        requirement: { select: { name: true, type: true } }
      }
    });

    console.log(`\n=== Service-Requirement Associations (${serviceRequirements.length} total) ===`);
    const serviceGroups = {};
    serviceRequirements.forEach(sr => {
      const serviceName = sr.service.name;
      if (!serviceGroups[serviceName]) {
        serviceGroups[serviceName] = [];
      }
      serviceGroups[serviceName].push(sr);
    });

    for (const [serviceName, srs] of Object.entries(serviceGroups)) {
      console.log(`\nService: ${serviceName}`);
      srs.forEach(sr => {
        console.log(`  - ${sr.requirement.name} (${sr.requirement.type}) - Order: ${sr.displayOrder}`);
      });
    }

    // Check DSX Availability
    const dsxAvailability = await prisma.dSXAvailability.count();
    console.log(`\n=== DSX Availability: ${dsxAvailability} records ===`);

    // Check DSX Mappings
    const dsxMappings = await prisma.dSXMapping.count();
    console.log(`\n=== DSX Mappings: ${dsxMappings} records ===`);

    // Get sample mappings for first service
    if (dsxRequirements.length > 0) {
      const firstServiceId = dsxRequirements[0].serviceId;
      const sampleMappings = await prisma.dSXMapping.findMany({
        where: { serviceId: firstServiceId },
        take: 5,
        include: {
          location: { select: { name: true } },
          requirement: { select: { name: true } }
        }
      });

      if (sampleMappings.length > 0) {
        console.log('\nSample DSX Mappings:');
        sampleMappings.forEach(map => {
          console.log(`  - ${map.location.name} requires ${map.requirement.name}`);
        });
      }
    }

  } catch (error) {
    console.error('Error checking DSX data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDSXData();