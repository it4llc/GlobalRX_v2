const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEducationVerificationRequirements() {
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

    console.log('Found service:', service.name);
    console.log('Service ID:', service.id);
    console.log('---');

    // Define which fields should be required for Education Verification
    const requiredFields = [
      'First Name',
      'Surname/Last Name',
      'School Name'
    ];

    // Get all countries/locations
    const countries = await prisma.country.findMany({
      where: {
        parentId: null // Only top-level countries
      }
    });

    console.log('Updating DSX Mappings for', countries.length, 'countries...');

    for (const country of countries) {
      // Get existing mappings for this service+location
      const existingMappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: country.id
        },
        include: {
          requirement: true
        }
      });

      // Update existing mappings
      for (const mapping of existingMappings) {
        const shouldBeRequired = requiredFields.includes(mapping.requirement.name);

        if (mapping.isRequired !== shouldBeRequired) {
          await prisma.dSXMapping.update({
            where: { id: mapping.id },
            data: { isRequired: shouldBeRequired }
          });
          console.log(`  Updated ${mapping.requirement.name} for ${country.name}: isRequired = ${shouldBeRequired}`);
        }
      }

      // Check if we need to create any missing mappings
      const serviceRequirements = await prisma.serviceRequirement.findMany({
        where: { serviceId: service.id },
        include: { requirement: true }
      });

      for (const sr of serviceRequirements) {
        const existingMapping = existingMappings.find(m => m.requirementId === sr.requirementId);

        if (!existingMapping) {
          const shouldBeRequired = requiredFields.includes(sr.requirement.name);

          await prisma.dSXMapping.create({
            data: {
              serviceId: service.id,
              locationId: country.id,
              requirementId: sr.requirementId,
              isRequired: shouldBeRequired
            }
          });
          console.log(`  Created mapping for ${sr.requirement.name} in ${country.name}: isRequired = ${shouldBeRequired}`);
        }
      }
    }

    console.log('---');
    console.log('Verification - checking USA mappings:');

    const usaCountry = await prisma.country.findFirst({
      where: {
        OR: [
          { code2: 'US' },
          { name: { contains: 'United States' } }
        ]
      }
    });

    if (usaCountry) {
      const mappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: usaCountry.id
        },
        include: {
          requirement: true
        }
      });

      mappings.forEach(m => {
        console.log(`  ${m.requirement.name}: isRequired = ${m.isRequired}`);
      });
    }

    console.log('---');
    console.log('Done! DSX Mappings have been updated.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEducationVerificationRequirements();