// /GlobalRX_v2/src/app/api/portal/orders/requirements/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Type definitions for test data
interface ServiceLocationPair {
  serviceId: string;
  locationId: string;
}

interface RequestBody {
  items: ServiceLocationPair[];
}

interface MockFieldData {
  dataType: string;
  collectionTab: string;
  shortName: string;
  instructions: string;
  retentionHandling: string;
  options: string[];
  addressConfig: null | {
    includeCounty?: boolean;
    includeCountry?: boolean;
    requiredFields?: string[];
  };
}

interface MockRequirement {
  id: string;
  name: string;
  type: string;
  disabled: boolean;
  fieldData?: MockFieldData;
  documentData?: {
    instructions: string;
    scope: string;
  };
}

interface MockServiceRequirement {
  id: string;
  serviceId: string;
  requirementId: string;
  displayOrder: number;
  requirement: MockRequirement;
  service: {
    id: string;
    name: string;
  };
}

interface MockDSXMapping {
  id: string;
  serviceId: string;
  locationId: string;
  requirementId: string;
  isRequired: boolean;
  requirement: MockRequirement;
  service: {
    id: string;
    name: string;
  };
  country: {
    id: string;
    name: string;
  };
}

interface MockCountry {
  id: string;
  name: string;
  code2: string;
  subregion1: string | null;
  subregion2: string | null;
  subregion3: string | null;
}

interface ResponseField {
  id: string;
  name: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
  options: string[];
  addressConfig: MockFieldData['addressConfig'];
  required: boolean;
  serviceId: string;
  locationId?: string;
  displayOrder: number;
}

interface ResponseDocument {
  id: string;
  name: string;
  instructions: string;
  scope: string;
  required: boolean;
  serviceId: string;
  locationId?: string;
  documentData: string;
}

interface ResponseData {
  subjectFields: ResponseField[];
  searchFields: ResponseField[];
  documents: ResponseDocument[];
  locations: Array<MockCountry & { hasSubregions: boolean }>;
  error?: string;
}

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceRequirement: {
      findMany: vi.fn()
    },
    dSXMapping: {
      findMany: vi.fn()
    },
    country: {
      findMany: vi.fn(),
      count: vi.fn()
    }
  }
}));

describe('POST /api/portal/orders/requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create a mock request
  const createMockRequest = (body: RequestBody | Record<string, unknown>) => {
    return {
      json: async () => body
    } as NextRequest;
  };

  // Helper function to create a mock field requirement
  const createFieldRequirement = (
    id: string,
    name: string,
    shortName: string,
    collectionTab: 'subject' | 'search' = 'subject',
    disabled: boolean = false
  ): MockRequirement => ({
    id,
    name,
    type: 'field',
    disabled,
    fieldData: {
      dataType: 'text',
      collectionTab,
      shortName,
      instructions: '',
      retentionHandling: 'no_delete',
      options: [],
      addressConfig: null
    }
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = createMockRequest({
        items: [{ serviceId: 'service1', locationId: 'location1' }]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when user is not a customer', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user1',
          userType: 'internal',
          customerId: null
        }
      });

      const request = createMockRequest({
        items: [{ serviceId: 'service1', locationId: 'location1' }]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when customer user has no customerId', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: null
        }
      });

      const request = createMockRequest({
        items: [{ serviceId: 'service1', locationId: 'location1' }]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(404);
      expect(data.error).toBe('Customer not found');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Setup authenticated customer user for all input validation tests
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('should return 400 when items array is missing', async () => {
      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request: items array required');
    });

    it('should return 400 when items is not an array', async () => {
      const request = createMockRequest({
        items: 'not-an-array'
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request: items array required');
    });

    it('should return 400 when items array is empty', async () => {
      const request = createMockRequest({
        items: []
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request: items array required');
    });
  });

  // ====================================================================
  // REGRESSION TEST: proves bug fix for missing asterisks with multiple services
  // ====================================================================
  describe('REGRESSION TEST: Multiple services with same required subject fields - BUG FIX', () => {
    beforeEach(() => {
      // Setup authenticated customer user
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('CRITICAL REGRESSION TEST: should mark subject field as required when BOTH services require it', async () => {
      // ============================================================
      // THIS IS THE MAIN REGRESSION TEST THAT PROVES THE BUG EXISTS
      //
      // BUG DESCRIPTION:
      // When multiple services both require the same subject-level field (e.g., firstName),
      // the field should be marked as required=true in the response because ANY service
      // requiring it should make it required overall. However, the bug causes only the
      // first service's required flag to be used, ignoring subsequent services.
      //
      // EXPECTED: Field required=true (because both services require it)
      // ACTUAL (BUG): Field required=false or uses only first service's value
      //
      // This test will FAIL before the fix (proving bug exists)
      // This test will PASS after the fix (proving bug is fixed)
      // ============================================================

      // Setup: Two services, both requiring firstName and lastName
      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');
      const lastNameRequirement = createFieldRequirement('req2', 'Last Name', 'lastName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service1',
          requirementId: 'req2',
          displayOrder: 2,
          requirement: lastNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr3',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        },
        {
          id: 'sr4',
          serviceId: 'service2',
          requirementId: 'req2',
          displayOrder: 2,
          requirement: lastNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      // Both services mark these fields as required in DSXMapping
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // Service 1 requires firstName
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req2',
          isRequired: true, // Service 1 requires lastName
          requirement: lastNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping3',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // Service 2 ALSO requires firstName
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping4',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req2',
          isRequired: true, // Service 2 ALSO requires lastName
          requirement: lastNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // THE CRITICAL ASSERTION: Fields should be marked as required
      // because at least one service (actually both) requires them
      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      const lastNameField = data.subjectFields.find((f: ResponseField) => f.name === 'Last Name');

      expect(firstNameField).toBeDefined();
      expect(lastNameField).toBeDefined();

      // ⚠️ THIS IS THE BUG: These assertions will FAIL before the fix
      // The bug causes these to be false even when multiple services require them
      expect(firstNameField.required).toBe(true); // SHOULD BE TRUE - ANY service requiring it makes it required
      expect(lastNameField.required).toBe(true);  // SHOULD BE TRUE - ANY service requiring it makes it required

      // Fields should only appear once (deduplication working)
      const firstNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'First Name').length;
      const lastNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'Last Name').length;
      expect(firstNameCount).toBe(1);
      expect(lastNameCount).toBe(1);
    });

    it('EDGE CASE 1: first service does NOT require field, second service DOES require it', async () => {
      // This tests the specific "first-wins" bug scenario
      // If the first service processed doesn't require the field but the second does,
      // the bug will cause required=false (using first service's value)
      // when it should be required=true (OR logic)

      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      // CRITICAL: First service does NOT require it, second service DOES
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // ⚠️ Service 1 does NOT require firstName
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // ✓ Service 2 DOES require firstName
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      expect(firstNameField).toBeDefined();

      // ⚠️ THIS WILL FAIL WITH THE BUG: Field should be required because service2 requires it
      // But the bug uses first-wins logic, so it will incorrectly be false
      expect(firstNameField.required).toBe(true);

      // Field should only appear once
      const firstNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'First Name').length;
      expect(firstNameCount).toBe(1);
    });

    it('EDGE CASE 2: first service DOES require field, second service does NOT require it', async () => {
      // This case might actually pass with the bug because "first-wins" would use
      // the first service's required=true. But we should test it anyway to ensure
      // the fix doesn't break this scenario.

      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      // First service requires it, second doesn't
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // ✓ Service 1 DOES require firstName
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // ⚠️ Service 2 does NOT require firstName
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      expect(firstNameField).toBeDefined();

      // Field should be required because service1 requires it (OR logic)
      // This might pass even with the bug, but should still pass after the fix
      expect(firstNameField.required).toBe(true);

      // Field should only appear once
      const firstNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'First Name').length;
      expect(firstNameCount).toBe(1);
    });

    it('EDGE CASE 3: three services with mixed requirements', async () => {
      // Test with 3 services: not required, required, not required
      // Should be required=true because at least one service requires it

      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        },
        {
          id: 'sr3',
          serviceId: 'service3',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service3', name: 'Reference Check' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // Service 1: NOT required
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // Service 2: REQUIRED (this should make the field required overall)
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping3',
          serviceId: 'service3',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // Service 3: NOT required
          requirement: firstNameRequirement,
          service: { id: 'service3', name: 'Reference Check' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' },
          { serviceId: 'service3', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      expect(firstNameField).toBeDefined();

      // ⚠️ THIS WILL FAIL WITH THE BUG: Should be required because service2 requires it
      expect(firstNameField.required).toBe(true);

      // Field should only appear once
      const firstNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'First Name').length;
      expect(firstNameCount).toBe(1);
    });

    it('EDGE CASE 4: all services have the field but NONE require it', async () => {
      // This should result in required=false and should work correctly even with the bug

      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      // Neither service marks this field as required
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // Service 1 does NOT require firstName
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // Service 2 does NOT require firstName
          requirement: firstNameRequirement,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      expect(firstNameField).toBeDefined();

      // Field should NOT be required since no service requires it
      // This should work correctly even with the bug
      expect(firstNameField.required).toBe(false);

      // Field should only appear once
      const firstNameCount = data.subjectFields.filter((f: ResponseField) => f.name === 'First Name').length;
      expect(firstNameCount).toBe(1);
    });
  });

  describe('Single service behavior (baseline/happy path)', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('HAPPY PATH: should correctly mark subject fields as required for a single service', async () => {
      // This test should PASS even with the bug because it's a single service
      // It serves as our baseline to ensure single-service scenarios work correctly

      const firstNameRequirement = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');
      const lastNameRequirement = createFieldRequirement('req2', 'Last Name', 'lastName', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service1',
          requirementId: 'req2',
          displayOrder: 2,
          requirement: lastNameRequirement,
          service: { id: 'service1', name: 'Background Check' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true,
          requirement: firstNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req2',
          isRequired: false, // lastName is optional
          requirement: lastNameRequirement,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [{ serviceId: 'service1', locationId: 'location1' }]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      const firstNameField = data.subjectFields.find((f: ResponseField) => f.name === 'First Name');
      const lastNameField = data.subjectFields.find((f: ResponseField) => f.name === 'Last Name');

      expect(firstNameField).toBeDefined();
      expect(lastNameField).toBeDefined();

      expect(firstNameField.required).toBe(true);  // Required
      expect(lastNameField.required).toBe(false);  // Not required

      expect(data.subjectFields.length).toBe(2);
    });
  });

  describe('Search-level fields (should NOT be affected by subject-level deduplication bug)', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('EDGE CASE 5: search fields maintain separate required status per service', async () => {
      // Search fields are per-service, so they should NOT be deduplicated the same way as subject fields
      // Each service should maintain its own required status for search fields
      // This test verifies the bug doesn't affect search-level fields

      const schoolNameRequirement = createFieldRequirement('req1', 'School Name', 'schoolName', 'search');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: schoolNameRequirement,
          service: { id: 'service1', name: 'Education Verification' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: schoolNameRequirement,
          service: { id: 'service2', name: 'Secondary Education Check' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true, // Service 1 requires school name
          requirement: schoolNameRequirement,
          service: { id: 'service1', name: 'Education Verification' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false, // Service 2 does NOT require school name
          requirement: schoolNameRequirement,
          service: { id: 'service2', name: 'Secondary Education Check' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // Search fields should appear separately for each service
      const searchFieldsForService1 = data.searchFields.filter((f: ResponseField) => f.serviceId === 'service1');
      const searchFieldsForService2 = data.searchFields.filter((f: ResponseField) => f.serviceId === 'service2');

      expect(searchFieldsForService1.length).toBe(1);
      expect(searchFieldsForService2.length).toBe(1);

      // Each should have the correct required status based on its own service
      // This verifies search fields are NOT affected by the subject-level deduplication bug
      expect(searchFieldsForService1[0].name).toBe('School Name');
      expect(searchFieldsForService1[0].required).toBe(true); // Service 1 requires it

      expect(searchFieldsForService2[0].name).toBe('School Name');
      expect(searchFieldsForService2[0].required).toBe(false); // Service 2 does NOT require it
    });
  });

  describe('Document deduplication behavior', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('should deduplicate per-case documents and use OR logic for required status', async () => {
      // Documents might have similar deduplication logic as subject fields
      // This test ensures documents follow OR logic for required status

      const consentDocument = {
        id: 'doc1',
        name: 'Consent Form',
        type: 'document',
        disabled: false,
        documentData: {
          instructions: 'Please sign the consent form',
          scope: 'per_case'
        }
      };

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'doc1',
          displayOrder: 1,
          requirement: consentDocument,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'doc1',
          displayOrder: 1,
          requirement: consentDocument,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'doc1',
          isRequired: false, // Service 1 does NOT require the document
          requirement: consentDocument,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'doc1',
          isRequired: true, // Service 2 DOES require the document
          requirement: consentDocument,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // Per-case document should appear only once
      const consentDocs = data.documents.filter((d: ResponseDocument) => d.name === 'Consent Form');
      expect(consentDocs.length).toBe(1);

      // Document should be required because at least one service requires it
      // This might also be affected by a similar bug if documents use the same deduplication logic
      expect(consentDocs[0].required).toBe(true);
    });

    it('should keep per-service documents separate', async () => {
      const serviceSpecificDoc = {
        id: 'doc1',
        name: 'Service Specific Form',
        type: 'document',
        disabled: false,
        documentData: {
          instructions: 'Service-specific document',
          scope: 'per_service' // Not per_case, so should not be deduplicated
        }
      };

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'doc1',
          displayOrder: 1,
          requirement: serviceSpecificDoc,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service2',
          requirementId: 'doc1',
          displayOrder: 1,
          requirement: serviceSpecificDoc,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'doc1',
          isRequired: true,
          requirement: serviceSpecificDoc,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'doc1',
          isRequired: false,
          requirement: serviceSpecificDoc,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // Per-service documents should appear separately
      const docsForService1 = data.documents.filter((d: ResponseDocument) => d.serviceId === 'service1');
      const docsForService2 = data.documents.filter((d: ResponseDocument) => d.serviceId === 'service2');

      expect(docsForService1.length).toBe(1);
      expect(docsForService2.length).toBe(1);

      // Each should have its own required status
      expect(docsForService1[0].required).toBe(true);
      expect(docsForService2[0].required).toBe(false);
    });
  });

  describe('Display order preservation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('should preserve display order when deduplicating subject fields', async () => {
      const field1 = createFieldRequirement('req1', 'First Name', 'firstName', 'subject');
      const field2 = createFieldRequirement('req2', 'Last Name', 'lastName', 'subject');
      const field3 = createFieldRequirement('req3', 'Date of Birth', 'dob', 'subject');

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1, // First in order
          requirement: field1,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service1',
          requirementId: 'req2',
          displayOrder: 2, // Second in order
          requirement: field2,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr3',
          serviceId: 'service1',
          requirementId: 'req3',
          displayOrder: 3, // Third in order
          requirement: field3,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr4',
          serviceId: 'service2',
          requirementId: 'req1',
          displayOrder: 10, // Different order in service2 - should not affect final order
          requirement: field1,
          service: { id: 'service2', name: 'Employment Verification' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true,
          requirement: field1,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req2',
          isRequired: false,
          requirement: field2,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping3',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req3',
          isRequired: false,
          requirement: field3,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping4',
          serviceId: 'service2',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: false,
          requirement: field1,
          service: { id: 'service2', name: 'Employment Verification' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [
          { serviceId: 'service1', locationId: 'location1' },
          { serviceId: 'service2', locationId: 'location1' }
        ]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // Check that fields are in the correct order
      expect(data.subjectFields.length).toBe(3);
      expect(data.subjectFields[0].name).toBe('First Name');
      expect(data.subjectFields[1].name).toBe('Last Name');
      expect(data.subjectFields[2].name).toBe('Date of Birth');

      // Verify display orders are preserved
      expect(data.subjectFields[0].displayOrder).toBe(1);
      expect(data.subjectFields[1].displayOrder).toBe(2);
      expect(data.subjectFields[2].displayOrder).toBe(3);
    });
  });

  describe('Disabled field handling', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user1',
          userType: 'customer',
          customerId: 'customer1'
        }
      });
    });

    it('should not include disabled fields in the response', async () => {
      const enabledField = createFieldRequirement('req1', 'First Name', 'firstName', 'subject', false);
      const disabledField = createFieldRequirement('req2', 'Disabled Field', 'disabled', 'subject', true);

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'sr1',
          serviceId: 'service1',
          requirementId: 'req1',
          displayOrder: 1,
          requirement: enabledField,
          service: { id: 'service1', name: 'Background Check' }
        },
        {
          id: 'sr2',
          serviceId: 'service1',
          requirementId: 'req2',
          displayOrder: 2,
          requirement: disabledField,
          service: { id: 'service1', name: 'Background Check' }
        }
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        {
          id: 'mapping1',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req1',
          isRequired: true,
          requirement: enabledField,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        },
        {
          id: 'mapping2',
          serviceId: 'service1',
          locationId: 'location1',
          requirementId: 'req2',
          isRequired: true,
          requirement: disabledField,
          service: { id: 'service1', name: 'Background Check' },
          country: { id: 'location1', name: 'United States' }
        }
      ]);

      vi.mocked(prisma.country.findMany).mockResolvedValueOnce([
        {
          id: 'location1',
          name: 'United States',
          code2: 'US',
          subregion1: null,
          subregion2: null,
          subregion3: null
        }
      ]);

      vi.mocked(prisma.country.count).mockResolvedValueOnce(0);

      const request = createMockRequest({
        items: [{ serviceId: 'service1', locationId: 'location1' }]
      });

      const response = await POST(request);
      const data = await response.json() as ResponseData;

      expect(response.status).toBe(200);

      // Only the enabled field should be included
      expect(data.subjectFields.length).toBe(1);
      expect(data.subjectFields[0].name).toBe('First Name');

      // Disabled field should not appear
      const disabledFields = data.subjectFields.filter((f: ResponseField) => f.name === 'Disabled Field');
      expect(disabledFields.length).toBe(0);
    });
  });
});