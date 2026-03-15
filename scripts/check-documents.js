#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find documents with AFP or Primary ID
    const documents = await prisma.dSXRequirement.findMany({
      where: {
        type: 'document',
        OR: [
          { name: { contains: 'AFP' } },
          { name: { contains: 'Primary ID' } }
        ]
      },
      select: {
        id: true,
        name: true,
        documentData: true,
      }
    });

    console.log('Found documents:');
    documents.forEach(doc => {
      console.log('\n---');
      console.log('Name:', doc.name);
      console.log('ID:', doc.id);

      let data = {};
      try {
        if (doc.documentData) {
          data = typeof doc.documentData === 'string'
            ? JSON.parse(doc.documentData)
            : doc.documentData;
        }
      } catch (e) {
        console.log('Error parsing documentData:', e.message);
      }

      console.log('Has pdfPath?', !!data.pdfPath);
      if (data.pdfPath) {
        console.log('  - pdfPath:', data.pdfPath);
        console.log('  - pdfFilename:', data.pdfFilename);
        console.log('  - pdfFileSize:', data.pdfFileSize);
      }
      console.log('Full documentData:', JSON.stringify(data, null, 2));
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();