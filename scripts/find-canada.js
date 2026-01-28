// Find Canada and County Criminal IDs for testing
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const canada = await prisma.country.findFirst({
    where: {
      OR: [
        { name: { contains: 'Canada', mode: 'insensitive' } },
        { code2: 'CA' }
      ]
    }
  });

  const countyService = await prisma.service.findFirst({
    where: {
      name: { contains: 'County Criminal', mode: 'insensitive' }
    }
  });

  console.log('Canada:', canada);
  console.log('County Criminal:', countyService);

  if (canada && countyService) {
    console.log('\nCURL test command:');
    console.log(`curl -X POST http://localhost:3000/api/portal/orders/requirements \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"serviceId":"${countyService.id}","locationId":"${canada.id}"}]}'`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);