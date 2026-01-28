// Test requirements API with County Criminal + Canada

async function testRequirementsAPI() {
  try {
    // First, find Canada's ID
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

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

    console.log('Found Canada:', canada);
    console.log('Found County Criminal service:', countyService);

    if (!canada || !countyService) {
      console.log('Cannot find Canada or County Criminal service');
      await prisma.$disconnect();
      return;
    }

    // Test the requirements API
    const requestBody = {
      items: [
        {
          serviceId: countyService.id,
          locationId: canada.id
        }
      ]
    };

    console.log('\nTesting requirements API with:', requestBody);

    const response = await fetch('http://localhost:3000/api/portal/orders/requirements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('\nAPI Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testRequirementsAPI();