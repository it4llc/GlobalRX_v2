// scripts/migrate-dsx-to-database.ts
//
// This script migrates DSX data from localStorage to the database.
// To use this script:
// 1. Create a JSON file called "localstorage-dump.json" in the same directory as this script
// 2. The JSON file should contain the localStorage data exported from your browser
// 3. Run with: pnpm prisma db push && pnpm exec ts-node -P tsconfig.json scripts/migrate-dsx-to-database.ts
//

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Initialize Prisma client
const prisma = new PrismaClient();

interface LocalStorageData {
  requirements: Record<string, any[]>;
  mappings: Record<string, Record<string, boolean>>;
  availability: Record<string, Record<string, boolean>>;
}

// Function to load the JSON data
function loadJsonData(filename: string): LocalStorageData {
  try {
    // Read the file from the current working directory
    const filePath = `${process.cwd()}/scripts/${filename}`;
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error loading JSON data:', error);
    throw new Error('Failed to load JSON data. Make sure the file exists and is valid JSON.');
  }
}

async function migrateData() {
  try {
    console.log('Starting DSX data migration...');
    
    // Load the localStorage data
    console.log('Loading localStorage data from localstorage-dump.json...');
    let data: LocalStorageData;
    
    try {
      data = loadJsonData('localstorage-dump.json');
    } catch (error) {
      console.error('Error:', error.message);
      console.log('\nYou need to:');
      console.log('1. Export your localStorage data from the browser DevTools');
      console.log('2. Save it to scripts/localstorage-dump.json');
      console.log('3. Run this script again');
      return;
    }
    
    // Process each service's data
    for (const [serviceId, serviceRequirements] of Object.entries(data.requirements || {})) {
      console.log(`\nProcessing service ${serviceId}...`);
      
      // 1. Migrate requirements
      console.log(`- Migrating ${serviceRequirements.length} requirements...`);
      
      for (const requirement of serviceRequirements) {
        try {
          // Check if requirement already exists
          const existingRequirement = await prisma.dSXRequirement.findUnique({
            where: { id: requirement.id }
          });
          
          if (existingRequirement) {
            console.log(`  - Requirement ${requirement.id} already exists, skipping...`);
            continue;
          }
          
          // Create the requirement in the database
          await prisma.dSXRequirement.create({
            data: {
              serviceId,
              id: requirement.id,
              name: requirement.name,
              type: requirement.type,
              fieldData: requirement.type === 'field' ? requirement.field : undefined,
              documentData: requirement.type === 'document' ? requirement.document : undefined,
              formData: requirement.type === 'form' ? requirement.form : undefined,
            }
          });
          console.log(`  - Created requirement: ${requirement.name}`);
        } catch (error) {
          console.error(`  - Error creating requirement ${requirement.id}:`, error);
        }
      }
      
      // 2. Migrate mappings
      const serviceMappings = data.mappings?.[serviceId] || {};
      console.log(`- Migrating ${Object.keys(serviceMappings).length} mappings...`);
      
      for (const [key, isRequired] of Object.entries(serviceMappings)) {
        try {
          const [locationId, requirementId] = key.split('-');
          
          if (!locationId || !requirementId) {
            console.warn(`  - Warning: Invalid mapping key ${key}, skipping...`);
            continue;
          }
          
          // Check if mapping already exists
          const existingMapping = await prisma.dSXMapping.findFirst({
            where: {
              serviceId,
              locationId,
              requirementId
            }
          });
          
          if (existingMapping) {
            console.log(`  - Mapping already exists, updating...`);
            await prisma.dSXMapping.update({
              where: { id: existingMapping.id },
              data: { isRequired }
            });
          } else {
            await prisma.dSXMapping.create({
              data: {
                serviceId,
                locationId,
                requirementId,
                isRequired,
              }
            });
          }
        } catch (error) {
          console.error(`  - Error processing mapping ${key}:`, error);
        }
      }
      
      // 3. Migrate availability
      const serviceAvailability = data.availability?.[serviceId] || {};
      console.log(`- Migrating ${Object.keys(serviceAvailability).length} availability settings...`);
      
      for (const [locationId, isAvailable] of Object.entries(serviceAvailability)) {
        try {
          // Check if availability already exists
          const existingAvailability = await prisma.dSXAvailability.findFirst({
            where: {
              serviceId,
              locationId
            }
          });
          
          if (existingAvailability) {
            console.log(`  - Availability for location ${locationId} already exists, updating...`);
            await prisma.dSXAvailability.update({
              where: { id: existingAvailability.id },
              data: { isAvailable }
            });
          } else {
            await prisma.dSXAvailability.create({
              data: {
                serviceId,
                locationId,
                isAvailable,
              }
            });
          }
        } catch (error) {
          console.error(`  - Error processing availability for ${locationId}:`, error);
        }
      }
      
      console.log(`✅ Completed service ${serviceId}`);
    }
    
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateData().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});