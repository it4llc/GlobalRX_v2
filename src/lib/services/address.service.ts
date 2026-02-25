// src/lib/services/address.service.ts
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Service for managing address entries
 * Handles creating and finding address references to avoid data duplication
 */
export class AddressService {
  /**
   * Create or find an AddressEntry record for the given address data
   * This ensures we store addresses properly as references, not embedded data
   *
   * Business rule: Reuse existing address entries when exact match found
   */
  static async createOrFindAddressEntry(addressData: any, userId: string): Promise<string | null> {
    if (!addressData || typeof addressData !== 'object') {
      return null;
    }

    // Extract address components
    const {
      street1, street2, city,
      state, stateId, stateName,
      county, countyId, countyName,
      postalCode
    } = addressData;

    // If we don't have minimum required fields, don't create an entry
    if (!street1 && !city && !state && !postalCode) {
      return null;
    }

    try {
      // Try to find existing address entry with same details (exact match)
      const existingEntry = await prisma.addressEntry.findFirst({
        where: {
          street1: street1 || null,
          street2: street2 || null,
          city: city || null,
          stateId: stateId || null,
          countyId: countyId || null,
          postalCode: postalCode || null
        }
      });

      if (existingEntry) {
        logger.info('Reusing existing address entry', {
          addressId: existingEntry.id,
          userId
        });
        return existingEntry.id;
      }

      // Create new address entry
      const newEntry = await prisma.addressEntry.create({
        data: {
          street1: street1 || null,
          street2: street2 || null,
          city: city || null,
          stateId: stateId || null,
          countyId: countyId || null,
          postalCode: postalCode || null,
          countryId: null // We could extract this from the order context if needed
        }
      });

      logger.info('Created new address entry', {
        addressId: newEntry.id,
        userId
      });

      return newEntry.id;
    } catch (error: unknown) {
      logger.error('Failed to create AddressEntry', {
        addressData: {
          street1: addressData.street1,
          city: addressData.city,
          state: addressData.state
        },
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Format an address entry ID into a human-readable address string
   * Used when displaying addresses in the UI
   */
  static async formatAddressEntry(addressEntryId: string): Promise<string | null> {
    try {
      const addressEntry = await prisma.addressEntry.findUnique({
        where: { id: addressEntryId },
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
      logger.error('Failed to format address entry', {
        addressEntryId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}