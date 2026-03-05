// seed-dsx-mappings.js - Seed DSX Mappings and Availability
const { PrismaClient } = require('@prisma/client');
const { dsxMappings } = require('./dsx-mappings-data');
const { dsxAvailability } = require('./dsx-availability-data');

// Allow passing DATABASE_URL as environment variable
const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl
  ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  : new PrismaClient();

async function main() {
  try {
    console.log('Seeding DSX Mappings and Availability...');

    // First, verify we have locations
    const locationCount = await prisma.country.count();
    console.log(`Found ${locationCount} locations in database`);

    if (locationCount === 0) {
      console.error('No locations found! Please seed locations first.');
      return;
    }

    // Seed DSX Availability
    console.log(`\nSeeding ${dsxAvailability.length} DSX Availability records...`);
    let availabilityCreated = 0;
    let availabilitySkipped = 0;

    for (const availability of dsxAvailability) {
      try {
        // Check if location exists
        const location = await prisma.country.findUnique({
          where: { id: availability.locationId }
        });

        if (!location) {
          availabilitySkipped++;
          continue;
        }

        // Check if service exists
        const service = await prisma.service.findUnique({
          where: { id: availability.serviceId }
        });

        if (!service) {
          availabilitySkipped++;
          continue;
        }

        await prisma.dSXAvailability.upsert({
          where: {
            serviceId_locationId: {
              serviceId: availability.serviceId,
              locationId: availability.locationId
            }
          },
          update: {
            isAvailable: availability.isAvailable
          },
          create: {
            serviceId: availability.serviceId,
            locationId: availability.locationId,
            isAvailable: availability.isAvailable
          }
        });
        availabilityCreated++;
      } catch (err) {
        console.error(`Failed to create availability: ${err.message}`);
        availabilitySkipped++;
      }
    }

    console.log(`Created/updated ${availabilityCreated} availability records, skipped ${availabilitySkipped}`);

    // Seed DSX Mappings
    console.log(`\nSeeding ${dsxMappings.length} DSX Mappings...`);
    let mappingsCreated = 0;
    let mappingsSkipped = 0;

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < dsxMappings.length; i += batchSize) {
      const batch = dsxMappings.slice(i, i + batchSize);

      for (const mapping of batch) {
        try {
          // Verify all foreign keys exist
          const [location, service, requirement] = await Promise.all([
            prisma.country.findUnique({ where: { id: mapping.locationId } }),
            prisma.service.findUnique({ where: { id: mapping.serviceId } }),
            prisma.dSXRequirement.findUnique({ where: { id: mapping.requirementId } })
          ]);

          if (!location || !service || !requirement) {
            mappingsSkipped++;
            continue;
          }

          await prisma.dSXMapping.upsert({
            where: {
              serviceId_locationId_requirementId: {
                serviceId: mapping.serviceId,
                locationId: mapping.locationId,
                requirementId: mapping.requirementId
              }
            },
            update: {
              isRequired: mapping.isRequired
            },
            create: {
              serviceId: mapping.serviceId,
              locationId: mapping.locationId,
              requirementId: mapping.requirementId,
              isRequired: mapping.isRequired
            }
          });
          mappingsCreated++;
        } catch (err) {
          console.error(`Failed to create mapping: ${err.message}`);
          mappingsSkipped++;
        }
      }

      // Progress update
      if ((i + batchSize) % 500 === 0) {
        console.log(`  Processed ${Math.min(i + batchSize, dsxMappings.length)}/${dsxMappings.length} mappings...`);
      }
    }

    console.log(`Created/updated ${mappingsCreated} mapping records, skipped ${mappingsSkipped}`);

    // Summary
    const finalMappingCount = await prisma.dSXMapping.count();
    const finalAvailabilityCount = await prisma.dSXAvailability.count();

    console.log('\n=== Final Summary ===');
    console.log(`Total DSX Mappings in database: ${finalMappingCount}`);
    console.log(`Total DSX Availability in database: ${finalAvailabilityCount}`);

    console.log('\nDSX Mappings seeding completed successfully!');
  } catch (error) {
    console.error('Error during DSX Mappings seeding:', error);
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