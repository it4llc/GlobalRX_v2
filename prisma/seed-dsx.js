// seed-dsx.js - Seed DSX requirements and associations
const { PrismaClient } = require('@prisma/client');

// Allow passing DATABASE_URL as environment variable
const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl
  ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  : new PrismaClient();

async function main() {
  try {
    console.log('Seeding DSX requirements and associations...');

    // Define DSX Requirements (fields and documents)
    const dsxRequirements = [
      // Company related fields
      { id: '7456d517-e212-454d-8d4a-e19ddd077ba7', name: 'Company Name', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Company Name' } },
      { id: '61588fb6-5a89-4b27-bf6f-1a6d07b48a1f', name: 'Company Name', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Company Name' } },
      { id: '007a7957-92c0-4ec4-9a93-f5cd56260f10', name: 'Company Address', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Company Address' } },

      // Name fields
      { id: '739b2b3f-db5c-4010-b96c-5238a3a26298', name: 'First Name', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'First Name' } },
      { id: '8cc249d5-d320-442f-b2fe-88380569770c', name: 'Surname/Last Name', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Surname/Last Name' } },

      // Address fields
      { id: 'ed12120d-674a-47cc-b06e-81a135eb7ea5', name: 'Residence Address', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Residence Address' } },
      { id: '1f27c8a7-e554-41bc-8750-230e2c3f5018', name: 'Residence Street Address', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Residence Street Address' } },
      { id: 'ba8bb198-a455-4713-b8bf-026f155acda0', name: 'Residence City', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Residence City' } },

      // School related fields
      { id: '5ea29387-6d88-43e4-aaa8-481937d22b9c', name: 'School Name', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'School Name' } },
      { id: '0f73bcea-e704-44da-bbf2-0a4a5e0b679b', name: 'School Address', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'School Address' } },
      { id: '5132a5a2-6bbc-4fe6-b242-8eee1e761c86', name: 'School Street Address', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'School Street Address' } },
      { id: '81b5aa1d-3072-46df-91be-c31f8dd04ebb', name: 'Degree type', type: 'field', fieldData: { dataType: 'text', fieldLabel: 'Degree type' } },
      { id: '26b49fc1-828d-4117-bb9f-17ef79510261', name: 'Graduation Date', type: 'field', fieldData: { dataType: 'date', fieldLabel: 'Graduation Date' } },

      // Date fields
      { id: 'b6f8e826-249a-458d-af9d-fcdeb8542abd', name: 'Start Date', type: 'field', fieldData: { dataType: 'date', fieldLabel: 'Start Date' } },
      { id: 'cb63bfb9-b41b-4a99-8c42-49b057d66af0', name: 'End Date', type: 'field', fieldData: { dataType: 'date', fieldLabel: 'End Date' } },

      // Documents
      { id: 'b41cc87a-89af-4031-970a-1b1b860d2894', name: 'Primary ID', type: 'document', documentData: { documentName: 'Primary ID', description: 'Government-issued identification' } },
      { id: '86d871fe-eb21-42e0-9584-7a94cdc4792c', name: 'Copy of degree', type: 'document', documentData: { documentName: 'Copy of degree', description: 'Copy of educational degree or certificate' } }
    ];

    // Create DSX Requirements
    for (const req of dsxRequirements) {
      await prisma.dSXRequirement.upsert({
        where: { id: req.id },
        update: {
          name: req.name,
          type: req.type,
          fieldData: req.fieldData || null,
          documentData: req.documentData || null,
          disabled: false
        },
        create: {
          id: req.id,
          name: req.name,
          type: req.type,
          fieldData: req.fieldData || null,
          documentData: req.documentData || null,
          disabled: false
        }
      });
    }
    console.log(`Created/updated ${dsxRequirements.length} DSX requirements`);

    // Service-Requirement Associations
    const serviceRequirements = [
      // County Criminal
      { serviceId: '383f3f2f-3194-4396-9a63-297f80e151f9', requirementId: '7456d517-e212-454d-8d4a-e19ddd077ba7', displayOrder: 0 }, // Company Name
      { serviceId: '383f3f2f-3194-4396-9a63-297f80e151f9', requirementId: '739b2b3f-db5c-4010-b96c-5238a3a26298', displayOrder: 10 }, // First Name
      { serviceId: '383f3f2f-3194-4396-9a63-297f80e151f9', requirementId: '8cc249d5-d320-442f-b2fe-88380569770c', displayOrder: 20 }, // Surname/Last Name

      // Employment Verification
      { serviceId: '4b9d6a10-6861-426a-ad7f-60eb94312d0d', requirementId: '8cc249d5-d320-442f-b2fe-88380569770c', displayOrder: 0 }, // Surname/Last Name
      { serviceId: '4b9d6a10-6861-426a-ad7f-60eb94312d0d', requirementId: '739b2b3f-db5c-4010-b96c-5238a3a26298', displayOrder: 10 }, // First Name
      { serviceId: '4b9d6a10-6861-426a-ad7f-60eb94312d0d', requirementId: '61588fb6-5a89-4b27-bf6f-1a6d07b48a1f', displayOrder: 20 }, // Company Name
      { serviceId: '4b9d6a10-6861-426a-ad7f-60eb94312d0d', requirementId: '007a7957-92c0-4ec4-9a93-f5cd56260f10', displayOrder: 30 }, // Company Address

      // Global Criminal
      { serviceId: 'be37003d-1016-463a-b536-c00cf9f3234b', requirementId: 'ed12120d-674a-47cc-b06e-81a135eb7ea5', displayOrder: 0 }, // Residence Address
      { serviceId: 'be37003d-1016-463a-b536-c00cf9f3234b', requirementId: '8cc249d5-d320-442f-b2fe-88380569770c', displayOrder: 10 }, // Surname/Last Name
      { serviceId: 'be37003d-1016-463a-b536-c00cf9f3234b', requirementId: '739b2b3f-db5c-4010-b96c-5238a3a26298', displayOrder: 20 }, // First Name
      { serviceId: 'be37003d-1016-463a-b536-c00cf9f3234b', requirementId: 'b41cc87a-89af-4031-970a-1b1b860d2894', displayOrder: 30 }, // Primary ID

      // Education Verification
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '739b2b3f-db5c-4010-b96c-5238a3a26298', displayOrder: 1000 }, // First Name
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '8cc249d5-d320-442f-b2fe-88380569770c', displayOrder: 1010 }, // Surname/Last Name
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: 'ed12120d-674a-47cc-b06e-81a135eb7ea5', displayOrder: 1020 }, // Residence Address
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '5ea29387-6d88-43e4-aaa8-481937d22b9c', displayOrder: 2000 }, // School Name
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '0f73bcea-e704-44da-bbf2-0a4a5e0b679b', displayOrder: 2010 }, // School Address
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '81b5aa1d-3072-46df-91be-c31f8dd04ebb', displayOrder: 2020 }, // Degree type
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: 'b6f8e826-249a-458d-af9d-fcdeb8542abd', displayOrder: 2030 }, // Start Date
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: 'cb63bfb9-b41b-4a99-8c42-49b057d66af0', displayOrder: 2040 }, // End Date
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '26b49fc1-828d-4117-bb9f-17ef79510261', displayOrder: 2050 }, // Graduation Date
      { serviceId: '935f2544-5727-47a9-a758-bd24afea5994', requirementId: '86d871fe-eb21-42e0-9584-7a94cdc4792c', displayOrder: 3000 }, // Copy of degree
    ];

    // Create Service-Requirement associations
    for (const sr of serviceRequirements) {
      try {
        await prisma.serviceRequirement.upsert({
          where: {
            serviceId_requirementId: {
              serviceId: sr.serviceId,
              requirementId: sr.requirementId
            }
          },
          update: {
            displayOrder: sr.displayOrder
          },
          create: {
            serviceId: sr.serviceId,
            requirementId: sr.requirementId,
            displayOrder: sr.displayOrder
          }
        });
      } catch (err) {
        console.error(`Failed to create service-requirement association: ${sr.serviceId} - ${sr.requirementId}`, err.message);
      }
    }
    console.log(`Created/updated ${serviceRequirements.length} service-requirement associations`);

    // Note: We're not seeding DSXAvailability and DSXMapping as those are location-specific
    // and should be configured through the UI based on your actual location data

    console.log('DSX seeding completed successfully!');
  } catch (error) {
    console.error('Error during DSX seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });