const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:YclSibhdowXmvLlWxXrtqaWeuOtSfwZV@shortline.proxy.rlwy.net:24128/railway"
    }
  }
});

async function verifyProductionData() {
  try {
    const [services, dsxRequirements, serviceRequirements, dsxMappings, dsxAvailability] = await Promise.all([
      prisma.service.count(),
      prisma.dSXRequirement.count(),
      prisma.serviceRequirement.count(),
      prisma.dSXMapping.count(),
      prisma.dSXAvailability.count()
    ]);

    console.log('=== Production Database Summary ===');
    console.log(`Services: ${services}`);
    console.log(`DSX Requirements: ${dsxRequirements}`);
    console.log(`Service-Requirement Associations: ${serviceRequirements}`);
    console.log(`DSX Mappings: ${dsxMappings}`);
    console.log(`DSX Availability: ${dsxAvailability}`);

    // Get service names for verification
    const serviceList = await prisma.service.findMany({
      select: { name: true },
      orderBy: { name: 'asc' }
    });

    console.log('\n=== Services in Production ===');
    serviceList.forEach(s => console.log(`  - ${s.name}`));

  } catch (error) {
    console.error('Error verifying production data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProductionData();