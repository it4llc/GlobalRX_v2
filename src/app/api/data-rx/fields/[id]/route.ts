// src/app/api/data-rx/fields/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to check permissions
function hasPermission(permissions: any, module: string): boolean {
  if (!permissions) return false;
  
  // For super admin format (* string or array with *)
  if (permissions === '*') return true;
  if (Array.isArray(permissions) && permissions.includes('*')) return true;
  
  // Check granular permissions
  if (typeof permissions === 'object') {
    // Check object with properties
    if (permissions[module]) {
      // If it's a boolean value directly
      if (typeof permissions[module] === 'boolean') return permissions[module];
      
      // If it's an object with view property
      if (typeof permissions[module] === 'object' && permissions[module].view === true) {
        return true;
      }
      
      // If it's an array of actions
      if (Array.isArray(permissions[module]) && 
          (permissions[module].includes('*') || permissions[module].includes('view'))) {
        return true;
      }
    }
  }
  
  return false;
}

// Standardize the field data to use retentionHandling consistently
function standardizeFieldData(fieldData: any): any {
  if (!fieldData) return {};
  
  const standardized = { ...fieldData };
  
  // If using the old property name, move it to the standardized name
  if (standardized.retention !== undefined && standardized.retentionHandling === undefined) {
    standardized.retentionHandling = standardized.retention;
    delete standardized.retention;
  }
  
  // Ensure we have a default value
  if (standardized.retentionHandling === undefined) {
    standardized.retentionHandling = 'no_delete';
  }
  
  return standardized;
}

// GET handler to fetch a specific field
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always allow access in development
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode - bypassing permission check");
    }
    // Otherwise check permissions
    else if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Field ID is required" }, { status: 400 });
    }

    try {
      // Fetch the specific field
      const requirement = await prisma.dSXRequirement.findUnique({
        where: { 
          id,
          type: 'field'
        },
        include: {
          serviceRequirements: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!requirement) {
        return NextResponse.json({ error: "Field not found" }, { status: 404 });
      }

      // Standardize the field data
      const standardizedFieldData = standardizeFieldData(requirement.fieldData);
      
      // Transform to the format expected by the UI
      const field = {
        id: requirement.id,
        fieldLabel: requirement.name,
        shortName: standardizedFieldData.shortName || requirement.name,
        dataType: standardizedFieldData.dataType || 'text',
        instructions: standardizedFieldData.instructions || '',
        retentionHandling: standardizedFieldData.retentionHandling,
        options: standardizedFieldData.options || [],
        disabled: requirement.disabled === true,
        services: requirement.serviceRequirements.map(sr => ({
          id: sr.service.id,
          name: sr.service.name
        })),
        versions: standardizedFieldData.versions || []
      };

      return NextResponse.json({ field });
    } catch (dbError) {
      console.error('Database error in GET /api/data-rx/fields/[id]:', dbError);
      return NextResponse.json(
        { error: "Database error while fetching field", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/data-rx/fields/[id]:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}

// PUT handler to update a field with version history
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always allow access in development
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode - bypassing permission check");
    }
    // Otherwise check permissions
    else if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Field ID is required" }, { status: 400 });
    }

    console.log("Received PUT request for field ID:", id);
    
    // Parse request body
    const body = await request.json();
    
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    const { fieldLabel, shortName, dataType, instructions, retentionHandling, options } = body;

    // Basic validation
    if (!fieldLabel) {
      return NextResponse.json({ 
        error: "Missing required fields", 
        details: "Field label is required" 
      }, { status: 400 });
    }

    try {
      // Get the current field data
      const existingRequirement = await prisma.dSXRequirement.findUnique({
        where: { id },
        include: {
          serviceRequirements: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      if (!existingRequirement) {
        return NextResponse.json({ error: "Field not found" }, { status: 404 });
      }

      // Standardize the existing field data
      const standardizedFieldData = standardizeFieldData(existingRequirement.fieldData);
      
      // Track changes for version history
      const changes: Record<string, { from: any, to: any }> = {};
      
      // Compare and track changes
      if (existingRequirement.name !== fieldLabel) {
        changes.fieldLabel = { from: existingRequirement.name, to: fieldLabel };
      }
      
      if (standardizedFieldData.shortName !== shortName) {
        changes.shortName = { from: standardizedFieldData.shortName, to: shortName };
      }
      
      if (standardizedFieldData.dataType !== dataType) {
        changes.dataType = { from: standardizedFieldData.dataType, to: dataType };
      }
      
      if (standardizedFieldData.instructions !== instructions) {
        changes.instructions = { from: standardizedFieldData.instructions, to: instructions };
      }
      
      if (standardizedFieldData.retentionHandling !== retentionHandling) {
        changes.retentionHandling = { from: standardizedFieldData.retentionHandling, to: retentionHandling };
      }
      
      // Only track options changes if they're different - do a deep comparison
      const existingOptions = standardizedFieldData.options || [];
      if (JSON.stringify(existingOptions) !== JSON.stringify(options || [])) {
        changes.options = { 
          from: existingOptions, 
          to: options || [] 
        };
      }
      
      // Create version history entry if there are changes
      const versionEntry = Object.keys(changes).length > 0 ? {
        timestamp: new Date().toISOString(),
        modifiedBy: session.user.email || 'unknown',
        changes
      } : null;
      
      // Prepare updated field data - Using standardized property names
      const updatedFieldData = {
        ...standardizedFieldData,
        shortName: shortName || standardizedFieldData.shortName,
        dataType: dataType || standardizedFieldData.dataType,
        instructions: instructions !== undefined ? instructions : standardizedFieldData.instructions,
        retentionHandling: retentionHandling || standardizedFieldData.retentionHandling,
        options: options || standardizedFieldData.options || [],
        // Add version entry if there are changes
        versions: versionEntry ? [...(standardizedFieldData.versions || []), versionEntry] : standardizedFieldData.versions
      };
      
      console.log("Updating field with data:", JSON.stringify({
        name: fieldLabel,
        fieldData: updatedFieldData
      }, null, 2));
      
      // Update the field
      const updatedRequirement = await prisma.dSXRequirement.update({
        where: { id },
        data: {
          name: fieldLabel,
          fieldData: updatedFieldData
        },
        include: {
          serviceRequirements: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      // Format the response to match what the frontend expects
      const responseField = {
        id: updatedRequirement.id,
        fieldLabel: updatedRequirement.name,
        shortName: updatedFieldData.shortName,
        dataType: updatedFieldData.dataType,
        instructions: updatedFieldData.instructions || '',
        retentionHandling: updatedFieldData.retentionHandling,
        options: updatedFieldData.options || [],
        disabled: updatedRequirement.disabled === true,
        services: updatedRequirement.serviceRequirements.map(sr => ({
          id: sr.service.id,
          name: sr.service.name
        })),
        versions: updatedFieldData.versions || []
      };

      console.log("Returning updated field:", JSON.stringify(responseField, null, 2));

      return NextResponse.json({ 
        success: true, 
        field: responseField
      });
    } catch (dbError) {
      console.error('Database error in PUT /api/data-rx/fields/[id]:', dbError);
      return NextResponse.json(
        { error: "Database error while updating field", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in PUT /api/data-rx/fields/[id]:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}