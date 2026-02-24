const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAdminPermission() {
  try {
    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: 'andythellman@gmail.com' }
    });

    if (!user) {
      console.error('User not found');
      return;
    }

    console.log('Current permissions:', JSON.stringify(user.permissions, null, 2));

    // Add admin permission while preserving existing permissions
    const updatedPermissions = {
      ...user.permissions,
      admin: true
    };

    // Update user
    const updatedUser = await prisma.user.update({
      where: { email: 'andythellman@gmail.com' },
      data: {
        permissions: updatedPermissions
      }
    });

    console.log('Updated permissions:', JSON.stringify(updatedUser.permissions, null, 2));
    console.log('✅ Admin permission added successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminPermission();