// Quick script to check if we have any requirements data
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database for requirements data...\n');

  // Check DSXRequirements
  const requirements = await prisma.dSXRequirement.findMany({
    take: 5,
    include: {
      serviceRequirements: true,
      mappings: true
    }
  });
  console.log(`Found ${requirements.length} DSX Requirements:`);
  requirements.forEach(req => {
    console.log(`  - ${req.name} (${req.type}): ${req.serviceRequirements.length} service links, ${req.mappings.length} location mappings`);
  });

  // Check ServiceRequirements
  const serviceRequirements = await prisma.serviceRequirement.findMany({
    take: 5,
    include: {
      requirement: true,
      service: true
    }
  });
  console.log(`\nFound ${serviceRequirements.length} Service Requirements:`);
  serviceRequirements.forEach(sr => {
    console.log(`  - Service: ${sr.service.name} -> Requirement: ${sr.requirement.name}`);
  });

  // Check Services
  const services = await prisma.service.findMany({
    take: 5,
    include: {
      serviceRequirements: true
    }
  });
  console.log(`\nFound ${services.length} Services:`);
  services.forEach(service => {
    console.log(`  - ${service.name}: ${service.serviceRequirements.length} requirements`);
  });

  // Check Countries
  const countries = await prisma.country.findMany({
    take: 5
  });
  console.log(`\nFound ${countries.length} Countries:`);
  countries.forEach(country => {
    console.log(`  - ${country.name} (${country.code2})`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);