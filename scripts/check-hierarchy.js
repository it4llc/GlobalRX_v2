// scripts/check-hierarchy.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomerHierarchy() {
  try {
    console.log('🔍 Checking customer hierarchy...');

    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        masterAccountId: true,
        billingAccountId: true,
        users: {
          select: { email: true, firstName: true, lastName: true }
        },
        masterAccount: {
          select: { name: true }
        },
        subaccounts: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${customers.length} customers`);

    const masterAccounts = customers.filter(c => !c.masterAccountId);
    const subaccounts = customers.filter(c => c.masterAccountId);

    console.log(`\n📊 Hierarchy Summary:`);
    console.log(`  Master accounts: ${masterAccounts.length}`);
    console.log(`  Subaccounts: ${subaccounts.length}`);

    console.log('\n🏢 MASTER ACCOUNTS:');
    masterAccounts.forEach((customer, index) => {
      const hasUsers = customer.users.length > 0;
      const userInfo = hasUsers ? ` (👤 ${customer.users.length} users)` : ' (no users)';
      console.log(`${index + 1}. ${customer.name}${userInfo}`);

      if (customer.subaccounts.length > 0) {
        console.log(`   📁 Subaccounts: ${customer.subaccounts.length}`);
        customer.subaccounts.forEach(sub => {
          console.log(`      - ${sub.name}`);
        });
      }
    });

    if (subaccounts.length > 0) {
      console.log('\n📁 SUBACCOUNTS:');
      subaccounts.forEach((customer, index) => {
        console.log(`${index + 1}. ${customer.name} → Master: ${customer.masterAccount?.name || 'MISSING!'}`);
      });
    }

    // Check for orphaned subaccounts
    const orphanedSubaccounts = subaccounts.filter(sub => {
      return !masterAccounts.find(master => master.id === sub.masterAccountId);
    });

    if (orphanedSubaccounts.length > 0) {
      console.log(`\n⚠️  ORPHANED SUBACCOUNTS (${orphanedSubaccounts.length}):`);
      orphanedSubaccounts.forEach(sub => {
        console.log(`- ${sub.name} (references missing master: ${sub.masterAccountId})`);
      });

      console.log('\n🔧 Converting orphaned subaccounts to master accounts...');
      for (const orphan of orphanedSubaccounts) {
        await prisma.customer.update({
          where: { id: orphan.id },
          data: {
            masterAccountId: null,
            billingAccountId: null
          }
        });
        console.log(`  ✅ Converted: ${orphan.name}`);
      }
    }

    // Show test customer status
    const testCustomer = customers.find(c =>
      c.users.some(u => u.email === 'customer@test.com')
    );

    if (testCustomer) {
      console.log('\n👤 TEST CUSTOMER:');
      console.log(`  Name: ${testCustomer.name}`);
      console.log(`  Type: ${testCustomer.masterAccountId ? 'Subaccount' : 'Master Account'}`);
      console.log(`  Users: ${testCustomer.users.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomerHierarchy();