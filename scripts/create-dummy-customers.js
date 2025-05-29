// scripts/create-dummy-customers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDummyData() {
  console.log('Creating dummy customer data...');
  
  try {
    // Create master accounts
    console.log('Creating master accounts...');
    const masterAccounts = await createMasterAccounts();
    
    // Create subaccounts
    console.log('Creating subaccounts...');
    await createSubaccounts(masterAccounts);
    
    // Create packages for each account
    console.log('Creating packages...');
    await createPackages();
    
    console.log('Dummy data created successfully');
  } catch (error) {
    console.error('Error creating dummy data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createMasterAccounts() {
  const masterAccounts = [
    {
      name: 'Global Enterprises',
      address: '123 Main St, San Francisco, CA 94105',
      contactName: 'John Smith',
      contactEmail: 'john.smith@globalenterprises.com',
      contactPhone: '415-555-1234',
      invoiceTerms: 'Net 30',
      invoiceContact: 'Accounts Payable',
      invoiceMethod: 'Email',
    },
    {
      name: 'Acme Corporation',
      address: '456 Market St, Chicago, IL 60601',
      contactName: 'Sarah Johnson',
      contactEmail: 'sarah.johnson@acmecorp.com',
      contactPhone: '312-555-6789',
      invoiceTerms: 'Net 45',
      invoiceContact: 'Finance Department',
      invoiceMethod: 'Mail',
    },
    {
      name: 'Tech Innovations',
      address: '789 Tech Blvd, Austin, TX 78701',
      contactName: 'Michael Chen',
      contactEmail: 'michael.chen@techinnovations.com',
      contactPhone: '512-555-4321',
      invoiceTerms: 'Net 15',
      invoiceContact: 'Billing Department',
      invoiceMethod: 'Email',
    },
  ];

  const createdAccounts = [];

  for (const account of masterAccounts) {
    const created = await prisma.customer.create({
      data: account
    });
    createdAccounts.push(created);
  }

  return createdAccounts;
}

async function createSubaccounts(masterAccounts) {
  // Make sure we have services to assign to customers
  let services = await prisma.service.findMany({
    where: { disabled: false },
    take: 5,
  });
  
  if (services.length === 0) {
    console.log('No services found. Creating some dummy services...');
    await createDummyServices();
    services = await prisma.service.findMany({
      where: { disabled: false },
      take: 5,
    });
  }

  const subaccounts = [
    {
      name: 'Global Enterprises - North America',
      address: '234 Broadway, New York, NY 10001',
      contactName: 'Linda Johnson',
      contactEmail: 'linda.johnson@globalenterprises.com',
      contactPhone: '212-555-2345',
      masterAccountId: masterAccounts[0].id,
      billingAccountId: masterAccounts[0].id,
      invoiceTerms: 'Net 30',
    },
    {
      name: 'Global Enterprises - Europe',
      address: '56 Oxford St, London, UK W1D 1BF',
      contactName: 'James Wilson',
      contactEmail: 'james.wilson@globalenterprises.com',
      contactPhone: '+44 20 7123 4567',
      masterAccountId: masterAccounts[0].id,
      billingAccountId: masterAccounts[0].id,
      invoiceTerms: 'Net 30',
    },
    {
      name: 'Acme Corp - West',
      address: '789 Wilshire Blvd, Los Angeles, CA 90017',
      contactName: 'David Lee',
      contactEmail: 'david.lee@acmecorp.com',
      contactPhone: '213-555-8901',
      masterAccountId: masterAccounts[1].id,
      billingAccountId: masterAccounts[1].id,
      invoiceTerms: 'Net 45',
    },
    {
      name: 'Tech Innovations - Research',
      address: '101 Innovation Way, Seattle, WA 98101',
      contactName: 'Emily Zhang',
      contactEmail: 'emily.zhang@techinnovations.com',
      contactPhone: '206-555-6543',
      masterAccountId: masterAccounts[2].id,
      billingAccountId: masterAccounts[2].id,
      invoiceTerms: 'Net 15',
    },
  ];

  const createdSubaccounts = [];

  for (const account of subaccounts) {
    const created = await prisma.customer.create({
      data: account
    });
    
    // Assign some services to each customer
    for (let i = 0; i < Math.min(3, services.length); i++) {
      await prisma.customerService.create({
        data: {
          customerId: created.id,
          serviceId: services[i].id,
        }
      });
    }
    
    createdSubaccounts.push(created);
  }

  return createdSubaccounts;
}

async function createPackages() {
  const customers = await prisma.customer.findMany({
    include: {
      services: {
        include: {
          service: true
        }
      }
    }
  });

  for (const customer of customers) {
    if (customer.services.length === 0) continue;
    
    // Create a standard package
    const standardPackage = await prisma.package.create({
      data: {
        name: 'Standard Package',
        description: 'Standard background check package',
        customerId: customer.id,
      }
    });
    
    // Add services to the package
    for (const customerService of customer.services) {
      // Define scope based on service functionality type
      let scope = {};
      
      if (customerService.service.functionalityType === 'verification') {
        if (customerService.service.name.toLowerCase().includes('edu')) {
          scope = { type: 'highest-degree-post-hs' };
        } else {
          scope = { type: 'most-recent-emp' };
        }
      } else if (customerService.service.functionalityType === 'record') {
        scope = { type: 'current-address' };
      }
      
      await prisma.packageService.create({
        data: {
          packageId: standardPackage.id,
          serviceId: customerService.service.id,
          scope: scope
        }
      });
    }
    
    // Create a comprehensive package if customer has more than 1 service
    if (customer.services.length > 1) {
      const comprehensivePackage = await prisma.package.create({
        data: {
          name: 'Comprehensive Package',
          description: 'Complete background check package',
          customerId: customer.id,
        }
      });
      
      // Add services to the package with more extensive scope
      for (const customerService of customer.services) {
        // Define scope based on service functionality type
        let scope = {};
        
        if (customerService.service.functionalityType === 'verification') {
          if (customerService.service.name.toLowerCase().includes('edu')) {
            scope = { type: 'all-degrees-post-hs' };
          } else {
            scope = { type: 'past-7-years' };
          }
        } else if (customerService.service.functionalityType === 'record') {
          scope = { type: 'past-7-years' };
        }
        
        await prisma.packageService.create({
          data: {
            packageId: comprehensivePackage.id,
            serviceId: customerService.service.id,
            scope: scope
          }
        });
      }
    }
  }
}

async function createDummyServices() {
  const services = [
    {
      name: 'Education Verification',
      category: 'Verification',
      description: 'Verify education credentials',
      functionalityType: 'verification',
    },
    {
      name: 'Employment Verification',
      category: 'Verification',
      description: 'Verify employment history',
      functionalityType: 'verification',
    },
    {
      name: 'Criminal Record Check',
      category: 'Record',
      description: 'Check for criminal records',
      functionalityType: 'record',
    },
    {
      name: 'Address Verification',
      category: 'Verification',
      description: 'Verify address history',
      functionalityType: 'verification',
    },
    {
      name: 'Reference Check',
      category: 'Other',
      description: 'Check professional references',
      functionalityType: 'other',
    },
  ];

  for (const service of services) {
    await prisma.service.create({
      data: service
    });
  }
}

createDummyData();