// scripts/check-locations.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocations() {
  try {
    console.log('Checking countries in the database...');
    
    // Get all countries
    const countries = await prisma.country.findMany({
      where: {
        parentId: null // Top-level countries
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        code2: true,
        code3: true,
        disabled: true
      }
    });
    
    console.log(`Found ${countries.length} countries`);
    
    // Find Afghanistan specifically
    const afghanistan = countries.find(c => c.name === 'Afghanistan');
    
    if (afghanistan) {
      console.log('Afghanistan details:');
      console.log(afghanistan);
    } else {
      console.log('Afghanistan not found in the database!');
      
      // Check if there's anything similar
      const similar = countries.filter(c => c.name.includes('Afghan'));
      if (similar.length > 0) {
        console.log('Similar countries found:');
        console.log(similar);
      }
    }
    
    // List first 10 countries for reference
    console.log('\nFirst 10 countries for reference:');
    countries.slice(0, 10).forEach(c => {
      console.log(`${c.name} (${c.code2}): ${c.id} ${c.disabled ? '(disabled)' : ''}`);
    });
    
    // Check for any disabled countries
    const disabledCountries = countries.filter(c => c.disabled === true);
    if (disabledCountries.length > 0) {
      console.log(`\nFound ${disabledCountries.length} disabled countries:`);
      disabledCountries.forEach(c => {
        console.log(`${c.name} (${c.code2}): ${c.id}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking countries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocations()
  .catch(e => {
    console.error('Error running script:', e);
    process.exit(1);
  });