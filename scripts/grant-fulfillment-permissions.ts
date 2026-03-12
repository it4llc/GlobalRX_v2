// Script to grant fulfillment.edit permission to a user
// Run with: pnpm tsx scripts/grant-fulfillment-permissions.ts your-email@example.com

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function grantFulfillmentPermissions(email: string) {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, permissions: true }
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    console.log('Current permissions:', user.permissions);

    // Update permissions to include fulfillment.edit and fulfillment.view
    const updatedPermissions = {
      ...(typeof user.permissions === 'object' ? user.permissions : {}),
      fulfillment: {
        view: true,
        edit: true,
        create: true,
        delete: true
      }
    };

    // Update the user
    const updated = await prisma.user.update({
      where: { email },
      data: { permissions: updatedPermissions }
    });

    console.log('✅ Permissions updated successfully!');
    console.log('New permissions:', updated.permissions);

  } catch (error) {
    console.error('Error updating permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Please provide an email address');
  console.error('Usage: pnpm tsx scripts/grant-fulfillment-permissions.ts your-email@example.com');
  process.exit(1);
}

grantFulfillmentPermissions(email);