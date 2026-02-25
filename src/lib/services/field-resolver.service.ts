// src/lib/services/field-resolver.service.ts
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Service for resolving field values from IDs to human-readable formats
 * This is used across the application to convert UUIDs to display values
 *
 * Formats:
 * - State: "State Name (XX)"
 * - Address: "Street, City, County, State (XX), ZIP"
 * - Extensible for future field types
 */
export class FieldResolverService {
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Check if a string is a valid UUID
   */
  private static isUUID(value: string): boolean {
    return this.UUID_PATTERN.test(value);
  }

  /**
   * Resolve a state/province ID to "State Name (XX)" format
   */
  static async resolveStateField(stateId: string): Promise<string | null> {
    try {
      const state = await prisma.country.findUnique({
        where: { id: stateId },
        select: {
          name: true,
          code2: true,
          subregion1: true
        }
      });

      if (!state) {
        return null;
      }

      const displayName = state.subregion1 || state.name;
      return state.code2 ? `${displayName} (${state.code2})` : displayName;
    } catch (error: unknown) {
      logger.warn('Failed to resolve state ID', {
        stateId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Resolve a county ID to its name
   */
  static async resolveCountyField(countyId: string): Promise<string | null> {
    try {
      const county = await prisma.country.findUnique({
        where: { id: countyId },
        select: {
          name: true,
          subregion2: true
        }
      });

      if (!county) {
        return null;
      }

      return county.subregion2 || county.name;
    } catch (error: unknown) {
      logger.warn('Failed to resolve county ID', {
        countyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Resolve an address entry ID to formatted address string
   */
  static async resolveAddressField(addressId: string): Promise<string | null> {
    try {
      const addressEntry = await prisma.addressEntry.findUnique({
        where: { id: addressId },
        include: {
          state: { select: { name: true, code2: true } },
          county: { select: { name: true } },
          country: { select: { name: true, code2: true } }
        }
      });

      if (!addressEntry) {
        return null;
      }

      const addressParts = [];
      if (addressEntry.street1) addressParts.push(addressEntry.street1);
      if (addressEntry.street2) addressParts.push(addressEntry.street2);
      if (addressEntry.city) addressParts.push(addressEntry.city);
      if (addressEntry.county?.name) addressParts.push(addressEntry.county.name);
      if (addressEntry.state?.name) {
        addressParts.push(addressEntry.state.code2 ?
          `${addressEntry.state.name} (${addressEntry.state.code2})` :
          addressEntry.state.name);
      }
      if (addressEntry.postalCode) addressParts.push(addressEntry.postalCode);
      if (addressEntry.country?.name && addressEntry.country.name !== 'United States') {
        addressParts.push(addressEntry.country.name);
      }

      return addressParts.join(', ');
    } catch (error: unknown) {
      logger.warn('Failed to resolve address ID', {
        addressId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Resolve an address object with state/county IDs to readable format
   */
  static async resolveAddressObject(addressObj: any): Promise<string> {
    const resolvedAddress: any = { ...addressObj };

    // Resolve state ID if present
    if (addressObj.state && this.isUUID(addressObj.state)) {
      const stateResolved = await this.resolveStateField(addressObj.state);
      if (stateResolved) {
        const match = stateResolved.match(/^(.+?) \((.+?)\)$/);
        if (match) {
          resolvedAddress.state = match[1];
          resolvedAddress.stateCode = match[2];
        } else {
          resolvedAddress.state = stateResolved;
        }
      }
    }

    // Resolve county ID if present
    if (addressObj.county && this.isUUID(addressObj.county)) {
      const countyResolved = await this.resolveCountyField(addressObj.county);
      if (countyResolved) {
        resolvedAddress.county = countyResolved;
      }
    }

    // Format as a readable string
    const addressParts = [];
    if (resolvedAddress.street1) addressParts.push(resolvedAddress.street1);
    if (resolvedAddress.street2) addressParts.push(resolvedAddress.street2);
    if (resolvedAddress.city) addressParts.push(resolvedAddress.city);
    if (resolvedAddress.county) addressParts.push(resolvedAddress.county);
    if (resolvedAddress.state) {
      addressParts.push(resolvedAddress.stateCode ?
        `${resolvedAddress.state} (${resolvedAddress.stateCode})` :
        resolvedAddress.state);
    }
    if (resolvedAddress.postalCode) addressParts.push(resolvedAddress.postalCode);

    return addressParts.length > 0 ? addressParts.join(', ') : JSON.stringify(addressObj);
  }

  /**
   * Resolve field values that might contain IDs to their actual displayable values
   * This method ensures we store human-readable values instead of UUIDs
   *
   * This is designed to be extensible - add new field type handlers as needed
   */
  static async resolveFieldValues(fieldValues: Record<string, any>): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};

    for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
      if (!fieldValue) {
        resolved[fieldName] = fieldValue;
        continue;
      }

      // Handle complex address objects (from AddressBlockInput)
      if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) &&
          (fieldName.toLowerCase().includes('address') || fieldName.toLowerCase().includes('residence'))) {
        resolved[fieldName] = await this.resolveAddressObject(fieldValue);
        continue;
      }

      // Handle string fields that might be UUIDs
      if (typeof fieldValue === 'string' && this.isUUID(fieldValue)) {

        // Try to resolve as AddressEntry ID
        if (fieldName.toLowerCase().includes('address') || fieldName.toLowerCase().includes('residence')) {
          const resolvedAddress = await this.resolveAddressField(fieldValue);
          if (resolvedAddress) {
            resolved[fieldName] = resolvedAddress;
            continue;
          }
        }

        // Try to resolve as location/country ID
        if (fieldName.toLowerCase().includes('location') ||
            fieldName.toLowerCase().includes('country') ||
            fieldName.toLowerCase().includes('region')) {
          try {
            const location = await prisma.country.findUnique({
              where: { id: fieldValue },
              select: {
                name: true,
                code2: true,
                subregion1: true,
                subregion2: true
              }
            });

            if (location) {
              // Use the most specific name available
              const displayName = location.subregion2 || location.subregion1 || location.name;
              resolved[fieldName] = location.code2 ?
                `${displayName} (${location.code2})` :
                displayName;
              continue;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve location ID', {
              locationId: fieldValue,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Try to resolve as state/province ID
        if (fieldName.toLowerCase().includes('state') || fieldName.toLowerCase().includes('province')) {
          const resolvedState = await this.resolveStateField(fieldValue);
          if (resolvedState) {
            resolved[fieldName] = resolvedState;
            continue;
          }
        }

        // Try to resolve as county ID
        if (fieldName.toLowerCase().includes('county')) {
          const resolvedCounty = await this.resolveCountyField(fieldValue);
          if (resolvedCounty) {
            resolved[fieldName] = resolvedCounty;
            continue;
          }
        }

        // EXTENSIBILITY: Add more field type handlers here as needed
        // For example:
        // if (fieldName.toLowerCase().includes('category')) {
        //   const resolved = await this.resolveCategoryField(fieldValue);
        //   ...
        // }
      }

      // If not resolved as an ID, use the original value
      resolved[fieldName] = fieldValue;
    }

    return resolved;
  }
}