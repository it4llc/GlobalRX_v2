// src/lib/services/order.service.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

export class OrderService {
  /**
   * Create or find an AddressEntry record for the given address data
   * This ensures we store addresses properly as references, not embedded data
   */
  private static async createOrFindAddressEntry(addressData: any, userId: string): Promise<string | null> {
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
      // Try to find existing address entry with same details
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
   * Generate a consistent 3-character customer code based on customer ID
   * This ensures the same customer always gets the same code
   */
  private static generateCustomerCode(customerId: string): string {
    // Use the first 8 chars of the customer UUID to generate a consistent hash
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const hash = customerId.replace(/-/g, '').substring(0, 8);

    let code = '';
    for (let i = 0; i < 3; i++) {
      // Convert hex to index in our character set
      const hexPair = hash.substring(i * 2, i * 2 + 2);
      const index = parseInt(hexPair, 16) % chars.length;
      code += chars.charAt(index);
    }
    return code;
  }

  /**
   * Generate a unique order number in format: YYYYMMDD-ABC-0001
   * Where ABC is a consistent 3-char code per customer and 0001 increments per customer per day
   */
  static async generateOrderNumber(customerId: string, maxRetries = 5): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Generate consistent customer code based on customer ID
    const customerCode = this.generateCustomerCode(customerId);

    // Get start and end of current day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Get the highest sequence number for this customer today
      const lastOrder = await prisma.order.findFirst({
        where: {
          customerId: customerId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          orderNumber: true
        }
      });

      let nextSequence = 1;
      if (lastOrder && lastOrder.orderNumber) {
        // Extract sequence number from the order number
        const parts = lastOrder.orderNumber.split('-');
        if (parts.length >= 3) {
          const lastSequence = parseInt(parts[2], 10);
          if (!isNaN(lastSequence)) {
            nextSequence = lastSequence + 1;
          }
        }
      }

      // Create sequence number (padded to 4 digits)
      const sequence = String(nextSequence).padStart(4, '0');
      const orderNumber = `${dateStr}-${customerCode}-${sequence}`;

      // Check if this order number already exists (race condition protection)
      const existing = await prisma.order.findUnique({
        where: { orderNumber }
      });

      if (!existing) {
        return orderNumber;
      }

      // If we reach here, there was a collision, try again with a small delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }

    // Fallback: add timestamp if all retries failed
    const timestamp = Date.now().toString().slice(-6);
    const sequence = String(1).padStart(4, '0');
    return `${dateStr}-${customerCode}-${sequence}-${timestamp}`;
  }

