// /GlobalRX_v2/src/types/__tests__/workflow-section-schema.test.ts

import { describe, it, expect } from 'vitest';

// Import from the actual implementation (this will fail until implementer creates it)
import {
  workflowSectionCreateSchema,
  workflowSectionUpdateSchema,
  MAX_SECTIONS_PER_PLACEMENT,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
} from '@/types/workflow-section';

// Import the updated workflow schema with Phase 2 fields
import { workflowUpdateSchema } from '@/types/workflow';

describe('WorkflowSection Schema Validation - Phase 2', () => {
  describe('workflowSectionCreateSchema', () => {
    describe('valid data', () => {
      it('should accept valid text section with all required fields', () => {
        const section = {
          name: 'Background Information',
          placement: 'before_services' as const,
          type: 'text' as const,
          content: 'Please provide your background information.',
          displayOrder: 0,
          isRequired: true
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result).toBeDefined();
        expect(result.name).toBe('Background Information');
        expect(result.placement).toBe('before_services');
        expect(result.type).toBe('text');
        expect(result.content).toBe('Please provide your background information.');
      });

      it('should accept valid document section with file info', () => {
        const section = {
          name: 'Resume Upload',
          placement: 'after_services' as const,
          type: 'document' as const,
          fileUrl: '/uploads/workflow-documents/workflow-123/section-456/resume.pdf',
          fileName: 'resume.pdf',
          displayOrder: 1,
          isRequired: false
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result).toBeDefined();
        expect(result.type).toBe('document');
        expect(result.fileUrl).toBe('/uploads/workflow-documents/workflow-123/section-456/resume.pdf');
        expect(result.fileName).toBe('resume.pdf');
        expect(result.isRequired).toBe(false);
      });

      it('should accept section name up to 100 characters', () => {
        const longName = 'A'.repeat(100);
        const section = {
          name: longName,
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.name).toBe(longName);
        expect(result.name.length).toBe(100);
      });

      it('should accept content up to 50000 characters', () => {
        const longContent = 'B'.repeat(50000);
        const section = {
          name: 'Large Text Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          content: longContent,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.content).toBe(longContent);
        expect(result.content?.length).toBe(50000);
      });

      it('should allow duplicate section names (no uniqueness constraint)', () => {
        const section1 = {
          name: 'Instructions',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        const section2 = {
          name: 'Instructions', // Same name
          placement: 'after_services' as const,
          type: 'text' as const,
          displayOrder: 1
        };

        const result1 = workflowSectionCreateSchema.parse(section1);
        const result2 = workflowSectionCreateSchema.parse(section2);

        expect(result1.name).toBe('Instructions');
        expect(result2.name).toBe('Instructions');
        // Both should parse successfully with the same name
      });

      it('should default isRequired to true when not provided', () => {
        const section = {
          name: 'Default Required Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
          // isRequired not provided
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.isRequired).toBe(true);
      });
    });

    describe('invalid data - required fields', () => {
      it('should fail when name is missing', () => {
        const section = {
          // name missing
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when placement is missing', () => {
        const section = {
          name: 'Test Section',
          // placement missing
          type: 'text' as const,
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when type is missing', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          // type missing
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when displayOrder is missing', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'text' as const
          // displayOrder missing
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });
    });

    describe('invalid data - field constraints', () => {
      it('should fail when name is empty string', () => {
        const section = {
          name: '',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when name exceeds 100 characters', () => {
        const section = {
          name: 'A'.repeat(101),
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when content exceeds 50000 characters', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          content: 'B'.repeat(50001),
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when placement is not valid enum value', () => {
        const section = {
          name: 'Test Section',
          placement: 'invalid_placement',
          type: 'text' as const,
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when type is not valid enum value', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'invalid_type',
          displayOrder: 0
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when displayOrder is negative', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: -1
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when displayOrder is not an integer', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 1.5
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });

      it('should fail when isRequired is not a boolean', () => {
        const section = {
          name: 'Test Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0,
          isRequired: 'yes' as any
        };

        expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
      });
    });

    describe('placement enum values', () => {
      it('should accept before_services placement', () => {
        const section = {
          name: 'Before Services Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.placement).toBe('before_services');
      });

      it('should accept after_services placement', () => {
        const section = {
          name: 'After Services Section',
          placement: 'after_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.placement).toBe('after_services');
      });

      it('should reject any other placement value', () => {
        const invalidPlacements = ['during_services', 'middle', 'between', '', null, undefined];

        invalidPlacements.forEach(placement => {
          const section = {
            name: 'Test Section',
            placement: placement as any,
            type: 'text' as const,
            displayOrder: 0
          };

          expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
        });
      });
    });

    describe('section type enum values', () => {
      it('should accept text type', () => {
        const section = {
          name: 'Text Section',
          placement: 'before_services' as const,
          type: 'text' as const,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.type).toBe('text');
      });

      it('should accept document type', () => {
        const section = {
          name: 'Document Section',
          placement: 'before_services' as const,
          type: 'document' as const,
          displayOrder: 0
        };

        const result = workflowSectionCreateSchema.parse(section);
        expect(result.type).toBe('document');
      });

      it('should reject any other type value', () => {
        const invalidTypes = ['signature', 'checkbox', 'radio', 'dropdown', '', null, undefined];

        invalidTypes.forEach(type => {
          const section = {
            name: 'Test Section',
            placement: 'before_services' as const,
            type: type as any,
            displayOrder: 0
          };

          expect(() => workflowSectionCreateSchema.parse(section)).toThrow();
        });
      });
    });
  });

  describe('workflowSectionUpdateSchema', () => {
    it('should accept partial updates with only name', () => {
      const update = {
        name: 'Updated Name'
      };

      const result = workflowSectionUpdateSchema.parse(update);
      expect(result.name).toBe('Updated Name');
      expect(result.placement).toBeUndefined();
      expect(result.type).toBeUndefined();
    });

    it('should accept partial updates with only placement', () => {
      const update = {
        placement: 'after_services' as const
      };

      const result = workflowSectionUpdateSchema.parse(update);
      expect(result.placement).toBe('after_services');
      expect(result.name).toBeUndefined();
    });

    it('should accept partial updates with only content', () => {
      const update = {
        content: 'Updated content text'
      };

      const result = workflowSectionUpdateSchema.parse(update);
      expect(result.content).toBe('Updated content text');
    });

    it('should accept empty object for no updates', () => {
      const update = {};

      const result = workflowSectionUpdateSchema.parse(update);
      expect(result).toEqual({});
    });

    it('should still enforce constraints on provided fields', () => {
      const update = {
        name: 'A'.repeat(101) // Too long
      };

      expect(() => workflowSectionUpdateSchema.parse(update)).toThrow();
    });
  });

  describe('MAX_SECTIONS_PER_PLACEMENT constant', () => {
    it('should be defined as 10', () => {
      expect(MAX_SECTIONS_PER_PLACEMENT).toBe(10);
    });
  });
});

describe('Workflow Schema Validation - Phase 2 Email and Gap Tolerance', () => {
  describe('workflowUpdateSchema - email template fields', () => {
    it('should accept valid email subject within 200 chars', () => {
      const update = {
        emailSubject: 'Invitation to Complete Background Screening'
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailSubject).toBe('Invitation to Complete Background Screening');
    });

    it('should accept email subject at max length (200 chars)', () => {
      const maxSubject = 'A'.repeat(200);
      const update = {
        emailSubject: maxSubject
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailSubject).toBe(maxSubject);
      expect(result.emailSubject?.length).toBe(200);
    });

    it('should reject email subject exceeding 200 chars', () => {
      const update = {
        emailSubject: 'A'.repeat(201)
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });

    it('should accept valid email body within 5000 chars', () => {
      const update = {
        emailBody: 'Dear {{candidateName}},\n\nYou have been invited to complete a background screening.\n\nBest regards,\n{{companyName}}'
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailBody).toContain('{{candidateName}}');
      expect(result.emailBody).toContain('{{companyName}}');
    });

    it('should accept email body at max length (5000 chars)', () => {
      const maxBody = 'B'.repeat(5000);
      const update = {
        emailBody: maxBody
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailBody).toBe(maxBody);
      expect(result.emailBody?.length).toBe(5000);
    });

    it('should reject email body exceeding 5000 chars', () => {
      const update = {
        emailBody: 'B'.repeat(5001)
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });

    it('should accept empty string for email subject', () => {
      const update = {
        emailSubject: ''
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailSubject).toBe('');
    });

    it('should accept empty string for email body', () => {
      const update = {
        emailBody: ''
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailBody).toBe('');
    });
  });

  describe('workflowUpdateSchema - gap tolerance days', () => {
    it('should accept minimum gap tolerance (1 day)', () => {
      const update = {
        gapToleranceDays: 1
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.gapToleranceDays).toBe(1);
    });

    it('should accept maximum gap tolerance (365 days)', () => {
      const update = {
        gapToleranceDays: 365
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.gapToleranceDays).toBe(365);
    });

    it('should accept typical gap tolerance values', () => {
      const typicalValues = [7, 14, 30, 60, 90, 180];

      typicalValues.forEach(days => {
        const update = { gapToleranceDays: days };
        const result = workflowUpdateSchema.parse(update);
        expect(result.gapToleranceDays).toBe(days);
      });
    });

    it('should accept null to clear gap tolerance', () => {
      const update = {
        gapToleranceDays: null
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.gapToleranceDays).toBe(null);
    });

    it('should reject gap tolerance of 0 days', () => {
      const update = {
        gapToleranceDays: 0
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });

    it('should reject negative gap tolerance', () => {
      const update = {
        gapToleranceDays: -1
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });

    it('should reject gap tolerance exceeding 365 days', () => {
      const update = {
        gapToleranceDays: 366
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });

    it('should reject non-integer gap tolerance', () => {
      const update = {
        gapToleranceDays: 7.5
      };

      expect(() => workflowUpdateSchema.parse(update)).toThrow();
    });
  });

  describe('combined workflow updates', () => {
    it('should accept all new fields together', () => {
      const update = {
        name: 'Updated Workflow',
        emailSubject: 'Complete Your Screening',
        emailBody: 'Hello {{candidateName}}, please complete your screening.',
        gapToleranceDays: 14
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.name).toBe('Updated Workflow');
      expect(result.emailSubject).toBe('Complete Your Screening');
      expect(result.emailBody).toContain('{{candidateName}}');
      expect(result.gapToleranceDays).toBe(14);
    });

    it('should accept partial update with only new Phase 2 fields', () => {
      const update = {
        emailSubject: 'New Subject',
        emailBody: 'New Body',
        gapToleranceDays: 30
      };

      const result = workflowUpdateSchema.parse(update);
      expect(result.emailSubject).toBe('New Subject');
      expect(result.emailBody).toBe('New Body');
      expect(result.gapToleranceDays).toBe(30);
      expect(result.name).toBeUndefined();
    });
  });
});

describe('File Upload Validation - Phase 2', () => {
  describe('file type validation', () => {
    it('should define allowed file extensions', () => {
      expect(ALLOWED_FILE_EXTENSIONS).toContain('.pdf');
      expect(ALLOWED_FILE_EXTENSIONS).toContain('.docx');
      expect(ALLOWED_FILE_EXTENSIONS).toContain('.doc');
      expect(ALLOWED_FILE_EXTENSIONS).not.toContain('.jpg');
      expect(ALLOWED_FILE_EXTENSIONS).not.toContain('.png');
      expect(ALLOWED_FILE_EXTENSIONS).not.toContain('.txt');
    });

    it('should define allowed MIME types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(ALLOWED_MIME_TYPES).toContain('application/msword');
      expect(ALLOWED_MIME_TYPES).not.toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).not.toContain('image/png');
      expect(ALLOWED_MIME_TYPES).not.toContain('text/plain');
    });

    it('should define max file size as 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      expect(MAX_FILE_SIZE).toBe(10485760);
    });
  });
});