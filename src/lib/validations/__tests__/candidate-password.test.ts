// /GlobalRX_v2/src/lib/validations/__tests__/candidate-password.test.ts

import { describe, it, expect } from 'vitest';
import { passwordCreationSchema } from '../candidate-password';

describe('Candidate Password Creation Schema Validation', () => {
  describe('password field validation', () => {
    it('should reject password shorter than 8 characters', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'Short1'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
        expect(result.error.issues[0].message).toContain('8 characters');
      }
    });

    it('should reject password without a letter', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: '12345678'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
        expect(result.error.issues[0].message).toContain('letter');
      }
    });

    it('should reject password without a number', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'NoNumbers'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
        expect(result.error.issues[0].message).toContain('number');
      }
    });

    it('should reject password with only spaces', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: '        '
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
      }
    });

    it('should accept valid password with 8 characters including letter and number', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'Valid123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('Valid123');
      }
    });

    it('should accept valid password with special characters', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'Complex@Pass123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('Complex@Pass123');
      }
    });

    it('should accept valid password with uppercase and lowercase letters', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'LowerUPPER123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('LowerUPPER123');
      }
    });

    it('should accept password exactly 8 characters long', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'Exact8Ch'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('Exact8Ch');
      }
    });

    it('should accept very long password that meets requirements', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token-123',
        password: 'ThisIsAVeryLongPasswordWithNumbers123AndItShouldBeAccepted'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('ThisIsAVeryLongPasswordWithNumbers123AndItShouldBeAccepted');
      }
    });
  });

  describe('token field validation', () => {
    it('should reject missing token', () => {
      const result = passwordCreationSchema.safeParse({
        password: 'ValidPass123'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('token');
      }
    });

    it('should reject empty token', () => {
      const result = passwordCreationSchema.safeParse({
        token: '',
        password: 'ValidPass123'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('token');
      }
    });

    it('should accept valid token', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'abc-123-xyz-789',
        password: 'ValidPass123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('abc-123-xyz-789');
      }
    });

    it('should trim whitespace from token', () => {
      const result = passwordCreationSchema.safeParse({
        token: '  token-with-spaces  ',
        password: 'ValidPass123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('token-with-spaces');
      }
    });
  });

  describe('both fields together', () => {
    it('should reject when both fields are missing', () => {
      const result = passwordCreationSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should reject when password is missing', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('password');
      }
    });

    it('should accept valid token and password combination', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-invitation-token-123',
        password: 'SecurePassword123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('valid-invitation-token-123');
        expect(result.data.password).toBe('SecurePassword123');
      }
    });

    it('should reject extra fields not in schema', () => {
      const result = passwordCreationSchema.safeParse({
        token: 'valid-token',
        password: 'ValidPass123',
        extraField: 'should-not-be-here'
      });

      // Schema should strip extra fields or reject them
      expect(result.success).toBe(true);
      if (result.success) {
        expect('extraField' in result.data).toBe(false);
      }
    });
  });
});