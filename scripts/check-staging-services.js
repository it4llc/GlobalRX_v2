const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:nejxpddaeAeCvSjLrZnUpJInzZkSjTIX@turntable.proxy.rlwy.net:37481/railway"
    }
  }
});

async function checkServices() {
  try {
    const services = await prisma.service.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        functionalityType: true,
        disabled: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${services.length} services in staging:`);
    console.log('----------------------------------------');
    services.forEach(service => {
      console.log(`- ${service.name} (${service.category}) - Type: ${service.functionalityType} - Active: ${!service.disabled}`);
    });
  } catch (error) {
    console.error('Error checking services:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServices();