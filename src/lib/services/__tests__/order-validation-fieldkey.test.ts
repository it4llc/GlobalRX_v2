// src/lib/services/__tests__/order-validation-fieldkey.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderValidationService } from '../order-validation.service';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceRequirement: {
      findMany: vi.fn()
    },
    dSXMapping: {
      findMany: vi.fn()
    },
    country: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

describe('OrderValidationService - fieldKey usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateOrderRequirements', () => {
    it('should validate using fieldKey for subject fields', async () => {
      // Setup mock data
      const mockServiceRequirements = [
        {
          serviceId: 'service-1',
          requirementId: 'req-1',
          requirement: {
            id: 'req-1',
            name: 'First Name or Given Name',  // Display label
            fieldKey: 'firstName',              // Stable key
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'text'
            }
          },
          service: { name: 'Background Check' }
        }
      ];

      const mockLocationMappings = [
        {
          serviceId: 'service-1',
          locationId: 'loc-1',
          requirementId: 'req-1',
          isRequired: true,
          requirement: {
            id: 'req-1',
            name: 'First Name or Given Name',
            fieldKey: 'firstName',
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'text'
            }
          },
          service: { name: 'Background Check' },
          country: { name: 'United States' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);
      vi.mocked(prisma.country.findUnique).mockResolvedValue({ name: 'United States' } as any);

      // Test with correct fieldKey in data
      const resultValid = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'service-1', locationId: 'loc-1', itemId: 'item-1' }
        ],
        subjectFieldValues: {
          'firstName': 'John'  // Using fieldKey
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(resultValid.isValid).toBe(true);
      expect(resultValid.missingRequirements.subjectFields).toHaveLength(0);
    });

    it('should fail validation when using display name instead of fieldKey', async () => {
      // Setup mock data
      const mockServiceRequirements: any[] = [];
      const mockLocationMappings = [
        {
          serviceId: 'service-1',
          locationId: 'loc-1',
          requirementId: 'req-1',
          isRequired: true,
          requirement: {
            id: 'req-1',
            name: 'First Name or Given Name',  // Display label
            fieldKey: 'firstName',              // Stable key
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'text'
            }
          },
          service: { name: 'Background Check' },
          country: { name: 'United States' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);

      // Test with display name in data (wrong)
      const resultInvalid = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'service-1', locationId: 'loc-1', itemId: 'item-1' }
        ],
        subjectFieldValues: {
          'First Name or Given Name': 'John'  // Using display name instead of fieldKey
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.missingRequirements.subjectFields).toHaveLength(1);
      expect(resultInvalid.missingRequirements.subjectFields[0]).toEqual({
        fieldName: 'First Name or Given Name',
        serviceLocation: 'Background Check - United States'
      });
    });

    // REGRESSION TEST:
    it('REGRESSION TEST: validation must pass when subjectFieldValues uses fieldKey', async () => {
      // This test proves the fix works: validation passes when using fieldKey

      const mockServiceRequirements: any[] = [];
      const mockLocationMappings = [
        {
          serviceId: 'education-service',
          locationId: 'us',
          requirementId: 'school-field',
          isRequired: true,
          requirement: {
            id: 'school-field',
            name: 'School Name / Institution / École',  // Complex multilingual label
            fieldKey: 'schoolName',                     // Simple stable key
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'text'
            }
          },
          service: { name: 'Education Verification' },
          country: { name: 'United States' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);

      // With fix: validation passes when using fieldKey
      const result = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'education-service', locationId: 'us', itemId: 'item-edu-1' }
        ],
        subjectFieldValues: {
          'schoolName': 'Harvard University'  // Using fieldKey (correct)
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(result.isValid).toBe(true);
      expect(result.missingRequirements.subjectFields).toHaveLength(0);
    });

    // REGRESSION TEST:
    it('REGRESSION TEST: validation must fail when subjectFieldValues uses display label', async () => {
      // This test proves that using the display label causes validation to fail

      const mockServiceRequirements: any[] = [];
      const mockLocationMappings = [
        {
          serviceId: 'education-service',
          locationId: 'us',
          requirementId: 'school-field',
          isRequired: true,
          requirement: {
            id: 'school-field',
            name: 'School Name / Institution / École',  // Complex multilingual label
            fieldKey: 'schoolName',                     // Simple stable key
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'text'
            }
          },
          service: { name: 'Education Verification' },
          country: { name: 'United States' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);

      // Without fix: validation fails when using display label
      const result = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'education-service', locationId: 'us', itemId: 'item-edu-1' }
        ],
        subjectFieldValues: {
          'School Name / Institution / École': 'Harvard University'  // Using display label (wrong)
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(result.isValid).toBe(false);
      expect(result.missingRequirements.subjectFields).toHaveLength(1);
      expect(result.missingRequirements.subjectFields[0].fieldName).toBe('School Name / Institution / École');
    });

    it('should validate search fields using fieldKey', async () => {
      const mockServiceRequirements = [
        {
          serviceId: 'employment-service',
          requirementId: 'employer-field',
          requirement: {
            id: 'employer-field',
            name: 'Previous Employer Name/Company',
            fieldKey: 'previousEmployer',
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'search',  // Search-level field
              dataType: 'text'
            }
          },
          service: { name: 'Employment Verification' }
        }
      ];

      const mockLocationMappings = [
        {
          serviceId: 'employment-service',
          locationId: 'us',
          requirementId: 'employer-field',
          isRequired: true,
          requirement: {
            id: 'employer-field',
            name: 'Previous Employer Name/Company',
            fieldKey: 'previousEmployer',
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'search',
              dataType: 'text'
            }
          },
          service: { name: 'Employment Verification' },
          country: { name: 'United States' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);
      vi.mocked(prisma.country.findUnique).mockResolvedValue({ name: 'United States' } as any);

      // Test with correct fieldKey in search fields
      const resultValid = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'employment-service', locationId: 'us', itemId: 'item-emp-1' }
        ],
        subjectFieldValues: {},
        searchFieldValues: {
          'item-emp-1': {
            'previousEmployer': 'Acme Corp'  // Using fieldKey
          }
        },
        uploadedDocuments: {}
      });

      expect(resultValid.isValid).toBe(true);
      expect(resultValid.missingRequirements.searchFields).toHaveLength(0);

      // Test with display name (should fail)
      const resultInvalid = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'employment-service', locationId: 'us', itemId: 'item-emp-1' }
        ],
        subjectFieldValues: {},
        searchFieldValues: {
          'item-emp-1': {
            'Previous Employer Name/Company': 'Acme Corp'  // Using display name
          }
        },
        uploadedDocuments: {}
      });

      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.missingRequirements.searchFields).toHaveLength(1);
    });

    it('should handle fields with changed labels but same fieldKey', async () => {
      // Simulating a field that had its label updated
      const mockServiceRequirements: any[] = [];
      const mockLocationMappings = [
        {
          serviceId: 'service-1',
          locationId: 'loc-1',
          requirementId: 'dob-field',
          isRequired: true,
          requirement: {
            id: 'dob-field',
            name: 'Date of Birth (DOB) - Updated Label',  // Label was changed
            fieldKey: 'dateOfBirth',                      // fieldKey remains stable
            type: 'field',
            disabled: false,
            fieldData: {
              collectionTab: 'subject',
              dataType: 'date'
            }
          },
          service: { name: 'Identity Verification' },
          country: { name: 'Canada' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);

      // Validation should still work with the stable fieldKey
      const result = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'service-1', locationId: 'loc-1', itemId: 'item-1' }
        ],
        subjectFieldValues: {
          'dateOfBirth': '1990-01-01'  // Using stable fieldKey
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(result.isValid).toBe(true);
      expect(result.missingRequirements.subjectFields).toHaveLength(0);
    });

    it('should handle multiple required fields with mixed validation results', async () => {
      const mockServiceRequirements: any[] = [];
      const mockLocationMappings = [
        {
          serviceId: 'service-1',
          locationId: 'loc-1',
          requirementId: 'field-1',
          isRequired: true,
          requirement: {
            id: 'field-1',
            name: 'First Name',
            fieldKey: 'firstName',
            type: 'field',
            disabled: false,
            fieldData: { collectionTab: 'subject', dataType: 'text' }
          },
          service: { name: 'Service' },
          country: { name: 'US' }
        },
        {
          serviceId: 'service-1',
          locationId: 'loc-1',
          requirementId: 'field-2',
          isRequired: true,
          requirement: {
            id: 'field-2',
            name: 'Last Name',
            fieldKey: 'lastName',
            type: 'field',
            disabled: false,
            fieldData: { collectionTab: 'subject', dataType: 'text' }
          },
          service: { name: 'Service' },
          country: { name: 'US' }
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue(mockServiceRequirements);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue(mockLocationMappings as any);

      const result = await OrderValidationService.validateOrderRequirements({
        serviceItems: [
          { serviceId: 'service-1', locationId: 'loc-1', itemId: 'item-1' }
        ],
        subjectFieldValues: {
          'firstName': 'John',  // Provided with correct key
          'Last Name': 'Doe'    // Provided with wrong key (display name)
        },
        searchFieldValues: {},
        uploadedDocuments: {}
      });

      expect(result.isValid).toBe(false);
      expect(result.missingRequirements.subjectFields).toHaveLength(1);
      expect(result.missingRequirements.subjectFields[0].fieldName).toBe('Last Name');
    });
  });
});