  /**
   * Create a new order
   */
  static async createOrder(data: {
    customerId: string;
    userId: string;
    subject: any;
    notes?: string;
  }) {
    const orderNumber = await this.generateOrderNumber(data.customerId);

    // Normalize the subject data to ensure consistency
    const normalizedSubject = await this.normalizeSubjectData(data.subject, undefined, data.userId);

    return prisma.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        userId: data.userId,
        statusCode: 'draft',
        subject: normalizedSubject,
        notes: data.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Resolve field values that might contain IDs to their actual displayable values
   * This method ensures we store human-readable values instead of UUIDs
   */
  private static async resolveFieldValues(fieldValues: Record<string, any>): Promise<Record<string, any>> {
    const resolved: Record<string, any> = {};
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
      if (!fieldValue) {
        resolved[fieldName] = fieldValue;
        continue;
      }

      // Handle complex address objects (from AddressBlockInput)
      if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) &&
          (fieldName.toLowerCase().includes('address') || fieldName.toLowerCase().includes('residence'))) {

        // Check if this is an address object with state/county IDs
        const addressObj = fieldValue as any;
        const resolvedAddress: any = { ...addressObj };

        // Resolve state ID if present
        if (addressObj.state && uuidPattern.test(addressObj.state)) {
          try {
            const state = await prisma.country.findUnique({
              where: { id: addressObj.state },
              select: { name: true, code2: true, subregion1: true }
            });
            if (state) {
              resolvedAddress.state = state.subregion1 || state.name;
              resolvedAddress.stateCode = state.code2;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve state ID in address object', {
              stateId: addressObj.state,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Resolve county ID if present
        if (addressObj.county && uuidPattern.test(addressObj.county)) {
          try {
            const county = await prisma.country.findUnique({
              where: { id: addressObj.county },
              select: { name: true, subregion2: true }
            });
            if (county) {
              resolvedAddress.county = county.subregion2 || county.name;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve county ID in address object', {
              countyId: addressObj.county,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Format as a readable string if all parts are resolved
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

        resolved[fieldName] = addressParts.length > 0 ? addressParts.join(', ') : fieldValue;
        continue;
      }

      // Handle string fields that might be UUIDs
      if (typeof fieldValue === 'string' && uuidPattern.test(fieldValue)) {

        // Try to resolve as AddressEntry ID
        if (fieldName.toLowerCase().includes('address') || fieldName.toLowerCase().includes('residence')) {
          try {
            const addressEntry = await prisma.addressEntry.findUnique({
              where: { id: fieldValue },
              include: {
                state: { select: { name: true, code2: true } },
                county: { select: { name: true } },
                country: { select: { name: true, code2: true } }
              }
            });

            if (addressEntry) {
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

              resolved[fieldName] = addressParts.join(', ');
              continue;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve address ID', {
              addressId: fieldValue,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
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
          try {
            const state = await prisma.country.findUnique({
              where: { id: fieldValue },
              select: {
                name: true,
                code2: true,
                subregion1: true
              }
            });

            if (state) {
              const displayName = state.subregion1 || state.name;
              resolved[fieldName] = state.code2 ?
                `${displayName} (${state.code2})` :
                displayName;
              continue;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve state ID', {
              stateId: fieldValue,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Try to resolve as county ID
        if (fieldName.toLowerCase().includes('county')) {
          try {
            const county = await prisma.country.findUnique({
              where: { id: fieldValue },
              select: {
                name: true,
                subregion2: true
              }
            });

            if (county) {
              resolved[fieldName] = county.subregion2 || county.name;
              continue;
            }
          } catch (error: unknown) {
            logger.warn('Failed to resolve county ID', {
              countyId: fieldValue,
              fieldName,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      // If not resolved as an ID, use the original value
      resolved[fieldName] = fieldValue;
    }

    return resolved;
  }

  /**
   * Normalize and merge subject data, ensuring consistent field naming and resolved values
   */
  private static async normalizeSubjectData(
    baseSubject: any,
    subjectFieldValues?: Record<string, any>,
    userId?: string
  ): Promise<Record<string, any>> {
    // First, resolve any IDs in subjectFieldValues to actual values
    const resolvedFieldValues = subjectFieldValues
      ? await this.resolveFieldValues(subjectFieldValues)
      : {};

    // Define field mapping for consistent naming
    const fieldMapping = {
      // Name fields
      'First Name': 'firstName',
      'first_name': 'firstName',
      'Last Name': 'lastName',
      'Surname/Last Name': 'lastName',
      'surname': 'lastName',
      'last_name': 'lastName',
      'Middle Name': 'middleName',
      'middle_name': 'middleName',

      // Contact fields
      'Email Address': 'email',
      'Phone Number': 'phone',
      'phoneNumber': 'phone',

      // Address fields
      'Street Address': 'address',
      'Residence Address': 'address',
      'residenceAddress': 'address',

      // Personal info
      'Date of Birth': 'dateOfBirth',
      'DOB': 'dateOfBirth',
      'dob': 'dateOfBirth',
    };

    // Start with base subject data
    const normalized: Record<string, any> = { ...baseSubject };

    // Process resolved field values and normalize field names
    for (const [originalKey, value] of Object.entries(resolvedFieldValues)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Get the normalized field name
      const normalizedKey = fieldMapping[originalKey] || originalKey;

      // Only store if we don't already have this field or if the new value is more complete
      if (!normalized[normalizedKey] || (typeof value === 'string' && value.trim().length > 0)) {
        normalized[normalizedKey] = typeof value === 'string' ? value.trim() : value;
      }
    }

    // Remove any empty or null values
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === null || normalized[key] === undefined || normalized[key] === '') {
        delete normalized[key];
      }
    });

    return normalized;
  }

  /**
   * Validate that all required fields and documents are provided for an order
   * Returns validation result with missing requirements and whether order can be submitted
   */
  static async validateOrderRequirements(data: {
    serviceItems: Array<{
      serviceId: string;
      locationId: string;
      itemId: string;
    }>;
    subjectFieldValues?: Record<string, any>;
    searchFieldValues?: Record<string, Record<string, any>>;
    uploadedDocuments?: Record<string, any>;
  }): Promise<{
    isValid: boolean;
    missingRequirements: {
      subjectFields: Array<{ fieldName: string; serviceLocation: string }>;
      searchFields: Array<{ fieldName: string; serviceLocation: string }>;
      documents: Array<{ documentName: string; serviceLocation: string }>;
    };
  }> {
    const missingRequirements = {
      subjectFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
      searchFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
      documents: [] as Array<{ documentName: string; serviceLocation: string }>,
    };

    // Extract unique service and location IDs
    const serviceIds = [...new Set(data.serviceItems.map((item: any) => item.serviceId))];
    const locationIds = [...new Set(data.serviceItems.map((item: any) => item.locationId))];

    // Get all service-level requirements
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: {
        serviceId: { in: serviceIds }
      },
      include: {
        requirement: true,
        service: {
          select: { name: true }
        }
      }
    });

    // Get all location-specific mappings (both required and optional)
    const locationMappings = await prisma.dSXMapping.findMany({
      where: {
        AND: [
          { serviceId: { in: serviceIds } },
          { locationId: { in: locationIds } }
        ]
      },
      include: {
        requirement: true,
        service: {
          select: { name: true }
        },
        country: {
          select: { name: true }
        }
      }
    });

    // Track which requirements we've already checked to avoid duplicates
    const checkedSubjectFields = new Set<string>();
    const checkedSearchFields = new Set<string>();
    const checkedDocuments = new Set<string>();

    // Create a map of what's required from DSX mappings
    const requiredMap = new Map<string, boolean>();
    locationMappings.forEach(mapping => {
      const key = `${mapping.serviceId}_${mapping.locationId}_${mapping.requirementId}`;
      requiredMap.set(key, mapping.isRequired);
    });

    // Check service-level requirements (only if marked as required in DSX mappings)
    for (const sr of serviceRequirements) {
      if (sr.requirement.disabled) continue;

      // Check for each service item that uses this service
      for (const item of data.serviceItems.filter(i => i.serviceId === sr.serviceId)) {
        // Only validate if this requirement is marked as required in DSX mappings
        const requirementKey = `${sr.serviceId}_${item.locationId}_${sr.requirementId}`;
        if (!requiredMap.get(requirementKey)) continue;

        const location = await prisma.country.findUnique({
          where: { id: item.locationId },
          select: { name: true }
        });
        const serviceLocation = `${sr.service.name} - ${location?.name || 'Unknown'}`;

        if (sr.requirement.type === 'field' && sr.requirement.fieldData) {
          const fieldData = sr.requirement.fieldData as any;
          const collectionTab = fieldData.collectionTab || 'subject';

          if (collectionTab === 'subject') {
            // Check subject-level field only once
            if (!checkedSubjectFields.has(sr.requirement.id)) {
              checkedSubjectFields.add(sr.requirement.id);
              const value = data.subjectFieldValues?.[sr.requirement.name];
              if (!value || (typeof value === 'string' && value.trim() === '')) {
                missingRequirements.subjectFields.push({
                  fieldName: sr.requirement.name,
                  serviceLocation
                });
              }
            }
          } else {
            // Check search-level field for this specific item
            const key = `${sr.requirement.id}_${item.itemId}`;
            if (!checkedSearchFields.has(key)) {
              checkedSearchFields.add(key);
              const value = data.searchFieldValues?.[item.itemId]?.[sr.requirement.name];
              if (!value || (typeof value === 'string' && value.trim() === '')) {
                missingRequirements.searchFields.push({
                  fieldName: sr.requirement.name,
                  serviceLocation
                });
              }
            }
          }
        } else if (sr.requirement.type === 'document' && sr.requirement.documentData) {
          const documentData = sr.requirement.documentData as any;
          const scope = documentData.scope || 'per_case';

          const key = scope === 'per_case'
            ? sr.requirement.id
            : `${sr.requirement.id}_${item.itemId}`;

          if (!checkedDocuments.has(key)) {
            checkedDocuments.add(key);
            const hasDocument = data.uploadedDocuments?.[sr.requirement.id];
            if (!hasDocument) {
              missingRequirements.documents.push({
                documentName: sr.requirement.name,
                serviceLocation
              });
            }
          }
        }
      }
    }

    // Check location-specific requirements that are marked as required
    for (const mapping of locationMappings) {
      if (mapping.requirement.disabled || !mapping.isRequired) continue;

      // Find the matching service item
      const matchingItem = data.serviceItems.find(
        item => item.serviceId === mapping.serviceId && item.locationId === mapping.locationId
      );
      if (!matchingItem) continue;

      const serviceLocation = `${mapping.service.name} - ${mapping.country.name}`;

      if (mapping.requirement.type === 'field' && mapping.requirement.fieldData) {
        const fieldData = mapping.requirement.fieldData as any;
        const collectionTab = fieldData.collectionTab || 'subject';

        if (collectionTab === 'subject') {
          // Check subject-level field only once
          if (!checkedSubjectFields.has(mapping.requirement.id)) {
            checkedSubjectFields.add(mapping.requirement.id);
            const value = data.subjectFieldValues?.[mapping.requirement.name];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
              missingRequirements.subjectFields.push({
                fieldName: mapping.requirement.name,
                serviceLocation
              });
            }
          }
        } else {
          // Check search-level field for this specific item
          const key = `${mapping.requirement.id}_${matchingItem.itemId}`;
          if (!checkedSearchFields.has(key)) {
            checkedSearchFields.add(key);
            const value = data.searchFieldValues?.[matchingItem.itemId]?.[mapping.requirement.name];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
              missingRequirements.searchFields.push({
                fieldName: mapping.requirement.name,
                serviceLocation
              });
            }
          }
        }
      } else if (mapping.requirement.type === 'document' && mapping.requirement.documentData) {
        const documentData = mapping.requirement.documentData as any;
        const scope = documentData.scope || 'per_case';

        const key = scope === 'per_case'
          ? mapping.requirement.id
          : `${mapping.requirement.id}_${matchingItem.itemId}`;

        if (!checkedDocuments.has(key)) {
          checkedDocuments.add(key);
          const hasDocument = data.uploadedDocuments?.[mapping.requirement.id];
          if (!hasDocument) {
            missingRequirements.documents.push({
              documentName: mapping.requirement.name,
              serviceLocation
            });
          }
        }
      }
    }

    const isValid =
      missingRequirements.subjectFields.length === 0 &&
      missingRequirements.searchFields.length === 0 &&
      missingRequirements.documents.length === 0;

    return {
      isValid,
      missingRequirements
    };
  }

  /**
   * Create a complete order with service items and field data
   */
  static async createCompleteOrder(data: {
    customerId: string;
    userId: string;
    serviceItems: Array<{
      serviceId: string;
      serviceName: string;
      locationId: string;
      locationName: string;
      itemId: string;
    }>;
    subject: any;
    subjectFieldValues?: Record<string, any>;
    searchFieldValues?: Record<string, Record<string, any>>;
    uploadedDocuments?: Record<string, any>;
    notes?: string;
    status?: 'draft' | 'submitted';
  }) {
    const orderNumber = await this.generateOrderNumber(data.customerId);

    // Normalize and resolve the subject data properly
    const normalizedSubject = await this.normalizeSubjectData(
      data.subject,
      data.subjectFieldValues,
      data.userId
    );

    // Validate requirements if attempting to submit
    let finalStatus = data.status;
    let validationResult = null;

    if (data.status === 'submitted' || !data.status) {
      // Validate all requirements are met
      validationResult = await this.validateOrderRequirements({
        serviceItems: data.serviceItems,
        subjectFieldValues: data.subjectFieldValues,
        searchFieldValues: data.searchFieldValues,
        uploadedDocuments: data.uploadedDocuments,
      });

      // If validation fails and trying to submit, force to draft
      if (!validationResult.isValid) {
        finalStatus = 'draft';
        logger.warn('Order validation failed, saving as draft', {
          customerId: data.customerId,
          serviceItemsCount: data.serviceItems.length,
          missingRequirements: validationResult.missingRequirements
        });
      } else {
        finalStatus = 'submitted';
      }
    }

    // Create the main order with transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Create the main order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          statusCode: finalStatus || 'draft', // Default to draft if no status
          subject: normalizedSubject,
          notes: data.notes,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Create order items for each service+location combination
      for (const serviceItem of data.serviceItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: serviceItem.serviceId,
            locationId: serviceItem.locationId,
            status: 'pending',
          },
        });

        // Create order data entries for search fields specific to this service item
        const searchFields = data.searchFieldValues?.[serviceItem.itemId];
        if (searchFields) {
          // Resolve IDs in search fields to human-readable values
          const resolvedSearchFields = await this.resolveFieldValues(searchFields);

          for (const [fieldName, fieldValue] of Object.entries(resolvedSearchFields)) {
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
              // Store the resolved value, not the raw ID
              await tx.orderData.create({
                data: {
                  orderItemId: orderItem.id,
                  fieldName,
                  fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
                  fieldType: 'search', // TODO: Get actual field type from requirements
                },
              });
            }
          }
        }

        // TODO: Handle document uploads for this order item
        // const documents = data.uploadedDocuments?.[serviceItem.itemId];
        // if (documents) { ... }
      }

      // Return order with validation result attached
      return {
        ...order,
        validationResult: validationResult
      };
    });
  }

  /**
   * Get orders for a customer
   */
  static async getCustomerOrders(customerId: string, filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.OrderWhereInput = {
      customerId,
    };

    if (filters?.status) {
      where.statusCode = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Get a single order by ID
   */
  static async getOrderById(orderId: string, customerId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
      },
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            service: true,
            location: true,
            data: true,
            documents: true,
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Update an order (only if in draft status)
   */
  static async updateOrder(
    orderId: string,
    customerId: string,
    data: Partial<{
      subject: any;
      notes: string;
    }>
  ) {
    // First check if order exists and is in draft status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be edited');
    }

    return prisma.order.update({
      where: { id: orderId },
      data,
    });
  }

  /**
   * Submit an order (change status from draft to submitted)
   */
  static async submitOrder(orderId: string, customerId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or already submitted');
    }

    // Use a transaction to update order and create status history
    return prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          statusCode: 'submitted',
          submittedAt: new Date(),
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: userId,
          reason: 'Order submitted by customer',
        },
      }),
    ]);
  }

  /**
   * Delete a draft order
   */
  static async deleteOrder(orderId: string, customerId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be deleted');
    }

    // Delete will cascade to items, data, documents, and history
    return prisma.order.delete({
      where: { id: orderId },
    });
  }

  /**
   * Get order statistics for a customer
   */
  static async getCustomerOrderStats(customerId: string) {
    const [total, draft, submitted, processing, completed, cancelled] = await Promise.all([
      prisma.order.count({ where: { customerId } }),
      prisma.order.count({ where: { customerId, statusCode: 'draft' } }),
      prisma.order.count({ where: { customerId, statusCode: 'submitted' } }),
      prisma.order.count({ where: { customerId, statusCode: 'processing' } }),
      prisma.order.count({ where: { customerId, statusCode: 'completed' } }),
      prisma.order.count({ where: { customerId, statusCode: 'cancelled' } }),
    ]);

    return {
      total,
      draft,
      submitted,
      processing,
      completed,
      cancelled,
      pending: submitted + processing, // Combined for dashboard
    };
  }

  /**
   * Add an item to an order
   */
  static async addOrderItem(
    orderId: string,
    customerId: string,
    item: {
      serviceId: string;
      locationId: string;
      price?: number;
    }
  ) {
    // Verify order exists and is editable
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be edited');
    }

    return prisma.orderItem.create({
      data: {
        orderId,
        serviceId: item.serviceId,
        locationId: item.locationId,
        status: 'pending',
        price: item.price,
      },
      include: {
        service: true,
        location: true,
      },
    });
  }
}