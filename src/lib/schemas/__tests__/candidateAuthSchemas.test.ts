// /GlobalRX_v2/src/lib/schemas/__tests__/candidateAuthSchemas.test.ts
// Pass 1 Schema validation tests for Phase 5 Stage 2 - Candidate Login & Session Management

import { describe, it, expect } from 'vitest';
import {
  candidateVerifySchema,
  candidateSessionDataSchema,
  candidateSessionResponseSchema
} from '../candidateAuthSchemas';

describe('candidateAuthSchemas', () => {
  describe('candidateVerifySchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          token: 'abc123xyz',
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass with long token', () => {
        const validData = {
          token: 'a'.repeat(100),
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with complex password', () => {
        const validData = {
          token: 'abc123xyz',
          password: 'P@ssw0rd!WithSpecialChars#2024$'
        };

        const result = candidateVerifySchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should trim whitespace from token', () => {
        const dataWithWhitespace = {
          token: '  abc123xyz  ',
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(dataWithWhitespace);
        expect(result.success).toBe(true);
        expect(result.data?.token).toBe('abc123xyz');
      });
    });

    describe('invalid data', () => {
      it('should fail when token is missing', () => {
        const invalidData = {
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['token']);
        expect(result.error?.issues[0].message).toContain('Required');
      });

      it('should fail when password is missing', () => {
        const invalidData = {
          token: 'abc123xyz'
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['password']);
        expect(result.error?.issues[0].message).toContain('Required');
      });

      it('should fail when token is empty string', () => {
        const invalidData = {
          token: '',
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['token']);
        expect(result.error?.issues[0].message).toContain('String must contain at least 1 character');
      });

      it('should fail when password is empty string', () => {
        const invalidData = {
          token: 'abc123xyz',
          password: ''
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['password']);
        expect(result.error?.issues[0].message).toContain('String must contain at least 1 character');
      });

      it('should fail when token is only whitespace', () => {
        const invalidData = {
          token: '   \n\t  ',
          password: 'MySecurePassword123'
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['token']);
      });

      it('should fail with wrong data types', () => {
        const invalidData = {
          token: 123, // Should be string
          password: true // Should be string
        };

        const result = candidateVerifySchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues.length).toBeGreaterThan(0);
      });

      it('should fail when extra fields are provided and strip them', () => {
        const dataWithExtra = {
          token: 'abc123xyz',
          password: 'MySecurePassword123',
          email: 'should-be-ignored@example.com',
          unknownField: 'should-be-ignored'
        };

        const result = candidateVerifySchema.safeParse(dataWithExtra);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          token: 'abc123xyz',
          password: 'MySecurePassword123'
        });
        expect('email' in result.data!).toBe(false);
        expect('unknownField' in result.data!).toBe(false);
      });
    });
  });

  describe('candidateSessionDataSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440000',
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
        };

        const result = candidateSessionDataSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass with different status values', () => {
        const statuses = ['sent', 'accessed', 'completed', 'expired'];

        statuses.forEach(status => {
          const validData = {
            invitationId: '550e8400-e29b-41d4-a716-446655440001',
            token: 'test-token',
            firstName: 'John',
            status,
            expiresAt: new Date()
          };

          const result = candidateSessionDataSchema.safeParse(validData);
          expect(result.success).toBe(true);
          expect(result.data?.status).toBe(status);
        });
      });

      it('should coerce string dates to Date objects', () => {
        const validData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440002',
          token: 'token123',
          firstName: 'Alice',
          status: 'accessed',
          expiresAt: '2024-12-31T23:59:59Z'
        };

        const result = candidateSessionDataSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.expiresAt).toBeInstanceOf(Date);
      });

      it('should accept firstName with special characters', () => {
        const validData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440003',
          token: 'token456',
          firstName: 'María José',
          status: 'accessed',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.firstName).toBe('María José');
      });
    });

    describe('invalid data', () => {
      it('should fail when invitationId is missing', () => {
        const invalidData = {
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['invitationId']);
      });

      it('should fail when invitationId is not a valid UUID', () => {
        const invalidData = {
          invitationId: 'not-a-uuid',
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['invitationId']);
        expect(result.error?.issues[0].message).toContain('Invalid uuid');
      });

      it('should fail when token is missing', () => {
        const invalidData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440004',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['token']);
      });

      it('should fail when firstName is missing', () => {
        const invalidData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440005',
          token: 'abc123xyz',
          status: 'accessed',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['firstName']);
      });

      it('should fail when status is missing', () => {
        const invalidData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440006',
          token: 'abc123xyz',
          firstName: 'Sarah',
          expiresAt: new Date()
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['status']);
      });

      it('should fail when expiresAt is missing', () => {
        const invalidData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440007',
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed'
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['expiresAt']);
      });

      it('should fail when expiresAt is not a valid date', () => {
        const invalidData = {
          invitationId: '550e8400-e29b-41d4-a716-446655440008',
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: 'not-a-date'
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['expiresAt']);
      });

      it('should fail with wrong data types', () => {
        const invalidData = {
          invitationId: 123, // Should be string
          token: true, // Should be string
          firstName: null, // Should be string
          status: 100, // Should be string
          expiresAt: 'tomorrow' // Should be valid date
        };

        const result = candidateSessionDataSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues.length).toBeGreaterThan(0);
      });

      it('should strip unknown fields', () => {
        const dataWithExtra = {
          invitationId: '550e8400-e29b-41d4-a716-446655440009',
          token: 'abc123xyz',
          firstName: 'Sarah',
          status: 'accessed',
          expiresAt: new Date(),
          email: 'should-be-ignored@example.com',
          passwordHash: 'should-be-ignored',
          unknownField: 'should-be-ignored'
        };

        const result = candidateSessionDataSchema.safeParse(dataWithExtra);
        expect(result.success).toBe(true);
        expect('email' in result.data!).toBe(false);
        expect('passwordHash' in result.data!).toBe(false);
        expect('unknownField' in result.data!).toBe(false);
      });
    });
  });

  describe('candidateSessionResponseSchema', () => {
    describe('valid data', () => {
      it('should pass with authenticated response', () => {
        const validData = {
          authenticated: true,
          invitation: {
            id: '550e8400-e29b-41d4-a716-446655440010',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'abc123xyz'
          }
        };

        const result = candidateSessionResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass with unauthenticated response', () => {
        const validData = {
          authenticated: false
        };

        const result = candidateSessionResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should fail when authenticated is true but invitation is missing', () => {
        const invalidData = {
          authenticated: true
        };

        const result = candidateSessionResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should pass when authenticated is false even with invitation data', () => {
        const validData = {
          authenticated: false,
          invitation: {
            id: '550e8400-e29b-41d4-a716-446655440011',
            firstName: 'Should be ignored',
            status: 'accessed',
            token: 'ignored'
          }
        };

        const result = candidateSessionResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when authenticated is missing', () => {
        const invalidData = {
          invitation: {
            id: '550e8400-e29b-41d4-a716-446655440012',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'abc123xyz'
          }
        };

        const result = candidateSessionResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['authenticated']);
      });

      it('should fail when authenticated is not a boolean', () => {
        const invalidData = {
          authenticated: 'yes',
          invitation: {
            id: '550e8400-e29b-41d4-a716-446655440013',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'abc123xyz'
          }
        };

        const result = candidateSessionResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when invitation has invalid UUID', () => {
        const invalidData = {
          authenticated: true,
          invitation: {
            id: 'not-a-uuid',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'abc123xyz'
          }
        };

        const result = candidateSessionResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when invitation is missing required fields', () => {
        const invalidData = {
          authenticated: true,
          invitation: {
            id: '550e8400-e29b-41d4-a716-446655440014',
            firstName: 'Sarah'
            // Missing status and token
          }
        };

        const result = candidateSessionResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle session data with very long names', () => {
      const dataWithLongName = {
        invitationId: '550e8400-e29b-41d4-a716-446655440015',
        token: 'token123',
        firstName: 'A'.repeat(255),
        status: 'accessed',
        expiresAt: new Date()
      };

      const result = candidateSessionDataSchema.safeParse(dataWithLongName);
      expect(result.success).toBe(true);
    });

    it('should handle session data with unicode in names', () => {
      const dataWithUnicode = {
        invitationId: '550e8400-e29b-41d4-a716-446655440016',
        token: 'token456',
        firstName: '李明 (Li Ming)',
        status: 'accessed',
        expiresAt: new Date()
      };

      const result = candidateSessionDataSchema.safeParse(dataWithUnicode);
      expect(result.success).toBe(true);
    });

    it('should handle verify data with very long passwords', () => {
      const dataWithLongPassword = {
        token: 'abc123xyz',
        password: 'P'.repeat(500) + '123'
      };

      const result = candidateVerifySchema.safeParse(dataWithLongPassword);
      expect(result.success).toBe(true);
    });

    it('should handle session expiry in the past', () => {
      const dataWithPastExpiry = {
        invitationId: '550e8400-e29b-41d4-a716-446655440017',
        token: 'expired-token',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      const result = candidateSessionDataSchema.safeParse(dataWithPastExpiry);
      expect(result.success).toBe(true); // Schema allows past dates, business logic handles expiry
    });

    it('should handle session expiry far in the future', () => {
      const dataWithFutureExpiry = {
        invitationId: '550e8400-e29b-41d4-a716-446655440018',
        token: 'future-token',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      };

      const result = candidateSessionDataSchema.safeParse(dataWithFutureExpiry);
      expect(result.success).toBe(true);
    });
  });
});