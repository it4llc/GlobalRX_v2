// prisma/simple-seed.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Pre-hashed password for 'Admin123!' - this is a simple approach for the seed script only
// In a real application, always use bcrypt.hash() dynamically
const HASHED_PASSWORD = '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';

async function main() {
  try {
    // Check if admin user already exists
    const adminExists = await prisma.user.findUnique({
      where: {
        email: 'andythellman@gmail.com',
      },
    });

    if (!adminExists) {
      // Create admin user with pre-hashed password
      await prisma.user.create({
        data: {
          email: 'andythellman@gmail.com',
          password: HASHED_PASSWORD, 
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
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
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