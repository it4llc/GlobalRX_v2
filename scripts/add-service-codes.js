const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateServiceCodes() {
  try {
    // Map common service names to codes
    const serviceCodes = {
      'Motor Vehicle Record': 'MVR',
      'Criminal Background': 'CRIMINAL',
      'Drug Testing': 'DRUG',
      'Drug Screening': 'DRUG',
      'Employment Verification': 'EMPLOYMENT',
      'Education Verification': 'EDUCATION',
      'Reference Check': 'REFERENCE',
      'Credit Check': 'CREDIT',
      'Social Security Trace': 'SSN',
      'Identity Verification': 'IDENTITY'
    };

    // Get all services
    const services = await prisma.service.findMany();
    console.log(`Found ${services.length} services`);

    // Update services with matching codes
    for (const service of services) {
      // Check if service name matches any key
      for (const [namePattern, code] of Object.entries(serviceCodes)) {
        if (service.name && service.name.includes(namePattern)) {
          await prisma.service.update({
            where: { id: service.id },
            data: { code }
          });
          console.log(`Updated ${service.name} with code: ${code}`);
          break;
        }
      }

      // If no match found, create a simple code from the name
      if (!service.code) {
        const simpleCode = service.name
          ? service.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
          : `SERVICE${services.indexOf(service)}`;

        await prisma.service.update({
          where: { id: service.id },
          data: { code: simpleCode }
        });
        console.log(`Updated ${service.name} with code: ${simpleCode}`);
      }
    }

    console.log('Service codes updated successfully');
  } catch (error) {
    console.error('Error updating service codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateServiceCodes();