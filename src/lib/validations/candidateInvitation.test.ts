// /GlobalRX_v2/src/lib/validations/candidateInvitation.test.ts

import { describe, it, expect } from 'vitest';
import {
  createInvitationSchema,
  extendInvitationSchema
} from './candidateInvitation';

describe('Candidate Invitation Validation Schemas', () => {
  describe('createInvitationSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('should pass with phone fields included', () => {
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneCountryCode: '+1',
          phoneNumber: '5551234567'
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.phoneCountryCode).toBe('+1');
          expect(result.data.phoneNumber).toBe('5551234567');
        }
      });

      it('should pass with customerId for admin users', () => {
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          customerId: '650e8400-e29b-41d4-a716-446655440001'
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.customerId).toBe('650e8400-e29b-41d4-a716-446655440001');
        }
      });

      it('should pass with maximum length names', () => {
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'a'.repeat(100),
          lastName: 'b'.repeat(100),
          email: 'test@example.com'
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with different valid email formats', () => {
        const emails = [
          'simple@example.com',
          'user+tag@example.com',
          'user.name@example.co.uk',
          'first.last@subdomain.example.com',
          'user123@test123.org'
        ];

        emails.forEach(email => {
          const validData = {
            packageId: '550e8400-e29b-41d4-a716-446655440000',
            firstName: 'John',
            lastName: 'Doe',
            email
          };

          const result = createInvitationSchema.safeParse(validData);
          expect(result.success).toBe(true);
        });
      });

      it('should pass with maximum length phone fields', () => {
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: '+1234',  // 5 chars max
          phoneNumber: '12345678901234567890'  // 20 chars max
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when packageId is missing', () => {
        const invalidData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('packageId');
        }
      });

      it('should fail when packageId is not a valid UUID', () => {
        const invalidData = {
          packageId: 'not-a-uuid',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('packageId');
        }
      });

      it('should fail when firstName is missing', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('firstName');
        }
      });

      it('should fail when firstName is empty', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: '',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 1 character');
        }
      });

      it('should fail when firstName exceeds 100 characters', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'a'.repeat(101),
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('100 characters');
        }
      });

      it('should fail when lastName is missing', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('lastName');
        }
      });

      it('should fail when lastName is empty', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: '',
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 1 character');
        }
      });

      it('should fail when lastName exceeds 100 characters', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'b'.repeat(101),
          email: 'john@example.com'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('100 characters');
        }
      });

      it('should fail when email is missing', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('email');
        }
      });

      it('should fail when email is invalid', () => {
        const invalidEmails = [
          'notanemail',
          '@example.com',
          'user@',
          'user@.com',
          'user@example',
          'user name@example.com',
          'user@exam ple.com',
          ''
        ];

        invalidEmails.forEach(email => {
          const invalidData = {
            packageId: '550e8400-e29b-41d4-a716-446655440000',
            firstName: 'John',
            lastName: 'Doe',
            email
          };

          const result = createInvitationSchema.safeParse(invalidData);
          expect(result.success).toBe(false);
        });
      });

      it('should fail when phoneNumber is provided without phoneCountryCode', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneNumber: '5551234567'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          // The refine rule should catch this
          expect(result.error.issues[0].message).toContain('phone country code');
        }
      });

      it('should fail when phoneCountryCode exceeds 5 characters', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: '+12345',  // 6 chars
          phoneNumber: '5551234567'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('5 characters');
        }
      });

      it('should fail when phoneNumber exceeds 20 characters', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: '+1',
          phoneNumber: '123456789012345678901'  // 21 chars
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('20 characters');
        }
      });

      it('should fail when customerId is not a valid UUID', () => {
        const invalidData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          customerId: 'not-a-uuid'
        };

        const result = createInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('customerId');
        }
      });

      it('should pass when phoneCountryCode is provided without phoneNumber', () => {
        // This is allowed - only phoneNumber requires phoneCountryCode, not vice versa
        const validData = {
          packageId: '550e8400-e29b-41d4-a716-446655440000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: '+1'
        };

        const result = createInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('extendInvitationSchema', () => {
    describe('valid data', () => {
      it('should pass with days in valid range', () => {
        for (let days = 1; days <= 15; days++) {
          const validData = { days };
          const result = extendInvitationSchema.safeParse(validData);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.days).toBe(days);
          }
        }
      });

      it('should pass with no days specified (uses workflow default)', () => {
        const validData = {};
        const result = extendInvitationSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.days).toBeUndefined();
        }
      });
    });

    describe('invalid data', () => {
      it('should fail when days is less than 1', () => {
        const invalidData = { days: 0 };
        const result = extendInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 1');
        }
      });

      it('should fail when days is negative', () => {
        const invalidData = { days: -5 };
        const result = extendInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 1');
        }
      });

      it('should fail when days is greater than 15', () => {
        const invalidData = { days: 16 };
        const result = extendInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at most 15');
        }
      });

      it('should fail when days is not an integer', () => {
        const invalidData = { days: 7.5 };
        const result = extendInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('integer');
        }
      });

      it('should fail when days is not a number', () => {
        const invalidData = { days: 'seven' as any };
        const result = extendInvitationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('days');
        }
      });

      it('should strip out unexpected fields', () => {
        const dataWithExtra = {
          days: 7,
          someOtherField: 'should be stripped'
        } as any;

        const result = extendInvitationSchema.safeParse(dataWithExtra);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('someOtherField');
          expect(result.data.days).toBe(7);
        }
      });
    });
  });
});