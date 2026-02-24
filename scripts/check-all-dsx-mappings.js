const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllDSXMappings() {
  try {
    // First find the Education Verification service
    const service = await prisma.service.findFirst({
      where: {
        name: { contains: 'Education' }
      }
    });

    if (!service) {
      console.log('Education Verification service not found');
      return;
    }

    console.log('Service:', service.name);
    console.log('Service ID:', service.id);
    console.log('=====================================\n');

    // Check for "ALL" location mapping (special ALL location)
    console.log('Checking for ALL location mappings:');
    console.log('-----------------------------------');

    // Check for a special "ALL" location
    const allLocation = await prisma.country.findFirst({
      where: {
        OR: [
          { name: 'ALL' },
          { code2: 'ALL' },
          { name: 'All' }
        ]
      }
    });

    if (allLocation) {
      console.log(`\nFound ALL location: ${allLocation.name} (ID: ${allLocation.id})`);

      const allMappingsSpecial = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: allLocation.id
        },
        include: {
          requirement: true
        }
      });

      if (allMappingsSpecial.length > 0) {
        console.log('Mappings for ALL location:');
        allMappingsSpecial.forEach(m => {
          console.log(`  - ${m.requirement.name}: isRequired = ${m.isRequired}`);
        });
      }
    } else {
      console.log('No special ALL location found');
    }

    console.log('\n=====================================');
    console.log('Sample country mappings (USA):');
    console.log('-----------------------------------');

    const usa = await prisma.country.findFirst({
      where: {
        OR: [
          { code2: 'US' },
          { name: { contains: 'United States' } }
        ]
      }
    });

    if (usa) {
      const usaMappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: usa.id
        },
        include: {
          requirement: true
        }
      });

      console.log(`Mappings for ${usa.name}:`);
      usaMappings.forEach(m => {
        console.log(`  - ${m.requirement.name}: isRequired = ${m.isRequired}`);
      });
    }

    console.log('\n=====================================');
    console.log('Service Requirements (base level):');
    console.log('-----------------------------------');

    const serviceReqs = await prisma.serviceRequirement.findMany({
      where: {
        serviceId: service.id
      },
      include: {
        requirement: true
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });

    serviceReqs.forEach(sr => {
      console.log(`  - ${sr.requirement.name}`);
      console.log(`    Display Order: ${sr.displayOrder}`);
      console.log(`    isRequired field: ${sr.isRequired ?? 'not present'}`);
    });

    // Check how many countries have mappings
    console.log('\n=====================================');
    console.log('DSX Mapping Statistics:');
    console.log('-----------------------------------');

    const allCountries = await prisma.country.count({
      where: { parentId: null }
    });

    const mappingStats = await prisma.dSXMapping.groupBy({
      by: ['requirementId', 'isRequired'],
      where: {
        serviceId: service.id
      },
      _count: true
    });

    console.log(`Total countries: ${allCountries}`);
    console.log('\nPer requirement statistics:');

    const reqMap = new Map();
    mappingStats.forEach(stat => {
      if (!reqMap.has(stat.requirementId)) {
        reqMap.set(stat.requirementId, { required: 0, notRequired: 0 });
      }
      if (stat.isRequired) {
        reqMap.get(stat.requirementId).required = stat._count;
      } else {
        reqMap.get(stat.requirementId).notRequired = stat._count;
      }
    });

    for (const [reqId, counts] of reqMap) {
      const req = await prisma.dSXRequirement.findUnique({
        where: { id: reqId }
      });
      if (req) {
        console.log(`\n  ${req.name}:`);
        console.log(`    - Required in ${counts.required} locations`);
        console.log(`    - Not required in ${counts.notRequired} locations`);
        console.log(`    - Total coverage: ${counts.required + counts.notRequired}/${allCountries}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllDSXMappings();