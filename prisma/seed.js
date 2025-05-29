// seed.js - Root level seed script
const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create or update admin user with bcryptjs
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash('Admin123!', salt);
    
    await prisma.user.upsert({
      where: {
        email: 'andythellman@gmail.com',
      },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'andythellman@gmail.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        permissions: {
          countries: ['*'],
          services: ['*'],
          dsx: ['*'],
          customers: ['*'],
        },
      },
    });
    console.log('Admin user created/updated successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });