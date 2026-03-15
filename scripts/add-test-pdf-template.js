#!/usr/bin/env node
// Script to add a test PDF template to a document for testing

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Find a document requirement to update
    const document = await prisma.dSXRequirement.findFirst({
      where: {
        type: 'document',
        disabled: false,
      },
      select: {
        id: true,
        name: true,
        documentData: true,
      }
    });

    if (!document) {
      console.error('No active document requirements found');
      process.exit(1);
    }

    console.log(`Found document: ${document.name} (${document.id})`);

    // Parse existing documentData
    let documentData = {};
    if (document.documentData) {
      try {
        documentData = typeof document.documentData === 'string'
          ? JSON.parse(document.documentData)
          : document.documentData;
      } catch (e) {
        console.warn('Failed to parse existing documentData');
      }
    }

    // Add test PDF template metadata
    const updatedDocumentData = {
      ...documentData,
      pdfPath: '/uploads/documents/test-template.pdf',
      pdfFilename: 'Sample_Form_Template.pdf',
      pdfFileSize: 245760 // 240 KB
    };

    // Update the document
    await prisma.dSXRequirement.update({
      where: { id: document.id },
      data: {
        documentData: JSON.stringify(updatedDocumentData),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Successfully added PDF template metadata to document');
    console.log('Document ID:', document.id);
    console.log('Document Name:', document.name);
    console.log('PDF Path:', updatedDocumentData.pdfPath);
    console.log('PDF Filename:', updatedDocumentData.pdfFilename);
    console.log('PDF Size:', updatedDocumentData.pdfFileSize, 'bytes');
    console.log('\nNOTE: You need to place an actual PDF file at:');
    console.log(`  ${process.cwd()}/uploads/documents/test-template.pdf`);
    console.log('for the download to work properly.');
  } catch (error) {
    console.error('Error updating document:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();