// src/app/api/data-rx/documents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to check permissions
function hasPermission(permissions: any, module: string): boolean {
  if (!permissions) return false;
  
  // For super admin format
  if (permissions === '*') return true;
  if (Array.isArray(permissions) && permissions.includes('*')) return true;
  
  // Check granular permissions
  if (typeof permissions === 'object') {
    if (permissions[module]) {
      if (typeof permissions[module] === 'boolean') return permissions[module];
      if (typeof permissions[module] === 'object' && permissions[module].view === true) {
        return true;
      }
      if (Array.isArray(permissions[module]) && 
          (permissions[module].includes('*') || permissions[module].includes('view'))) {
        return true;
      }
    }
  }
  
  return false;
}

// GET handler to fetch documents
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    const serviceId = searchParams.get('serviceId');
    const includeServices = searchParams.get('includeServices') === 'true';

    // Build the query
    const where: any = {
      type: 'document',
    };

    // Only include enabled documents unless specifically requested
    if (!includeDisabled) {
      where.disabled = false;
    }

    // Set up include for services if needed
    const include: any = {};
    if (includeServices) {
      include.serviceRequirements = {
        include: {
          service: true
        }
      };
    }

    // If serviceId is provided, filter by service
    if (serviceId) {
      // We need to filter documents that are associated with this service
      // through the ServiceRequirement relationship
      const documents = await prisma.dSXRequirement.findMany({
        where: {
          type: 'document',
          ...(includeDisabled ? {} : { disabled: false }),
          serviceRequirements: {
            some: {
              serviceId: serviceId
            }
          }
        },
        include,
      });
      
      // Process data for frontend if including services
      const processedDocuments = includeServices 
        ? documents.map(doc => ({
            ...doc,
            documentName: doc.name, // Add alias for frontend compatibility
            services: doc.serviceRequirements.map(sr => ({
              id: sr.service.id,
              name: sr.service.name
            }))
          }))
        : documents;
      
      // Return the documents
      return NextResponse.json({ documents: processedDocuments });
    }

    // Otherwise fetch all documents
    const documents = await prisma.dSXRequirement.findMany({
      where,
      include,
    });

    // Process data for frontend if including services
    const processedDocuments = includeServices 
      ? documents.map(doc => ({
          ...doc,
          documentName: doc.name, // Add alias for frontend compatibility
          services: doc.serviceRequirements.map(sr => ({
            id: sr.service.id,
            name: sr.service.name
          }))
        }))
      : documents.map(doc => ({
          ...doc,
          documentName: doc.name, // Always add the alias for consistency
        }));

    return NextResponse.json({ documents: processedDocuments });
  } catch (error) {
    console.error('Error in GET /api/data-rx/documents:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

// POST handler to create or update documents
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Extract fields from request body
    // Support both API naming (name) and frontend naming (documentName)
    const { 
      id,
      documentName, // From frontend
      name, // Direct API usage
      instructions,
      scope,
      retentionHandling,
      type = 'document',
      disabled = false
    } = body;

    // Use documentName if provided, otherwise fall back to name
    const documentNameToUse = documentName || name;

    // Validate required fields
    if (!documentNameToUse) {
      return NextResponse.json({ error: "Document name is required" }, { status: 400 });
    }

    // Prepare document data object
    const documentData = {
      instructions: instructions || "",
      scope: scope || "",
      retentionHandling: retentionHandling || "no_delete"
    };

    console.log("Creating document with name:", documentNameToUse);

    try {
      let document;

      if (id) {
        // Update existing document
        document = await prisma.dSXRequirement.update({
          where: { id },
          data: {
            name: documentNameToUse,
            type,
            documentData,
            disabled
          }
        });
        
        console.log(`Updated document: ${document.id}`);
      } else {
        // Create new document
        document = await prisma.dSXRequirement.create({
          data: {
            name: documentNameToUse,
            type,
            documentData,
            disabled
          }
        });
        
        console.log(`Created new document: ${document.id}`);
      }

      // Add documentName field for frontend compatibility
      const response = {
        ...document,
        documentName: document.name
      };

      return NextResponse.json(response);
    } catch (dbError) {
      console.error('Database error in POST /api/data-rx/documents:', dbError);
      return NextResponse.json(
        { error: "Database error while creating document" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/data-rx/documents:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

// DELETE handler for documents
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    try {
      // Instead of deleting, we'll disable the document
      const document = await prisma.dSXRequirement.update({
        where: { id },
        data: { disabled: true }
      });
      
      console.log(`Disabled document: ${document.id}`);

      return NextResponse.json({ success: true, message: "Document disabled successfully" });
    } catch (dbError) {
      console.error('Database error in DELETE /api/data-rx/documents:', dbError);
      return NextResponse.json(
        { error: "Database error while disabling document" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in DELETE /api/data-rx/documents:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}