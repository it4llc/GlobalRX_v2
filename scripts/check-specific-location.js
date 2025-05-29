// scripts/check-specific-location.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocation() {
  try {
    // Check for the specific location ID from the error
    const locationId = '9297daf6';
    console.log(`Checking for location ID: ${locationId}`);
    
    // Try to find with startsWith
    const partialMatches = await prisma.country.findMany({
      where: {
        id: {
          startsWith: locationId
        }
      },
      select: {
        id: true,
        name: true,
        code2: true,
        parentId: true
      }
    });
    
    if (partialMatches.length > 0) {
      console.log('Found partial matches:');
      partialMatches.forEach(match => {
        console.log(`- ${match.name} (${match.code2}): ${match.id}`);
      });
    } else {
      console.log('No partial matches found');
    }
    
    // Check if this might be a child location
    console.log('\nChecking for children locations:');
    const childLocations = await prisma.country.findMany({
      where: {
        parentId: {
          not: null
        }
      },
      take: 5,
      select: {
        id: true,
        name: true,
        code2: true,
        parentId: true
      }
    });
    
    console.log(`Sample of child locations (first 5):`);
    childLocations.forEach(loc => {
      console.log(`- ${loc.name}: ${loc.id}, parent: ${loc.parentId}`);
    });
    
    // Count total locations by level
    const countByParent = await prisma.$queryRaw`
      SELECT 
        CASE WHEN "parentId" IS NULL THEN 'root' ELSE 'child' END as level,
        COUNT(*) as count
      FROM "countries"
      GROUP BY level
    `;
    
    console.log('\nLocation counts by level:');
    console.log(countByParent);
    
  } catch (error) {
    console.error('Error checking location:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocation()
  .catch(e => {
    console.error('Error running script:', e);
    process.exit(1);
  });