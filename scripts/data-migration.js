// prisma/migrations/manual-fix/migration.js
// This script migrates data from the old schema structure to the new one

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');

  try {
    // Step 1: Backup existing requirements before any changes
    console.log('Backing up existing requirements...');
    const existingRequirements = await prisma.dSXRequirement.findMany();
    console.log(`Found ${existingRequirements.length} existing requirements`);

    // Save backup to JSON file if needed
    // fs.writeFileSync('requirements-backup.json', JSON.stringify(existingRequirements, null, 2));

    // Step 2: Find and handle duplicate requirements (by name)
    console.log('Finding duplicate requirements by name...');
    const requirementsByName = {};
    
    // Group requirements by name
    existingRequirements.forEach(req => {
      if (!requirementsByName[req.name]) {
        requirementsByName[req.name] = [];
      }
      requirementsByName[req.name].push(req);
    });
    
    // Find names with multiple requirements
    const duplicateNames = Object.keys(requirementsByName).filter(
      name => requirementsByName[name].length > 1
    );
    
    console.log(`Found ${duplicateNames.length} requirements with duplicates`);
    
    // Process each group of duplicates
    for (const name of duplicateNames) {
      const duplicates = requirementsByName[name];
      console.log(`Processing ${duplicates.length} duplicates for "${name}"...`);
      
      // Keep the first requirement as the "primary" one
      const primaryReq = duplicates[0];
      const duplicateReqs = duplicates.slice(1);
      
      // Get all mappings associated with the duplicate requirements
      for (const dupReq of duplicateReqs) {
        // Find all mappings for this duplicate
        const mappings = await prisma.dSXMapping.findMany({
          where: { requirementId: dupReq.id }
        });
        
        console.log(`Found ${mappings.length} mappings for duplicate "${name}" (${dupReq.id})`);
        
        // For each mapping, create an equivalent mapping to the primary requirement
        // if one doesn't already exist
        for (const mapping of mappings) {
          const existingMapping = await prisma.dSXMapping.findFirst({
            where: {
              serviceId: mapping.serviceId,
              locationId: mapping.locationId,
              requirementId: primaryReq.id
            }
          });
          
          if (!existingMapping) {
            console.log(`Creating new mapping for primary requirement...`);
            await prisma.dSXMapping.create({
              data: {
                serviceId: mapping.serviceId,
                locationId: mapping.locationId,
                requirementId: primaryReq.id,
                isRequired: mapping.isRequired
              }
            });
          }
          
          // Delete the duplicate mapping
          await prisma.dSXMapping.delete({
            where: { id: mapping.id }
          });
        }
        
        // Delete the duplicate requirement
        console.log(`Deleting duplicate requirement ${dupReq.id}...`);
        await prisma.dSXRequirement.delete({
          where: { id: dupReq.id }
        });
      }
    }
    
    // Step 3: Create service-requirement relationships
    console.log('Creating service-requirement relationships...');
    
    // Get all unique requirements with their services
    const uniqueRequirements = await prisma.dSXRequirement.findMany();
    console.log(`Found ${uniqueRequirements.length} unique requirements`);
    
    // For each requirement, create a ServiceRequirement entry
    for (const req of uniqueRequirements) {
      const serviceId = req.serviceId;
      
      // Skip if there's no serviceId (shouldn't happen in old schema, but just in case)
      if (!serviceId) {
        console.log(`WARNING: Requirement ${req.id} (${req.name}) has no serviceId, skipping`);
        continue;
      }
      
      // Check if the service exists
      const service = await prisma.service.findUnique({
        where: { id: serviceId }
      });
      
      if (!service) {
        console.log(`WARNING: Service ${serviceId} not found for requirement ${req.id}, skipping`);
        continue;
      }
      
      // Create the ServiceRequirement entry
      console.log(`Creating ServiceRequirement for ${req.name} (${req.id}) with service ${serviceId}`);
      await prisma.serviceRequirement.create({
        data: {
          serviceId: serviceId,
          requirementId: req.id
        }
      });
    }
    
    // Step 4: Remove serviceId from DSXRequirement
    // Note: This step is handled by the Prisma migration, as the field is removed from the schema
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Execute the migration
main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });