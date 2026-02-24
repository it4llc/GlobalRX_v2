const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEducationVerificationRequirements() {
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

    console.log('Found service:', service.name, '(ID:', service.id, ')');
    console.log('---');

    // Get all ServiceRequirements for this service
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: { serviceId: service.id },
      include: {
        requirement: true
      },
      orderBy: { displayOrder: 'asc' }
    });

    console.log('Service Requirements (', serviceRequirements.length, 'total):');
    serviceRequirements.forEach(sr => {
      console.log(`  - ${sr.requirement.name}`);
      console.log(`    ID: ${sr.requirement.id}`);
      console.log(`    Type: ${sr.requirement.type}`);
      console.log(`    Display Order: ${sr.displayOrder}`);
      console.log(`    Is Required (in ServiceRequirement): ${sr.isRequired ?? 'field not present'}`);
      console.log(`    Disabled: ${sr.requirement.disabled}`);

      if (sr.requirement.fieldData) {
        const fieldData = sr.requirement.fieldData;
        console.log(`    Field Data:`);
        console.log(`      - Data Type: ${fieldData.dataType}`);
        console.log(`      - Collection Tab: ${fieldData.collectionTab}`);
        console.log(`      - Required (in fieldData): ${fieldData.required ?? 'not set'}`);
      }
      console.log('');
    });

    // Check DSX Mappings for a sample location
    const usaCountry = await prisma.country.findFirst({
      where: {
        OR: [
          { code2: 'US' },
          { name: 'United States' }
        ]
      }
    });

    if (usaCountry) {
      console.log('---');
      console.log('DSX Mappings for USA (', usaCountry.name, '):');
      const mappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: usaCountry.id
        },
        include: {
          requirement: true
        }
      });

      if (mappings.length > 0) {
        mappings.forEach(m => {
          console.log(`  - ${m.requirement.name}: isRequired = ${m.isRequired}`);
        });
      } else {
        console.log('  No DSX Mappings found for this service+location combination');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEducationVerificationRequirements();