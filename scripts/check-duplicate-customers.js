// scripts/check-duplicate-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicateCustomers() {
  console.log('Checking for duplicate customers...');

  try {
    // Get all customers
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        services: {
          include: {
            service: true
          }
        },
        packages: true,
        subaccounts: true,
        _count: {
          select: {
            packages: true,
            subaccounts: true
          }
        }
      }
    });

    console.log(`\nTotal customers found: ${customers.length}\n`);

    // Check for duplicates by name (case-insensitive)
    const nameGroups = {};
    customers.forEach(customer => {
      const normalizedName = customer.name.toLowerCase().trim();
      if (!nameGroups[normalizedName]) {
        nameGroups[normalizedName] = [];
      }
      nameGroups[normalizedName].push(customer);
    });

    // Find duplicate groups
    const duplicateGroups = Object.entries(nameGroups).filter(([name, customers]) => customers.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate customers found by name.');
    } else {
      console.log(`⚠️  Found ${duplicateGroups.length} groups of duplicate customer names:\n`);

      duplicateGroups.forEach(([name, duplicateCustomers], index) => {
        console.log(`--- Duplicate Group ${index + 1}: "${name}" ---`);
        duplicateCustomers.forEach((customer, customerIndex) => {
          console.log(`  ${customerIndex + 1}. ID: ${customer.id}`);
          console.log(`     Name: ${customer.name}`);
          console.log(`     Contact: ${customer.contactName || 'N/A'} (${customer.contactEmail || 'N/A'})`);
          console.log(`     Address: ${customer.address || 'N/A'}`);
          console.log(`     Master Account: ${customer.masterAccountId || 'None'}`);
          console.log(`     Billing Account: ${customer.billingAccountId || 'None'}`);
          console.log(`     Packages: ${customer._count.packages}`);
          console.log(`     Subaccounts: ${customer._count.subaccounts}`);
          console.log(`     Services: ${customer.services.length}`);
          console.log(`     Created: ${customer.createdAt}`);
          console.log(`     Disabled: ${customer.disabled}`);
          console.log('');
        });
        console.log('');
      });
    }

    // Check for potential email duplicates
    const emailGroups = {};
    customers.forEach(customer => {
      if (customer.contactEmail) {
        const normalizedEmail = customer.contactEmail.toLowerCase().trim();
        if (!emailGroups[normalizedEmail]) {
          emailGroups[normalizedEmail] = [];
        }
        emailGroups[normalizedEmail].push(customer);
      }
    });

    const emailDuplicateGroups = Object.entries(emailGroups).filter(([email, customers]) => customers.length > 1);

    if (emailDuplicateGroups.length > 0) {
      console.log(`⚠️  Found ${emailDuplicateGroups.length} groups of duplicate contact emails:\n`);

      emailDuplicateGroups.forEach(([email, duplicateCustomers], index) => {
        console.log(`--- Email Duplicate Group ${index + 1}: "${email}" ---`);
        duplicateCustomers.forEach((customer, customerIndex) => {
          console.log(`  ${customerIndex + 1}. ID: ${customer.id} - Name: ${customer.name}`);
        });
        console.log('');
      });
    }

    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total customers: ${customers.length}`);
    console.log(`Name duplicate groups: ${duplicateGroups.length}`);
    console.log(`Email duplicate groups: ${emailDuplicateGroups.length}`);

    const masterAccounts = customers.filter(c => !c.masterAccountId).length;
    const subaccounts = customers.filter(c => c.masterAccountId).length;
    console.log(`Master accounts: ${masterAccounts}`);
    console.log(`Subaccounts: ${subaccounts}`);
    console.log(`Disabled customers: ${customers.filter(c => c.disabled).length}`);

  } catch (error) {
    console.error('Error checking for duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateCustomers();