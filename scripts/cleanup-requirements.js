// scripts/cleanup-requirements.js
// This script helps clean up and deduplicate requirements data after schema migration

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupRequirements() {
  console.log('Starting requirements cleanup and deduplication...');
  
  try {
    // Step 1: Find and deduplicate requirements with the same name and type
    console.log('Finding duplicates...');
    
    // Get all requirements
    const allRequirements = await prisma.dSXRequirement.findMany();
    
    // Group by name and type
    const requirementsByNameAndType = {};
    allRequirements.forEach(req => {
      const key = `${req.name}-${req.type}`;
      if (!requirementsByNameAndType[key]) {
        requirementsByNameAndType[key] = [];
      }
      requirementsByNameAndType[key].push(req);
    });
    
    // Find groups with duplicates
    const duplicateGroups = Object.entries(requirementsByNameAndType)
      .filter(([_, reqs]) => reqs.length > 1)
      .map(([key, reqs]) => ({ key, reqs }));
    
    console.log(`Found ${duplicateGroups.length} groups of duplicate requirements`);
    
    // Step 2: For each duplicate group, merge into one requirement
    for (const { key, reqs } of duplicateGroups) {
      console.log(`Processing duplicate group: ${key} (${reqs.length} items)`);
      
      // Keep the first requirement as the "primary" one
      const primaryReq = reqs[0];
      // All other requirements in this group are duplicates to be removed
      const duplicates = reqs.slice(1);
      
      console.log(`Primary requirement ID: ${primaryReq.id}`);
      console.log(`${duplicates.length} duplicates to handle`);
      
      // Step 3: For each duplicate, update any service requirements to point to primary
      for (const duplicate of duplicates) {
        // Find service requirements for this duplicate
        const serviceReqs = await prisma.serviceRequirement.findMany({
          where: { requirementId: duplicate.id }
        });
        
        console.log(`Found ${serviceReqs.length} service requirements for duplicate ${duplicate.id}`);
        
        // For each service requirement, create one pointing to primary if it doesn't exist
        for (const serviceReq of serviceReqs) {
          // Check if there's already a relationship between this service and the primary requirement
          const existingRelation = await prisma.serviceRequirement.findFirst({
            where: {
              serviceId: serviceReq.serviceId,
              requirementId: primaryReq.id
            }
          });
          
          if (!existingRelation) {
            // Create a new relationship to the primary requirement
            await prisma.serviceRequirement.create({
              data: {
                serviceId: serviceReq.serviceId,
                requirementId: primaryReq.id
              }
            });
            console.log(`Created new relation between service ${serviceReq.serviceId} and primary requirement ${primaryReq.id}`);
          } else {
            console.log(`Relation already exists between service ${serviceReq.serviceId} and primary requirement ${primaryReq.id}`);
          }
          
          // Delete the old relationship
          await prisma.serviceRequirement.delete({
            where: { id: serviceReq.id }
          });
          console.log(`Deleted old relation ${serviceReq.id}`);
        }
        
        // Update DSX mappings to point to primary
        const dSXMappings = await prisma.dSXMapping.findMany({
          where: { requirementId: duplicate.id }
        });
        
        console.log(`Found ${dSXMappings.length} DSX mappings for duplicate ${duplicate.id}`);
        
        for (const mapping of dSXMappings) {
          // Check if there's already a mapping with the same locationId and serviceId
          const existingMapping = await prisma.dSXMapping.findFirst({
            where: {
              serviceId: mapping.serviceId,
              locationId: mapping.locationId,
              requirementId: primaryReq.id
            }
          });
          
          if (!existingMapping) {
            // Create a new mapping to the primary requirement
            await prisma.dSXMapping.create({
              data: {
                serviceId: mapping.serviceId,
                locationId: mapping.locationId,
                requirementId: primaryReq.id,
                isRequired: mapping.isRequired
              }
            });
            console.log(`Created new mapping for service ${mapping.serviceId}, location ${mapping.locationId}, and primary requirement ${primaryReq.id}`);
          } else {
            console.log(`Mapping already exists for service ${mapping.serviceId}, location ${mapping.locationId}, and primary requirement ${primaryReq.id}`);
          }
          
          // Delete the old mapping
          await prisma.dSXMapping.delete({
            where: { id: mapping.id }
          });
          console.log(`Deleted old mapping ${mapping.id}`);
        }
        
        // Now we can safely delete the duplicate
        await prisma.dSXRequirement.delete({
          where: { id: duplicate.id }
        });
        console.log(`Deleted duplicate requirement ${duplicate.id}`);
      }
    }
    
    console.log('Cleanup complete!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupRequirements()
  .then(() => console.log('Cleanup process finished'))
  .catch(e => console.error('Cleanup process failed:', e));