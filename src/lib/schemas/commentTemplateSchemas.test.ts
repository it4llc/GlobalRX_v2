// /GlobalRX_v2/src/lib/schemas/commentTemplateSchemas.test.ts

import { describe, it, expect } from 'vitest';
import {
  commentTemplateSchema,
  createCommentTemplateSchema,
  updateCommentTemplateSchema,
  commentTemplateAvailabilitySchema,
  updateAvailabilitySchema,
  commentTemplateListSchema
} from '@/lib/schemas/commentTemplateSchemas';

describe('Comment Template Schemas', () => {
  describe('commentTemplateSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          shortName: 'Missing Doc',
          longName: 'Document Required - Customer Must Provide',
          templateText: 'Please provide the following document: [document type]',
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with optional fields included', () => {
        const validData = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          shortName: 'SSN Missing',
          longName: 'Social Security Number Required',
          templateText: 'The SSN provided for [candidate name] appears to be invalid. Please verify.',
          isActive: false,
          hasBeenUsed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-456'
        };

        const result = commentTemplateSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with template containing multiple placeholders', () => {
        const validData = {
          shortName: 'Emp Verify',
          longName: 'Employment Verification Pending',
          templateText: 'Employment verification pending for [candidate name] at [company name] from [start date] to [end date]',
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should handle maximum length fields', () => {
        const validData = {
          shortName: 'A'.repeat(50), // Max 50 chars
          longName: 'B'.repeat(100), // Max 100 chars
          templateText: 'C'.repeat(1000), // Max 1000 chars
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail with missing required fields', () => {
        const invalidData = {
          shortName: 'Test'
          // Missing longName and templateText
        };

        const result = commentTemplateSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when shortName exceeds 50 characters', () => {
        const invalidData = {
          shortName: 'A'.repeat(51),
          longName: 'Valid Long Name',
          templateText: 'Valid template text',
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when longName exceeds 100 characters', () => {
        const invalidData = {
          shortName: 'Valid Short',
          longName: 'B'.repeat(101),
          templateText: 'Valid template text',
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when templateText exceeds 1000 characters', () => {
        const invalidData = {
          shortName: 'Valid Short',
          longName: 'Valid Long Name',
          templateText: 'C'.repeat(1001),
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail with empty strings', () => {
        const invalidData = {
          shortName: '',
          longName: '',
          templateText: '',
          isActive: true,
          hasBeenUsed: false
        };

        const result = commentTemplateSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('createCommentTemplateSchema', () => {
    it('should require only shortName, longName, and templateText', () => {
      const validData = {
        shortName: 'New Template',
        longName: 'New Template Long Description',
        templateText: 'This is a new template with [placeholder]'
      };

      const result = createCommentTemplateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should not accept id or audit fields', () => {
      const dataWithExtra = {
        id: 'should-not-be-here',
        shortName: 'New Template',
        longName: 'New Template Long Description',
        templateText: 'This is a new template',
        createdAt: new Date()
      };

      const result = createCommentTemplateSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      // Extra fields are stripped out
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
    });
  });

  describe('updateCommentTemplateSchema', () => {
    it('should allow partial updates', () => {
      const updateShortName = {
        shortName: 'Updated Short'
      };

      const result = updateCommentTemplateSchema.safeParse(updateShortName);
      expect(result.success).toBe(true);
    });

    it('should allow updating isActive flag', () => {
      const updateActive = {
        isActive: false
      };

      const result = updateCommentTemplateSchema.safeParse(updateActive);
      expect(result.success).toBe(true);
    });

    it('should allow updating all fields', () => {
      const updateAll = {
        shortName: 'Updated Short',
        longName: 'Updated Long Name',
        templateText: 'Updated template text with [new placeholder]',
        isActive: false
      };

      const result = updateCommentTemplateSchema.safeParse(updateAll);
      expect(result.success).toBe(true);
    });
  });

  describe('commentTemplateAvailabilitySchema', () => {
    it('should validate availability assignment', () => {
      const validAvailability = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        serviceCode: 'CRIMINAL',
        status: 'in_progress'
      };

      const result = commentTemplateAvailabilitySchema.safeParse(validAvailability);
      expect(result.success).toBe(true);
    });

    it('should require templateId, serviceCode, and status', () => {
      const missingFields = {
        serviceCode: 'CRIMINAL'
        // Missing templateId and status
      };

      const result = commentTemplateAvailabilitySchema.safeParse(missingFields);
      expect(result.success).toBe(false);
    });
  });

  describe('updateAvailabilitySchema', () => {
    it('should accept array of service/status pairs', () => {
      const validUpdate = {
        availabilities: [
          { serviceCode: 'CRIMINAL', status: 'in_progress' },
          { serviceCode: 'CRIMINAL', status: 'pending' },
          { serviceCode: 'EDUCATION', status: 'in_progress' }
        ]
      };

      const result = updateAvailabilitySchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should accept empty array to clear all availabilities', () => {
      const clearAll = {
        availabilities: []
      };

      const result = updateAvailabilitySchema.safeParse(clearAll);
      expect(result.success).toBe(true);
    });
  });

  describe('commentTemplateListSchema', () => {
    it('should validate complete list response', () => {
      const validResponse = {
        templates: [
          {
            shortName: 'Template 1',
            longName: 'First Template',
            templateText: 'Text with [placeholder]',
            isActive: true,
            hasBeenUsed: false
          }
        ],
        services: [
          { code: 'CRIMINAL', name: 'Criminal Background Check' },
          { code: 'EDUCATION', name: 'Education Verification', category: 'Verification' }
        ],
        statuses: ['draft', 'submitted', 'in_progress', 'completed']
      };

      const result = commentTemplateListSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should allow empty templates array', () => {
      const emptyTemplates = {
        templates: [],
        services: [
          { code: 'CRIMINAL', name: 'Criminal Background Check' }
        ],
        statuses: ['draft']
      };

      const result = commentTemplateListSchema.safeParse(emptyTemplates);
      expect(result.success).toBe(true);
    });
  });
});