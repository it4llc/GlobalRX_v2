// Export DSX Mappings from development database
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportDSXMappings() {
  try {
    // Get all DSX Mappings with related data
    const mappings = await prisma.dSXMapping.findMany({
      include: {
        service: { select: { name: true, id: true } },
        country: { select: { name: true, id: true } },
        requirement: { select: { name: true, id: true, type: true } }
      },
      orderBy: [
        { serviceId: 'asc' },
        { locationId: 'asc' },
        { requirementId: 'asc' }
      ]
    });

    console.log(`Found ${mappings.length} DSX mappings`);

    // Group by service for better understanding
    const byService = {};
    mappings.forEach(mapping => {
      const serviceName = mapping.service.name;
      if (!byService[serviceName]) {
        byService[serviceName] = {
          serviceId: mapping.serviceId,
          locations: new Set(),
          mappings: []
        };
      }
      byService[serviceName].locations.add(mapping.locationId);
      byService[serviceName].mappings.push(mapping);
    });

    // Print summary
    console.log('\n=== DSX Mappings Summary ===');
    for (const [serviceName, data] of Object.entries(byService)) {
      console.log(`\n${serviceName}:`);
      console.log(`  - ${data.locations.size} locations`);
      console.log(`  - ${data.mappings.length} total mappings`);

      // Show sample mappings
      const samples = data.mappings.slice(0, 3);
      samples.forEach(m => {
        console.log(`    • ${m.country.name} requires ${m.requirement.name} (${m.requirement.type})`);
      });
      if (data.mappings.length > 3) {
        console.log(`    ... and ${data.mappings.length - 3} more`);
      }
    }

    // Create a JavaScript seed file for the mappings
    const seedContent = `// DSX Mappings seed data
// Generated from development database
const dsxMappings = ${JSON.stringify(mappings.map(m => ({
      serviceId: m.serviceId,
      locationId: m.locationId,
      requirementId: m.requirementId,
      isRequired: m.isRequired
    })), null, 2)};

module.exports = { dsxMappings };`;

    fs.writeFileSync('prisma/dsx-mappings-data.js', seedContent);
    console.log('\nExported mappings to prisma/dsx-mappings-data.js');

    // Also get DSX Availability data
    const availability = await prisma.dSXAvailability.findMany({
      include: {
        service: { select: { name: true } },
        country: { select: { name: true } }
      }
    });

    console.log(`\n=== DSX Availability: ${availability.length} records ===`);

    // Create availability seed data
    const availabilityContent = `// DSX Availability seed data
// Generated from development database
const dsxAvailability = ${JSON.stringify(availability.map(a => ({
      serviceId: a.serviceId,
      locationId: a.locationId,
      isAvailable: a.isAvailable
    })), null, 2)};

module.exports = { dsxAvailability };`;

    fs.writeFileSync('prisma/dsx-availability-data.js', availabilityContent);
    console.log('Exported availability to prisma/dsx-availability-data.js');

  } catch (error) {
    console.error('Error exporting DSX mappings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDSXMappings();