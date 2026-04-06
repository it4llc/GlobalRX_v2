// /GlobalRX_v2/src/app/api/portal/orders/requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

// Force dynamic route
export const dynamic = 'force-dynamic';

interface ServiceLocationPair {
  serviceId: string;
  locationId: string;
}

interface FieldData {
  dataType: string;
  collectionTab?: string;
  shortName?: string;
  instructions?: string;
  retentionHandling?: string;
  options?: string[];
  addressConfig?: {
    includeCounty?: boolean;
    includeCountry?: boolean;
    requiredFields?: string[];
  } | null;
}

interface DocumentData {
  instructions?: string;
  scope?: string;
  [key: string]: unknown; // Allow other properties for PDF template info
}

interface Requirement {
  id: string;
  name: string;
  type: string;
  fieldKey: string;
  disabled?: boolean;
  fieldData?: FieldData;
  documentData?: DocumentData;
}

interface ProcessedField {
  id: string;
  name: string;
  fieldKey: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
  options: string[];
  addressConfig: FieldData['addressConfig'];
  required: boolean;
  serviceId: string;
  locationId?: string;
  displayOrder: number;
}

interface ProcessedDocument {
  id: string;
  name: string;
  instructions: string;
  scope: string;
  required: boolean;
  serviceId: string;
  locationId?: string;
  documentData: string;
}

interface LocationWithSubregions {
  id: string;
  name: string;
  code2?: string;
  subregion1?: string | null;
  subregion2?: string | null;
  subregion3?: string | null;
}

