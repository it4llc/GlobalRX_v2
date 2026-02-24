// src/app/api/dsx/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger, { logAuthError, logPermissionDenied, logDatabaseError, logApiRequest } from '@/lib/logger';

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
    
    logger.debug('Validating location IDs', { count: locationIds.length });
    
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
    const validIds = existingLocations.map((loc: any) => loc.id);
    
    // Find any rejected IDs for debugging
    const rejectedIds = locationIds.filter(id => !validIds.includes(id));
    
    if (rejectedIds.length > 0) {
      logger.warn('Location IDs rejected during validation', {
        count: rejectedIds.length,
        rejectedIds
      });
    }
    
    logger.debug('Location validation complete', {
      validCount: validIds.length,
      totalCount: locationIds.length
    });
    
    return validIds;
  } catch (error: unknown) {
    logger.error('Error filtering valid location IDs', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    try {
      logger.debug('Fetching requirements', { serviceId });
      
      // Get requirements associated with this service through ServiceRequirement
      const serviceRequirements = await prisma.serviceRequirement.findMany({
        where: {
          serviceId,
          requirement: {
            disabled: false // Only get active requirements
          }
        },
        orderBy: {
          displayOrder: 'asc'
        },
        include: {
          requirement: true
        }
      });

      // Extract requirements with display order
      const requirements = serviceRequirements.map((sr: any) => {
        const req = {
          ...sr.requirement,
          displayOrder: sr.displayOrder
        };
        logger.debug('Requirement display order', {
          name: sr.requirement.name,
          displayOrder: sr.displayOrder,
          type: typeof sr.displayOrder
        });
        return req;
      });

      logger.info('Requirements fetched', {
        count: requirements.length,
        serviceId,
        requirements: requirements.length > 0 ? requirements.map((r: any) => ({
          name: r.name,
          displayOrder: r.displayOrder,
          id: r.id
        })) : []
      });

      // Fetch mappings for the service
      const mappings = await prisma.dSXMapping.findMany({
        where: { serviceId }
      });

      // Format mappings as a key-value object
      // The existence of a mapping means the requirement is mapped to that location
      // The isRequired field is for whether it's required vs optional (not used for checkbox state)
      const mappingsObject: Record<string, boolean> = {};
      mappings.forEach(mapping => {
        // Use the new format with triple underscore separator to avoid conflicts with UUIDs
        const key = `${mapping.locationId}___${mapping.requirementId}`;
        // If a mapping exists, it means the checkbox should be checked
        mappingsObject[key] = true;
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
    } catch (dbError: unknown) {
      logDatabaseError('dsx_fetch', dbError as Error, session?.user?.id);
      return NextResponse.json(
        { error: "Database error while fetching DSX data", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Error in GET /api/dsx', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission: dsx" }, { status: 403 });
    }

    let rawBody;
    try {
      rawBody = await request.json();
    } catch (error: unknown) {
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
            logger.error('Invalid requirements data format', { data, type: typeof data });
            return NextResponse.json({ 
              error: "Invalid requirements data format", 
              details: "Requirements data must be an array" 
            }, { status: 400 });
          }
          
          logger.debug('Processing requirements', { serviceId });
          
          // Use a transaction to ensure consistency
          const result = await prisma.$transaction(async (tx) => {
            // First, delete all existing service-requirement relationships for this service
            await tx.serviceRequirement.deleteMany({
              where: { serviceId }
            });
            
            // Then create new service-requirement relationships for each requirement
            const createdRelationships = [];

            // Process each requirement with sequential display order
            for (let i = 0; i < data.length; i++) {
              const req = data[i];
              try {
                // Skip if no ID provided
                if (!req.id) {
                  logger.warn('Missing requirement ID in request');
                  continue;
                }
                
                // Check if the requirement exists
                const existingRequirement = await tx.dSXRequirement.findUnique({
                  where: { id: req.id }
                });
                
                if (!existingRequirement) {
                  logger.warn('Requirement not found', { requirementId: req.id });
                  continue;
                }
                
                // Create relationship between service and requirement with sequential display order
                const serviceRequirement = await tx.serviceRequirement.create({
                  data: {
                    serviceId,
                    requirementId: req.id,
                    displayOrder: i * 10  // Use index * 10 to allow for future insertions
                  }
                });
                
                createdRelationships.push(serviceRequirement.id);
              } catch (error: unknown) {
                logger.error('Error creating service-requirement relationship', {
                  error: error instanceof Error ? error.message : String(error),
                  requirementId: req.id,
                  serviceId
                });
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
            // First, get existing mappings to preserve isRequired status
            const existingMappings = await tx.dSXMapping.findMany({
              where: { serviceId }
            });

            // Create a map to preserve existing isRequired values
            const existingRequiredMap = new Map<string, boolean>();
            existingMappings.forEach(mapping => {
              const key = `${mapping.locationId}_${mapping.requirementId}`;
              existingRequiredMap.set(key, mapping.isRequired);
            });

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
                // Preserve existing isRequired status if it exists, otherwise default to true
                const key = `${locationId}_${requirementId}`;
                const isRequired = existingRequiredMap.get(key) ?? true; // Default to true for new mappings

                allMappingsToCreate.push({
                  serviceId,
                  requirementId,
                  locationId,
                  isRequired
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
        } catch (error: unknown) {
          logger.error('Error in mappings transaction', {
            error: error instanceof Error ? error.message : String(error),
            serviceId
          });
          return NextResponse.json({ 
            error: "Failed to save mappings", 
            details: error.message 
          }, { status: 500 });
        }
      }
      else if (type === 'availability' && data) {
        try {
          logger.debug('Processing availability data', {
            serviceId,
            locationCount: Object.keys(data).length
          });
          
          const result = await prisma.$transaction(async (tx) => {
            // Delete existing availability records
            const deletedRecords = await tx.dSXAvailability.deleteMany({
              where: { serviceId }
            });
            logger.debug('Deleted existing availability records', { count: deletedRecords.count });
            
            // Get all location IDs 
            const locationIds = Object.keys(data).filter(id => id !== 'all');
            logger.debug('Processing location IDs', { count: locationIds.length });
            
            // Check for Afghanistan specifically
            if (locationIds.includes('32c804e1-e904-45b0-b150-cdc70be9679c')) {
              logger.debug('Afghanistan included in location IDs');
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
              logger.warn('Invalid location IDs skipped', {
                count: skippedLocations.length,
                skippedIds: skippedLocations
              });
            }
            
            // Create new availability records
            if (availabilityToCreate.length > 0) {
              logger.debug('Creating availability records', { count: availabilityToCreate.length });
              const result = await tx.dSXAvailability.createMany({
                data: availabilityToCreate,
                skipDuplicates: true
              });
              logger.info('Availability records created', { count: result.count });
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
        } catch (error: unknown) {
          logger.error('Error in availability transaction', {
            error: error instanceof Error ? error.message : String(error),
            serviceId
          });
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
    } catch (error: unknown) {
      logger.error('Error in DSX operations', {
        error: error instanceof Error ? error.message : String(error),
        serviceId
      });
      return NextResponse.json(
        { error: "Failed to save DSX data", details: error.message },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Error in POST /api/dsx', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}