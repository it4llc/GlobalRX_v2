// Fix missing collectionTab fields in existing requirements
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking requirements for missing collectionTab fields...\n');

  // Get all field requirements
  const requirements = await prisma.dSXRequirement.findMany({
    where: {
      type: 'field'
    }
  });

  console.log(`Found ${requirements.length} field requirements`);

  let updated = 0;

  for (const requirement of requirements) {
    const fieldData = requirement.fieldData;

    if (!fieldData.collectionTab) {
      console.log(`Updating ${requirement.name}: adding collectionTab = 'subject'`);

      // Add collectionTab to fieldData
      const updatedFieldData = {
        ...fieldData,
        collectionTab: 'subject'
      };

      await prisma.dSXRequirement.update({
        where: { id: requirement.id },
        data: {
          fieldData: updatedFieldData
        }
      });

      updated++;
    } else {
      console.log(`${requirement.name}: already has collectionTab = '${fieldData.collectionTab}'`);
    }
  }

  console.log(`\nUpdated ${updated} requirements with missing collectionTab fields`);
  await prisma.$disconnect();
}

main().catch(console.error);