/**
 * POST /api/portal/orders/requirements
 * Fetch all requirements for given service+location combinations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const { items } = body as { items: ServiceLocationPair[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: items array required' },
        { status: 400 }
      );
    }

    // Extract unique service and location IDs
    const serviceIds = [...new Set(items.map((item) => item.serviceId))];
    const locationIds = [...new Set(items.map((item) => item.locationId))];

    // Get all service-level requirements, sorted by displayOrder
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: {
        serviceId: { in: serviceIds }
      },
      orderBy: {
        displayOrder: 'asc'
      },
      include: {
        requirement: {
          select: {
            id: true,
            name: true,
            type: true,
            fieldKey: true,
            disabled: true,
            fieldData: true,
            documentData: true
          }
        },
        service: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Get all location-specific mappings
    const locationMappings = await prisma.dSXMapping.findMany({
      where: {
        AND: [
          { serviceId: { in: serviceIds } },
          { locationId: { in: locationIds } }
        ]
      },
      include: {
        requirement: {
          select: {
            id: true,
            name: true,
            type: true,
            fieldKey: true,
            disabled: true,
            fieldData: true,
            documentData: true
          }
        },
        service: {
          select: {
            id: true,
            name: true
          }
        },
        country: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Process requirements and group by collection tab
    const subjectFields: ProcessedField[] = [];
    const searchFields: ProcessedField[] = [];
    const documents: ProcessedDocument[] = [];

    // Track processed requirement IDs to avoid duplicates
    const processedSubjectFields = new Set<string>();
    const processedSearchFields = new Set<string>();
    const processedDocuments = new Set<string>();

    // Helper function to extract field data
    const processRequirement = (
      requirement: Requirement,
      serviceId: string,
      locationId?: string,
      isRequired: boolean = false,
      displayOrder: number = 999
    ) => {
      if (requirement.disabled) return;

      if (requirement.type === 'field' && requirement.fieldData) {
        const fieldData = requirement.fieldData;
        logger.debug('Requirements API - Field details', {
          fieldName: requirement.name,
          dataType: fieldData.dataType,
          hasAddressConfig: !!fieldData.addressConfig
        });
        const collectionTab = fieldData.collectionTab || 'subject';

        const field: ProcessedField = {
          id: requirement.id,
          name: requirement.name,
          fieldKey: requirement.fieldKey,
          shortName: fieldData.shortName || requirement.name,
          dataType: fieldData.dataType || 'text',
          instructions: fieldData.instructions || '',
          retentionHandling: fieldData.retentionHandling || 'no_delete',
          options: fieldData.options || [],
          addressConfig: fieldData.addressConfig || null,
          required: isRequired,
          serviceId,
          locationId,
          displayOrder
        };

        if (collectionTab === 'subject') {
          // Subject-level fields are collected once, so deduplicate by field ID
          if (!processedSubjectFields.has(requirement.id)) {
            processedSubjectFields.add(requirement.id);
            subjectFields.push(field);
          } else {
            // BUG FIX (March 2026): Fixed deduplication logic to use OR logic instead of "first-wins"
            //
            // PREVIOUS BUG: When multiple services had the same subject-level field (e.g., firstName, lastName),
            // the deduplication used "first-wins" logic - only the first service's requirement status was kept.
            // This caused red asterisks to fail to appear if the first service had required=false but a later
            // service had required=true.
            //
            // ROOT CAUSE: The original logic didn't update existing fields, so if Service A marked firstName
            // as optional and Service B marked it as required, the UI would show it as optional (no asterisk).
            //
            // SOLUTION: Use OR logic - a field is required if ANY service requires it.
            // This ensures the most restrictive requirement (required=true) takes precedence.
            const existingField = subjectFields.find(f => f.id === requirement.id);
            if (existingField && isRequired) {
              existingField.required = true;
            }
          }
        } else {
          // Search-level fields are per service instance
          const key = `${requirement.id}_${serviceId}_${locationId}`;
          if (!processedSearchFields.has(key)) {
            processedSearchFields.add(key);
            searchFields.push(field);
          }
        }
      } else if (requirement.type === 'document' && requirement.documentData) {
        const documentData = requirement.documentData;
        const scope = documentData.scope || 'per_case';

        const document: ProcessedDocument = {
          id: requirement.id,
          name: requirement.name,
          instructions: documentData.instructions || '',
          scope,
          required: isRequired,
          serviceId,
          locationId: locationId || '',
          // Include the full documentData so frontend can access PDF template info
          documentData: JSON.stringify(documentData)
        };

        // Deduplicate documents based on scope
        const key = scope === 'per_case'
          ? requirement.id
          : `${requirement.id}_${serviceId}_${locationId}`;

        if (!processedDocuments.has(key)) {
          processedDocuments.add(key);
          documents.push(document);
        } else if (scope === 'per_case') {
          // BUG FIX (March 2026): Fixed document deduplication to use OR logic
          //
          // Same issue as subject fields - documents with 'per_case' scope are shared
          // across services, so if multiple services require the same document with
          // different requirement statuses, use OR logic (most restrictive wins).
          const existingDocument = documents.find(d => d.id === requirement.id);
          if (existingDocument && isRequired) {
            existingDocument.required = true;
          }
        }
      }
    };

    // Create maps to track requirements status and display order
    const requiredMap = new Map<string, boolean>();
    const displayOrderMap = new Map<string, number>();

    // Build the required map from DSX mappings
    locationMappings.forEach(mapping => {
      const key = `${mapping.serviceId}_${mapping.locationId}_${mapping.requirementId}`;
      requiredMap.set(key, mapping.isRequired);
    });

    // Build the display order map from ServiceRequirements (service-level ordering)
    serviceRequirements.forEach(sr => {
      // Display order is per service, not per location
      displayOrderMap.set(`${sr.serviceId}_${sr.requirementId}`, sr.displayOrder);
    });

    // Process service-level requirements
    serviceRequirements.forEach(sr => {
      // Apply to all locations for this service
      items
        .filter(item => item.serviceId === sr.serviceId)
        .forEach(item => {
          // Check if this specific requirement is marked as required in DSXMapping
          const mappingKey = `${sr.serviceId}_${item.locationId}_${sr.requirementId}`;
          const isRequired = requiredMap.get(mappingKey) || false;
          // Display order is per service, not per location
          const displayOrder = sr.displayOrder;

          processRequirement(sr.requirement, sr.serviceId, item.locationId, isRequired, displayOrder);
        });
    });

    // Process location-specific mappings that might not be in service requirements
    locationMappings.forEach(mapping => {
      // Check if this requirement was already processed as a service requirement
      const alreadyProcessed = serviceRequirements.some(sr =>
        sr.requirementId === mapping.requirementId &&
        sr.serviceId === mapping.serviceId
      );

      // Only process if not already handled as a service requirement
      if (!alreadyProcessed) {
        // Get display order from service requirements if available, otherwise default
        const displayOrderKey = `${mapping.serviceId}_${mapping.requirementId}`;
        const displayOrder = displayOrderMap.get(displayOrderKey) || 999;

        processRequirement(
          mapping.requirement,
          mapping.serviceId,
          mapping.locationId,
          mapping.isRequired,
          displayOrder
        );
      }
    });

    // Get locations for subregion selection
    const locations = await prisma.country.findMany({
      where: {
        id: { in: locationIds }
      },
      select: {
        id: true,
        name: true,
        code2: true,
        subregion1: true,
        subregion2: true,
        subregion3: true
      }
    });

    // Check which locations have subregions
    const locationsWithSubregions = await Promise.all(
      locationIds.map(async (locationId) => {
        const hasSubregions = await prisma.country.count({
          where: { parentId: locationId }
        }) > 0;

        return {
          locationId,
          hasSubregions
        };
      })
    );

    // Sort fields by displayOrder before returning
    const sortedSubjectFields = subjectFields.sort((a, b) => a.displayOrder - b.displayOrder);
    const sortedSearchFields = searchFields.sort((a, b) => a.displayOrder - b.displayOrder);

    return NextResponse.json({
      subjectFields: sortedSubjectFields,
      searchFields: sortedSearchFields,
      documents,
      locations: locations.map((loc) => {
        const subregionInfo = locationsWithSubregions.find(
          ls => ls.locationId === loc.id
        );
        return {
          ...loc,
          hasSubregions: subregionInfo?.hasSubregions || false
        };
      })
    });
  } catch (error: unknown) {
    // Safely handle error logging without exposing sensitive data
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching requirements', {
      operation: 'fetch_requirements',
      errorMessage,
      // Omit stack trace to avoid potential sensitive data exposure
    });
    return NextResponse.json(
      { error: 'Failed to fetch requirements' },
      { status: 500 }
    );
  }
}