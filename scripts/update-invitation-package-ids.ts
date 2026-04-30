#!/usr/bin/env tsx
// Script to update existing candidate invitations with packageId
// Run with: pnpm tsx scripts/update-invitation-package-ids.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating existing candidate invitations with packageId...');

  // First check if any invitations exist without packageId
  const invitationsToUpdate = await prisma.$queryRaw<{id: string, customerId: string}[]>`
    SELECT id, "customer_id" as "customerId"
    FROM candidate_invitations
    WHERE package_id IS NULL
  `;

  console.log(`Found ${invitationsToUpdate.length} invitations without packageId`);

  for (const inv of invitationsToUpdate) {
    // Get packages for this customer
    const packages = await prisma.package.findMany({
      where: {
        customerId: inv.customerId
      },
      include: {
        workflow: true
      }
    });

    // Find a package with an active workflow
    const activePackage = packages.find(
      (pkg) => pkg.workflow && pkg.workflow.status === 'active'
    );

    if (activePackage) {
      await prisma.$executeRaw`
        UPDATE candidate_invitations
        SET package_id = ${activePackage.id}
        WHERE id = ${inv.id}
      `;
      console.log(`Updated invitation ${inv.id} with package ${activePackage.name}`);
    } else {
      // If no active package with workflow, just use the first package
      const firstPackage = packages[0];
      if (firstPackage) {
        await prisma.$executeRaw`
          UPDATE candidate_invitations
          SET package_id = ${firstPackage.id}
          WHERE id = ${inv.id}
        `;
        console.log(`Updated invitation ${inv.id} with first package ${firstPackage.name} (no active workflow found)`);
      } else {
        const customer = await prisma.customer.findUnique({
          where: { id: inv.customerId },
          select: { name: true }
        });
        console.warn(`No packages found for customer ${customer?.name}, invitation ${inv.id} remains without packageId`);
      }
    }
  }

  console.log('Done updating invitations');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());