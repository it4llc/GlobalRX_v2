// src/app/api/data-rx/fields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';
import { canAccessDataRx } from '@/lib/auth-utils';

/**
 * Generate a stable camelCase key from a field label
 * @param label The human-readable field label
 * @returns A camelCase key suitable for use as a JSON property name
 */
function generateFieldKey(label: string): string {
  // Split on spaces, hyphens, slashes, dots, apostrophes, and parentheses
  const words = label.split(/[\s\-\/\.\'\(\)]+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return 'field';
  }

  // Join as camelCase (first word lowercase, subsequent words capitalized first letter)
  const camelCase = words.map((word, index) => {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, ''); // Remove any remaining non-alphanumeric
    if (index === 0) {
      return cleanWord.toLowerCase();
    }
    return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
  }).join('');

  // Ensure the result starts with a lowercase letter
  const result = camelCase.charAt(0).toLowerCase() + camelCase.slice(1);

  // If result is empty or doesn't start with a letter, prefix with 'field'
  if (!result || !/^[a-z]/i.test(result)) {
    return 'field' + result;
  }

  return result;
}

function standardizeFieldData(fieldData: any): any {
  if (!fieldData) return {};
  
  const standardized = { ...fieldData };
  
  // If using the old property name, move it to the standardized name
  if (standardized.retention !== undefined && standardized.retentionHandling === undefined) {
    standardized.retentionHandling = standardized.retention;
  }
  
  // Ensure we have a default value
  if (standardized.retentionHandling === undefined) {
    standardized.retentionHandling = 'no_delete';
  }
  
  return standardized;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check permissions using new module format
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    
    // Fetch data fields from the database
    const fields = await prisma.dSXRequirement.findMany({
      where: {
        type: 'field',
        ...(includeDisabled ? {} : { disabled: false }) // Only include non-disabled requirements unless specified
      },
      orderBy: {
        name: 'asc' // Order alphabetically by name
      },
      include: {
        // Include services through the ServiceRequirement relation
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
    
    // Transform fields to expected format with standardized property names
    const transformedFields = fields.map((field: any) => {
      // Standardize the field data to ensure consistent property names
      const standardizedData = standardizeFieldData(field.fieldData as any || {});
      
      return {
        id: field.id,
        fieldLabel: field.name,
        fieldKey: field.fieldKey,
        dataType: standardizedData.dataType || 'text',
        shortName: standardizedData.shortName || field.name,
        instructions: standardizedData.instructions || '',
        retentionHandling: standardizedData.retentionHandling,
        collectionTab: standardizedData.collectionTab || 'subject', // NEW: default to subject
        addressConfig: standardizedData.addressConfig || null, // Include address config
        requiresVerification: standardizedData.requiresVerification || false, // Include verification flag
        options: standardizedData.options || [],
        disabled: field.disabled,
        // Map services from the join table
        services: field.serviceRequirements.map((sr: any) => ({
          id: sr.service.id,
          name: sr.service.name
        }))
      };
    });
    
    // Log the first field for debugging
    if (transformedFields.length > 0) {
      logger.debug('First field retention', { retention: transformedFields[0].retentionHandling });
    }
    
    return NextResponse.json({ fields: transformedFields });
  } catch (error: unknown) {
    logger.error('Error fetching data fields', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "An error occurred while fetching data fields" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check permissions using new module format
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }
    
    // Parse request body
    const data = await request.json();
    logger.debug('API POST /data-rx/fields - Received data', { data });

    // Validate required fields
    if (!data.fieldLabel || !data.dataType) {
      return NextResponse.json(
        { error: "Missing required fields: fieldLabel and dataType are required" },
        { status: 400 }
      );
    }
    
    // Check for existing field with the same name
    const existingField = await prisma.dSXRequirement.findFirst({
      where: {
        name: data.fieldLabel,
        type: 'field'
      }
    });

    if (existingField) {
      return NextResponse.json(
        { error: `A field with the name "${data.fieldLabel}" already exists` },
        { status: 409 }
      );
    }

    // Generate unique fieldKey
    let fieldKey = generateFieldKey(data.fieldLabel);
    let keyCounter = 2;

    // Check for existing fieldKey and append number if necessary
    while (await prisma.dSXRequirement.findFirst({ where: { fieldKey } })) {
      fieldKey = `${generateFieldKey(data.fieldLabel)}${keyCounter}`;
      keyCounter++;
    }

    // Create field with standardized property names
    const fieldDataToSave = {
      dataType: data.dataType,
      shortName: data.shortName || data.fieldLabel,
      instructions: data.instructions || '',
      options: data.options || [],
      // Use standardized property name
      retentionHandling: data.retentionHandling || 'no_delete',
      collectionTab: data.collectionTab || 'subject', // NEW: add collectionTab
      addressConfig: data.addressConfig || null, // Add address configuration
      requiresVerification: data.requiresVerification || false // Add verification flag
    };

    logger.debug('API POST /data-rx/fields - Saving fieldData', { fieldData: fieldDataToSave });

    const field = await prisma.dSXRequirement.create({
      data: {
        name: data.fieldLabel,
        type: 'field',
        fieldKey,
        fieldData: fieldDataToSave
      }
    });
    
    return NextResponse.json({
      field: {
        id: field.id,
        fieldLabel: field.name,
        fieldKey,
        dataType: field.fieldData.dataType,
        shortName: field.fieldData.shortName,
        instructions: field.fieldData.instructions,
        retentionHandling: field.fieldData.retentionHandling,
        collectionTab: field.fieldData.collectionTab || 'subject', // NEW: include collectionTab
        addressConfig: field.fieldData.addressConfig || null, // Include address config
        requiresVerification: field.fieldData.requiresVerification || false, // Include verification flag
        options: field.fieldData.options || [],
        services: []
      }
    }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating data field', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "An error occurred while creating the data field" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check permissions using new module format
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }
    
    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }
    
    // Get existing field
    const existingField = await prisma.dSXRequirement.findUnique({
      where: { id: data.id }
    });
    
    if (!existingField) {
      return NextResponse.json(
        { error: `Field with id "${data.id}" not found` },
        { status: 404 }
      );
    }
    
    // Check if name is being changed and if a field with new name already exists
    if (data.fieldLabel && data.fieldLabel !== existingField.name) {
      const nameExists = await prisma.dSXRequirement.findFirst({
        where: {
          name: data.fieldLabel,
          type: 'field',
          id: { not: data.id } // Exclude current field
        }
      });
      
      if (nameExists) {
        return NextResponse.json(
          { error: `A field with the name "${data.fieldLabel}" already exists` },
          { status: 409 }
        );
      }
    }
    
    // Get current field data
    const currentFieldData = existingField.fieldData as any || {};
    
    // Standardize field data
    const standardizedFieldData = { ...currentFieldData };
    
    // Move retention to retentionHandling if present
    if (standardizedFieldData.retention !== undefined && standardizedFieldData.retentionHandling === undefined) {
      standardizedFieldData.retentionHandling = standardizedFieldData.retention;
      delete standardizedFieldData.retention;
    }
    
    // Update field with standardized property name (explicitly exclude fieldKey from updates)
    const field = await prisma.dSXRequirement.update({
      where: { id: data.id },
      data: {
        name: data.fieldLabel || existingField.name,
        disabled: data.disabled !== undefined ? data.disabled : existingField.disabled,
        // fieldKey is explicitly NOT included here - it must never change after creation
        fieldData: {
          dataType: data.dataType || standardizedFieldData.dataType,
          shortName: data.shortName || standardizedFieldData.shortName,
          instructions: data.instructions !== undefined ? data.instructions : standardizedFieldData.instructions,
          options: data.options || standardizedFieldData.options,
          // Use standardized property name
          retentionHandling: data.retentionHandling || standardizedFieldData.retentionHandling || 'no_delete',
          requiresVerification: data.requiresVerification !== undefined ? data.requiresVerification : (standardizedFieldData.requiresVerification || false)
        }
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
    
    return NextResponse.json({
      field: {
        id: field.id,
        fieldLabel: field.name,
        fieldKey: field.fieldKey,
        dataType: field.fieldData.dataType,
        shortName: field.fieldData.shortName,
        instructions: field.fieldData.instructions,
        options: field.fieldData.options,
        retentionHandling: field.fieldData.retentionHandling,
        requiresVerification: field.fieldData.requiresVerification || false,
        disabled: field.disabled,
        services: field.serviceRequirements.map((sr: any) => ({
          id: sr.service.id,
          name: sr.service.name
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Error updating data field', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "An error occurred while updating the data field" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check permissions using new module format
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }
    
    // Get existing field
    const existingField = await prisma.dSXRequirement.findUnique({
      where: { id },
      include: {
        serviceRequirements: true,
        mappings: true
      }
    });
    
    if (!existingField) {
      return NextResponse.json(
        { error: `Field with id "${id}" not found` },
        { status: 404 }
      );
    }
    
    // Check if field is in use by services
    if (existingField.serviceRequirements.length > 0) {
      // Instead of preventing deletion, we'll disable the field
      await prisma.dSXRequirement.update({
        where: { id },
        data: { disabled: true }
      });
      
      return NextResponse.json({
        message: `Field "${existingField.name}" has been disabled because it is in use by services`,
        disabled: true
      });
    }
    
    // Delete field if not in use
    await prisma.dSXRequirement.delete({
      where: { id }
    });
    
    return NextResponse.json({ message: `Field "${existingField.name}" has been deleted` });
  } catch (error: unknown) {
    logger.error('Error deleting data field', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: "An error occurred while deleting the data field" },
      { status: 500 }
    );
  }
}