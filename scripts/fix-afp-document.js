#!/usr/bin/env node
// Script to manually add PDF template metadata to AFP document

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const documentId = '009deee9-510f-4e55-928f-e8e846572bcd'; // AFP Application and Consent

    // Fetch current document
    const document = await prisma.dSXRequirement.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        documentData: true,
      }
    });

    if (!document) {
      console.error('Document not found');
      process.exit(1);
    }

    console.log(`Found document: ${document.name}`);

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

    // Add PDF template metadata
    const updatedDocumentData = {
      ...documentData,
      pdfPath: '/uploads/documents/afp-application.pdf',
      pdfFilename: 'AFP_Application_and_Consent.pdf',
      pdfFileSize: 512000 // 500 KB
    };

    // Update the document
    await prisma.dSXRequirement.update({
      where: { id: documentId },
      data: {
        documentData: JSON.stringify(updatedDocumentData),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Successfully added PDF template metadata to AFP document');
    console.log('Document ID:', documentId);
    console.log('PDF Path:', updatedDocumentData.pdfPath);
    console.log('PDF Filename:', updatedDocumentData.pdfFilename);
    console.log('PDF Size:', updatedDocumentData.pdfFileSize, 'bytes');
    console.log('\nNOTE: Make sure to place an actual PDF file at:');
    console.log(`  ${process.cwd()}/uploads/documents/afp-application.pdf`);
  } catch (error) {
    console.error('Error updating document:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();