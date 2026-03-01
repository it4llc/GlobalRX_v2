// scripts/assign-orders-to-vendor.ts
// Script to assign all orders to a specific vendor

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Find the ESG Internal vendor
    const vendor = await prisma.vendorOrganization.findFirst({
      where: {
        name: 'ESG Internal'
      }
    });

    if (!vendor) {
      console.error('ESG Internal vendor not found!');
      console.log('Available vendors:');
      const vendors = await prisma.vendorOrganization.findMany({
        select: { id: true, name: true }
      });
      vendors.forEach(v => console.log(`- ${v.name} (${v.id})`));
      return;
    }

    console.log(`Found ESG Internal vendor: ${vendor.name} (${vendor.id})`);

    // Update all orders to be assigned to this vendor
    const result = await prisma.order.updateMany({
      where: {
        // Only update orders that don't already have this vendor
        OR: [
          { assignedVendorId: null },
          { assignedVendorId: { not: vendor.id } }
        ]
      },
      data: {
        assignedVendorId: vendor.id
      }
    });

    console.log(`✅ Successfully reassigned ${result.count} orders to ESG Internal vendor`);

    // Show some stats
    const totalOrders = await prisma.order.count();
    const assignedOrders = await prisma.order.count({
      where: { assignedVendorId: vendor.id }
    });

    console.log(`\nStats:`);
    console.log(`- Total orders: ${totalOrders}`);
    console.log(`- Orders assigned to ESG Internal: ${assignedOrders}`);

  } catch (error) {
    console.error('Error assigning orders to vendor:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();