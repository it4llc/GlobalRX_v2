// src/app/api/portal/orders/requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic route
export const dynamic = 'force-dynamic';

interface ServiceLocationPair {
  serviceId: string;
  locationId: string;
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
    const serviceIds = [...new Set(items.map(item => item.serviceId))];
    const locationIds = [...new Set(items.map(item => item.locationId))];

    // Get all service-level requirements
    const serviceRequirements = await prisma.serviceRequirement.findMany({
      where: {
        serviceId: { in: serviceIds }
      },
      include: {
        requirement: true,
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
        requirement: true,
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
    const subjectFields: any[] = [];
    const searchFields: any[] = [];
    const documents: any[] = [];

    // Track processed requirement IDs to avoid duplicates
    const processedSubjectFields = new Set<string>();
    const processedSearchFields = new Set<string>();
    const processedDocuments = new Set<string>();

    // Helper function to extract field data
    const processRequirement = (
      requirement: any,
      serviceId: string,
      locationId?: string,
      isRequired: boolean = false
    ) => {
      if (requirement.disabled) return;

      if (requirement.type === 'field' && requirement.fieldData) {
        const fieldData = requirement.fieldData as any;
        const collectionTab = fieldData.collectionTab || 'subject';

        const field = {
          id: requirement.id,
          name: requirement.name,
          shortName: fieldData.shortName || requirement.name,
          dataType: fieldData.dataType || 'text',
          instructions: fieldData.instructions || '',
          retentionHandling: fieldData.retentionHandling || 'no_delete',
          options: fieldData.options || [],
          addressConfig: fieldData.addressConfig || null,
          required: isRequired,
          serviceId,
          locationId
        };

        if (collectionTab === 'subject') {
          // Subject-level fields are collected once, so deduplicate by field ID
          if (!processedSubjectFields.has(requirement.id)) {
            processedSubjectFields.add(requirement.id);
            subjectFields.push(field);
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
        const documentData = requirement.documentData as any;
        const scope = documentData.scope || 'per_case';

        const document = {
          id: requirement.id,
          name: requirement.name,
          instructions: documentData.instructions || '',
          scope,
          required: isRequired,
          serviceId,
          locationId
        };

        // Deduplicate documents based on scope
        const key = scope === 'per_case'
          ? requirement.id
          : `${requirement.id}_${serviceId}_${locationId}`;

        if (!processedDocuments.has(key)) {
          processedDocuments.add(key);
          documents.push(document);
        }
      }
    };

    // Process service-level requirements
    serviceRequirements.forEach(sr => {
      // Apply to all locations for this service
      items
        .filter(item => item.serviceId === sr.serviceId)
        .forEach(item => {
          processRequirement(sr.requirement, sr.serviceId, item.locationId, true);
        });
    });

    // Process location-specific mappings (these can override or add to service requirements)
    locationMappings.forEach(mapping => {
      processRequirement(
        mapping.requirement,
        mapping.serviceId,
        mapping.locationId,
        mapping.isRequired
      );
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

    return NextResponse.json({
      subjectFields,
      searchFields,
      documents,
      locations: locations.map(loc => {
        const subregionInfo = locationsWithSubregions.find(
          ls => ls.locationId === loc.id
        );
        return {
          ...loc,
          hasSubregions: subregionInfo?.hasSubregions || false
        };
      })
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requirements' },
      { status: 500 }
    );
  }
}