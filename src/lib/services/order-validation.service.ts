// src/lib/services/order-validation.service.ts
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

interface ValidationResult {
  isValid: boolean;
  missingRequirements: {
    subjectFields: Array<{ fieldName: string; serviceLocation: string }>;
    searchFields: Array<{ fieldName: string; serviceLocation: string }>;
    documents: Array<{ documentName: string; serviceLocation: string }>;
  };
}

interface ServiceItem {
  serviceId: string;
  locationId: string;
  itemId: string;
  serviceName?: string;
  locationName?: string;
}

/**
 * Service for validating order requirements
 * Checks that all required fields and documents are provided before submission
 *
 * Business rule: Failed validation causes orders to save as 'draft'
 */
export class OrderValidationService {
  /**
   * Validate that all required fields and documents are provided for an order
   * Returns validation result with missing requirements and whether order can be submitted
   */
  static async validateOrderRequirements(data: {
    serviceItems: ServiceItem[];
    subjectFieldValues?: Record<string, any>;
    searchFieldValues?: Record<string, Record<string, any>>;
    uploadedDocuments?: Record<string, any>;
  }): Promise<ValidationResult> {
    const missingRequirements = {
      subjectFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
      searchFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
      documents: [] as Array<{ documentName: string; serviceLocation: string }>,
    };

    // Extract unique service and location IDs
    const serviceIds = [...new Set(data.serviceItems.map((item) => item.serviceId))];
    const locationIds = [...new Set(data.serviceItems.map((item) => item.locationId))];

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

    if (!isValid) {
      logger.info('Order validation failed', {
        serviceItemsCount: data.serviceItems.length,
        missingSubjectFields: missingRequirements.subjectFields.length,
        missingSearchFields: missingRequirements.searchFields.length,
        missingDocuments: missingRequirements.documents.length
      });
    }

    return {
      isValid,
      missingRequirements
    };
  }

  /**
   * Check if an order can transition from draft to submitted
   * This is a convenience method that wraps validateOrderRequirements
   */
  static async canSubmitOrder(orderId: string): Promise<{
    canSubmit: boolean;
    validationResult: ValidationResult;
  }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            data: true,
            documents: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.statusCode !== 'draft') {
      return {
        canSubmit: false,
        validationResult: {
          isValid: false,
          missingRequirements: {
            subjectFields: [],
            searchFields: [],
            documents: []
          }
        }
      };
    }

    // Transform order data to validation format
    const serviceItems = order.items.map(item => ({
      serviceId: item.serviceId,
      locationId: item.locationId,
      itemId: item.id
    }));

    // Extract field values from order
    const subjectFieldValues = order.subject as Record<string, any>;
    const searchFieldValues: Record<string, Record<string, any>> = {};

    order.items.forEach(item => {
      searchFieldValues[item.id] = {};
      item.data.forEach(data => {
        searchFieldValues[item.id][data.fieldName] = data.fieldValue;
      });
    });

    // Extract uploaded documents
    const uploadedDocuments: Record<string, any> = {};
    order.items.forEach(item => {
      item.documents.forEach(doc => {
        uploadedDocuments[doc.requirementId] = doc.fileUrl;
      });
    });

    const validationResult = await this.validateOrderRequirements({
      serviceItems,
      subjectFieldValues,
      searchFieldValues,
      uploadedDocuments
    });

    return {
      canSubmit: validationResult.isValid,
      validationResult
    };
  }
}