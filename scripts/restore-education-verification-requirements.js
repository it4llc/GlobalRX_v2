const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restoreEducationVerificationRequirements() {
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

    // According to the user, ALL fields should be required in DSX:
    // - First Name (required)
    // - Surname/Last Name (required)
    // - Residence Address (required)
    // - School Name (required)
    // - Degree type (required)
    // - School Address (required)

    const requiredFieldNames = [
      'First Name',
      'Surname/Last Name',
      'Residence Address',
      'School Name',
      'Degree type',
      'School Address'
    ];

    console.log('Setting the following fields as required for all locations:');
    requiredFieldNames.forEach(name => console.log(`  - ${name}`));
    console.log('---');

    // Get all requirements for Education Verification
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: { serviceId: service.id },
      include: { requirement: true }
    });

    // Get all DSX mappings for this service
    const mappings = await prisma.dSXMapping.findMany({
      where: { serviceId: service.id },
      include: { requirement: true }
    });

    console.log(`Found ${mappings.length} existing mappings to update`);

    // Update all mappings based on whether the field should be required
    let updatedCount = 0;
    for (const mapping of mappings) {
      const shouldBeRequired = requiredFieldNames.includes(mapping.requirement.name);

      if (mapping.isRequired !== shouldBeRequired) {
        await prisma.dSXMapping.update({
          where: { id: mapping.id },
          data: { isRequired: shouldBeRequired }
        });
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} mappings`);
    console.log('---');

    // Verify the results for USA
    const usa = await prisma.country.findFirst({
      where: {
        OR: [
          { code2: 'US' },
          { name: { contains: 'United States' } }
        ]
      }
    });

    if (usa) {
      console.log('Verification - USA mappings after update:');
      const usaMappings = await prisma.dSXMapping.findMany({
        where: {
          serviceId: service.id,
          locationId: usa.id
        },
        include: { requirement: true },
        orderBy: { requirement: { name: 'asc' } }
      });

      usaMappings.forEach(m => {
        console.log(`  ${m.requirement.name}: isRequired = ${m.isRequired}`);
      });
    }

    console.log('---');
    console.log('✅ Education Verification requirements have been restored!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreEducationVerificationRequirements();