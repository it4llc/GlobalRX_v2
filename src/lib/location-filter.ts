// src/lib/location-filter.ts
import logger from '@/lib/logger';

/**
 * This utility helps filter out problematic location IDs before they reach the database
 * and provides functions to validate location IDs against the database.
 */

// Set of location IDs that should always be filtered out from database operations
export const PROBLEMATIC_LOCATION_IDS = new Set([
  'all',        // Special location used in UI hierarchy but not in database
  '32c804e1'    // Problematic location ID from error logs
]);

// Cache of valid location IDs
let validLocationIdsCache: Set<string> | null = null;

/**
 * Fetches and caches valid location IDs from the database
 */
export async function getValidLocationIds(prisma: any): Promise<Set<string>> {
  if (validLocationIdsCache) {
    return validLocationIdsCache;
  }

  try {
    const locations = await prisma.location.findMany({
      select: { id: true }
    });
    
    validLocationIdsCache = new Set(locations.map(loc => loc.id));
    logger.info(`Cached ${validLocationIdsCache.size} valid location IDs`);
    return validLocationIdsCache;
  } catch (error) {
    logger.error('Error fetching valid location IDs:', error);
    return new Set();
  }
}

/**
 * Filters out problematic location IDs from mappings
 */
export function filterMappings(mappings: Record<string, boolean>): Record<string, boolean> {
  const filteredMappings: Record<string, boolean> = {};
  
  Object.entries(mappings).forEach(([key, value]) => {
    const [locationId] = key.split('-');
    if (!PROBLEMATIC_LOCATION_IDS.has(locationId)) {
      filteredMappings[key] = value;
    }
  });
  
  return filteredMappings;
}

/**
 * Filters out problematic location IDs from availability data
 */
export function filterAvailability(availability: Record<string, boolean>): Record<string, boolean> {
  const filteredAvailability: Record<string, boolean> = {};
  
  Object.entries(availability).forEach(([locationId, value]) => {
    if (!PROBLEMATIC_LOCATION_IDS.has(locationId)) {
      filteredAvailability[locationId] = value;
    }
  });
  
  return filteredAvailability;
}

/**
 * Creates a function to add the "all" location to the locations table
 */
export async function ensureAllLocationExists(prisma: any) {
  try {
    // Check if "all" location already exists
    const allLocation = await prisma.location.findUnique({
      where: { id: 'all' }
    });
    
    // If it doesn't exist, create it
    if (!allLocation) {
      await prisma.location.create({
        data: {
          id: 'all',
          name: 'ALL',
          code_2: 'ALL',
          code_3: 'ALL',
          numeric: '000',
          disabled: false
        }
      });
      logger.info('Created "all" location in database');
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to ensure "all" location exists:', error);
    return false;
  }
}

/**
 * Fixes the mapping data format for the DSX API
 * Handles both legacy and new formats, removing problematic location IDs
 */
export function prepareMappingDataForAPI(data: any): Record<string, string[]> {
  // Initialize the result in the format { requirementId: [locationId1, locationId2, ...] }
  const result: Record<string, string[]> = {};
  
  // Process based on data format
 if (Object.values(data).some(value => Array.isArray(value))) {
    // Already in the new format: { requirementId: [locationId1, locationId2, ...] }
    Object.entries(data).forEach(([requirementId, locationIds]) => {
      if (Array.isArray(locationIds)) {
        // Filter out problematic location IDs
        const validLocationIds = (locationIds as string[]).filter(
          locationId => !PROBLEMATIC_LOCATION_IDS.has(locationId)
        );
        
        if (validLocationIds.length > 0) {
          result[requirementId] = validLocationIds;
        }
      }
    });
  } else {
    // Legacy format: { "locationId-requirementId": true/false }
    // Convert to new format and filter problematic locations
    Object.entries(data).forEach(([key, isRequired]) => {
      if (isRequired !== true) return; // Skip false values
      
      const [locationId, requirementId] = key.split('-');
      
      if (!locationId || !requirementId) return;
      if (PROBLEMATIC_LOCATION_IDS.has(locationId)) return;
      
      if (!result[requirementId]) {
        result[requirementId] = [];
      }
      
      result[requirementId].push(locationId);
    });
  }
  
  return result;
}
/**
 * Further validates and cleans mapping data against actual database records
 */
export async function validateMappingDataAgainstDatabase(
  mappingData: Record<string, string[]>,
  prisma: any
): Promise<Record<string, string[]>> {
  try {
    // Get all valid location IDs from the database
    const validLocationIds = await getValidLocationIds(prisma);
    
    const validatedMappings: Record<string, string[]> = {};
    
    // Filter each requirement's locations against valid IDs
    for (const [requirementId, locationIds] of Object.entries(mappingData)) {
      const validatedLocationIds = locationIds.filter(id => validLocationIds.has(id));
      
      if (validatedLocationIds.length > 0) {
        validatedMappings[requirementId] = validatedLocationIds;
      }
    }
    
    return validatedMappings;
  } catch (error) {
    logger.error('Error validating mapping data:', error);
    return mappingData; // Return original on error to not block operation
  }
}