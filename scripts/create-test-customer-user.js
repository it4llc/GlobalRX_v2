// scripts/create-test-customer-user.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestCustomerUser() {
  try {
    // First, check if we have any customers
    const customers = await prisma.customer.findMany({
      take: 1,
      where: {
        disabled: false
      }
    });

    let customer;
    if (customers.length === 0) {
      // Create a test customer if none exist
      console.log('Creating test customer organization...');
      customer = await prisma.customer.create({
        data: {
          name: 'Test Customer Organization',
          contactName: 'Test Contact',
          contactEmail: 'contact@testcustomer.com',
          contactPhone: '555-0100',
          address: '123 Test Street, Test City, TC 12345'
        }
      });
      console.log('✓ Created test customer:', customer.name);
    } else {
      customer = customers[0];
      console.log('Using existing customer:', customer.name);
    }

    // Check if test customer user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email: 'customer@test.com'
      }
    });

    if (existingUser) {
      console.log('Test customer user already exists with email: customer@test.com');
      console.log('Updating to ensure it\'s a customer user...');

      const updatedUser = await prisma.user.update({
        where: { email: 'customer@test.com' },
        data: {
          userType: 'customer',
          customerId: customer.id,
          firstName: 'Test',
          lastName: 'Customer',
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      console.log('✓ Updated existing user as customer user');
    } else {
      // Hash the password
      const hashedPassword = await bcrypt.hash('customer123', 10);

      // Create the customer user
      const user = await prisma.user.create({
        data: {
          email: 'customer@test.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'Customer',
          userType: 'customer',
          customerId: customer.id,
          permissions: {
            // Customer users typically don't need admin permissions
            countries: [],
            services: [],
            customers: [customer.id] // Can only see their own organization
          }
        }
      });

      console.log('✓ Created test customer user');
    }

    console.log('\n========================================');
    console.log('Test Customer User Credentials:');
    console.log('Email: customer@test.com');
    console.log('Password: customer123');
    console.log('Organization:', customer.name);
    console.log('========================================\n');

    // Also ensure you still have an admin user
    const adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@example.com'
      }
    });

    if (adminUser) {
      console.log('Admin user exists:');
      console.log('Email: admin@example.com');
      console.log('(Use your existing admin password)');
    }

  } catch (error) {
    console.error('Error creating test customer user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCustomerUser();