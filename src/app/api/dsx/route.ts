// src/app/api/dsx/route.ts

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

// Helper function that filters out location IDs that don't exist in the database
async function filterValidLocationIds(locationIds: string[]): Promise<string[]> {
  try {
    if (!locationIds || locationIds.length === 0) return [];
    
    console.log(`Validating ${locationIds.length} location IDs...`);
    
    // Find all valid locations that match the provided IDs
    const existingLocations = await prisma.country.findMany({
      where: {
        id: {
          in: locationIds
        }
      },
      select: {
        id: true,
        name: true,
        code2: true
      }
    });
    
    // Extract just the IDs
    const validIds = existingLocations.map(loc => loc.id);
    
    // Find any rejected IDs for debugging
    const rejectedIds = locationIds.filter(id => !validIds.includes(id));
    
    if (rejectedIds.length > 0) {
      console.warn(`${rejectedIds.length} location IDs were rejected during validation:`);
      rejectedIds.forEach(id => {
        console.warn(`- Invalid location ID: ${id}`);
      });
    }
    
    console.log(`Validated ${validIds.length}/${locationIds.length} location IDs`);
    
    return validIds;
  } catch (error) {
    console.error('Error filtering valid location IDs:', error);
    return []; // Return empty array if error occurs
  }
}

// GET handler to fetch DSX data
export async function GET(request: NextRequest) {
  try {
    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');

    if (!serviceId) {
      return NextResponse.json(
        { error: "Missing required parameter: serviceId" }, 
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    try {
      console.log(`Fetching requirements for service: ${serviceId}`);
      
      // Get requirements associated with this service through ServiceRequirement
      const serviceRequirements = await prisma.serviceRequirement.findMany({
        where: { 
          serviceId,
          requirement: {
            disabled: false // Only get active requirements
          }
        },
        include: {
          requirement: true
        }
      });
      
      // Extract just the requirements
      const requirements = serviceRequirements.map(sr => sr.requirement);
      
      console.log(`Found ${requirements.length} requirements for service: ${serviceId}`);
      if (requirements.length > 0) {
        console.log('Sample requirement:', requirements[0]);
      }

      // Fetch mappings for the service
      const mappings = await prisma.dSXMapping.findMany({
        where: { serviceId }
      });

      // Format mappings as a key-value object
      const mappingsObject: Record<string, boolean> = {};
      mappings.forEach(mapping => {
        // Use the new format with triple underscore separator to avoid conflicts with UUIDs
        const key = `${mapping.locationId}___${mapping.requirementId}`;
        mappingsObject[key] = mapping.isRequired;
      });

      // Fetch availability for the service
      const availability = await prisma.dSXAvailability.findMany({
        where: { serviceId }
      });

      // Format availability as a key-value object
      const availabilityObject: Record<string, boolean> = {};
      availability.forEach(item => {
        availabilityObject[item.locationId] = item.isAvailable;
      });

      // Special handling for the 'all' location:
      // 'all' should be false if any country is explicitly set to false
      // This ensures that when some countries are deselected, 'all' appears as deselected too
      const hasAnyUnavailable = availability.some(item => item.isAvailable === false);
      if (hasAnyUnavailable) {
        availabilityObject['all'] = false;
      }
      
      // Return the complete response
      return NextResponse.json({
        requirements,
        mappings: mappingsObject,
        availability: availabilityObject
      });
    } catch (dbError) {
      console.error('Database error in GET /api/dsx:', dbError);
      return NextResponse.json(
        { error: "Database error while fetching DSX data", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/dsx:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}

// POST handler to save DSX data
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    let rawBody;
    try {
      rawBody = await request.json();
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    
    // Additional validation
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    
    if (!rawBody.serviceId) {
      return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
    }
    
    // Extract data from the request
    const { serviceId, type, data } = rawBody;
    
    // Process based on request type
    try {
      if ((type === 'requirement' || type === 'requirements') && data) {
        // Handle array of requirements
        if (type === 'requirements') {
          if (!Array.isArray(data)) {
            console.error('Error: requirements data is not an array:', data);
            return NextResponse.json({ 
              error: "Invalid requirements data format", 
              details: "Requirements data must be an array" 
            }, { status: 400 });
          }
          
          console.log('Processing requirements for service:', serviceId);
          
          // Use a transaction to ensure consistency
          const result = await prisma.$transaction(async (tx) => {
            // First, delete all existing service-requirement relationships for this service
            await tx.serviceRequirement.deleteMany({
              where: { serviceId }
            });
            
            // Then create new service-requirement relationships for each requirement
            const createdRelationships = [];
            
            // Process each requirement
            for (const req of data) {
              try {
                // Skip if no ID provided
                if (!req.id) {
                  console.warn('Missing requirement ID in request, skipping');
                  continue;
                }
                
                // Check if the requirement exists
                const existingRequirement = await tx.dSXRequirement.findUnique({
                  where: { id: req.id }
                });
                
                if (!existingRequirement) {
                  console.warn(`Requirement with ID ${req.id} not found, skipping`);
                  continue;
                }
                
                // Create relationship between service and requirement
                const serviceRequirement = await tx.serviceRequirement.create({
                  data: {
                    serviceId,
                    requirementId: req.id
                  }
                });
                
                createdRelationships.push(serviceRequirement.id);
              } catch (error) {
                console.error(`Error creating service-requirement relationship:`, error);
              }
            }
            
            return { 
              success: true, 
              relationshipIds: createdRelationships,
              count: createdRelationships.length
            };
          });
          
          return NextResponse.json({ 
            ...result,
            message: `Successfully associated ${result.count} requirements with service ${serviceId}`
          });
        }
        // Handle single requirement
        else {
          // Similar logic for a single requirement
          return NextResponse.json({ 
            error: "Single requirement handling not implemented" 
          }, { status: 501 });
        }
      }
      else if (type === 'mappings' && data) {
        try {
          // Start transaction for consistency
          const result = await prisma.$transaction(async (tx) => {
            // Delete existing mappings for this service
            await tx.dSXMapping.deleteMany({
              where: { serviceId }
            });
            
            // Process each requirement and its location mappings
            const allMappingsToCreate = [];
            
            for (const [requirementId, locationIds] of Object.entries(data)) {
              if (!Array.isArray(locationIds) || locationIds.length === 0) {
                continue;
              }
              
              // Filter out invalid location IDs
              const validLocationIds = await filterValidLocationIds(locationIds);
              
              if (validLocationIds.length === 0) {
                continue;
              }
              
              // Create mapping objects for each valid location
              for (const locationId of validLocationIds) {
                allMappingsToCreate.push({
                  serviceId,
                  requirementId,
                  locationId,
                  isRequired: false  // Default to false since UI doesn't currently support marking as required
                });
              }
            }
            
            // Create new mappings in bulk if we have any
            if (allMappingsToCreate.length > 0) {
              // Create mappings in smaller batches to avoid transaction timeouts
              const BATCH_SIZE = 100;
              let createdCount = 0;
              
              for (let i = 0; i < allMappingsToCreate.length; i += BATCH_SIZE) {
                const batch = allMappingsToCreate.slice(i, i + BATCH_SIZE);
                const result = await tx.dSXMapping.createMany({
                  data: batch,
                  skipDuplicates: true
                });
                createdCount += result.count;
              }
              
              return { success: true, createdCount };
            }
            
            return { success: true, createdCount: 0 };
          });
          
          return NextResponse.json(result);
        } catch (error) {
          console.error('Error in mappings transaction:', error);
          return NextResponse.json({ 
            error: "Failed to save mappings", 
            details: error.message 
          }, { status: 500 });
        }
      }
      else if (type === 'availability' && data) {
        try {
          console.log('Processing availability data for service:', serviceId);
          console.log('Received locations with availability changes:', Object.keys(data).length);
          
          const result = await prisma.$transaction(async (tx) => {
            // Delete existing availability records
            const deletedRecords = await tx.dSXAvailability.deleteMany({
              where: { serviceId }
            });
            console.log(`Deleted ${deletedRecords.count} existing availability records`);
            
            // Get all location IDs 
            const locationIds = Object.keys(data).filter(id => id !== 'all');
            console.log(`Processing ${locationIds.length} location IDs (excluding 'all')`);
            
            // Check for Afghanistan specifically
            if (locationIds.includes('32c804e1-e904-45b0-b150-cdc70be9679c')) {
              console.log('Afghanistan is included in the location IDs');
            }
            
            // Filter location IDs that don't exist in database
            const validLocationIds = await filterValidLocationIds(locationIds);
            
            // Create a set for fast lookup
            const validIdSet = new Set(validLocationIds);
            
            // Create availability records for locations that are explicitly false
            const availabilityToCreate = [];
            const skippedLocations = [];
            
            for (const [locationId, isAvailable] of Object.entries(data)) {
              // Skip 'all' location or invalid IDs
              if (locationId === 'all') continue;
              
              if (!validIdSet.has(locationId)) {
                skippedLocations.push(locationId);
                continue;
              }
              
              // Only create records for locations that are not available (false)
              if (isAvailable === false) {
                availabilityToCreate.push({
                  serviceId,
                  locationId,
                  isAvailable: false
                });
              }
            }
            
            if (skippedLocations.length > 0) {
              console.warn(`Skipped ${skippedLocations.length} invalid location IDs during availability processing`);
            }
            
            // Create new availability records
            if (availabilityToCreate.length > 0) {
              console.log(`Creating ${availabilityToCreate.length} availability records`);
              const result = await tx.dSXAvailability.createMany({
                data: availabilityToCreate,
                skipDuplicates: true
              });
              console.log(`Successfully created ${result.count} availability records`);
              return { 
                success: true, 
                createdCount: result.count,
                totalProcessed: locationIds.length,
                skippedCount: skippedLocations.length
              };
            }
            
            return { 
              success: true, 
              createdCount: 0,
              totalProcessed: locationIds.length,
              skippedCount: skippedLocations.length,
              message: "No unavailable locations to save"
            };
          });
          
          return NextResponse.json(result);
        } catch (error) {
          console.error('Error in availability transaction:', error);
          return NextResponse.json({ 
            error: "Failed to save availability", 
            details: error.message,
            locationCount: Object.keys(data).filter(id => id !== 'all').length
          }, { status: 500 });
        }
      }
      else {
        return NextResponse.json({ 
          error: "Invalid request type", 
          details: "Request must have a valid type (requirement, mappings, or availability) and corresponding data" 
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error in DSX operations:', error);
      return NextResponse.json(
        { error: "Failed to save DSX data", details: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/dsx:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}