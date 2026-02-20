#!/usr/bin/env node
// Script to fix DSX mappings that were incorrectly set to required

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDSXRequiredFlags() {
  console.log('🔧 Fixing DSX mapping required flags...');

  try {
    // Update all DSX mappings to set isRequired to false by default
    // In the future, we'll add a UI to selectively mark fields as required
    const result = await prisma.dSXMapping.updateMany({
      where: {
        isRequired: true
      },
      data: {
        isRequired: false
      }
    });

    console.log(`✅ Updated ${result.count} DSX mappings to isRequired: false`);

    // List the requirements that were updated
    const mappings = await prisma.dSXMapping.findMany({
      include: {
        requirement: true,
        service: true,
        country: true
      },
      take: 10
    });

    console.log('\n📋 Sample of updated mappings:');
    mappings.forEach(m => {
      console.log(`  - ${m.service.name} / ${m.country.name}: ${m.requirement.name} (required: ${m.isRequired})`);
    });

  } catch (error) {
    console.error('❌ Error updating DSX mappings:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixDSXRequiredFlags().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});