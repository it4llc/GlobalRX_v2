// src/lib/services/__tests__/document-download.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateFilePath } from '../document-download.service';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('document-download.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFilePath', () => {
    it('returns true for a safe relative path like uploads/draft-documents/abc/file.pdf', () => {
      const result = validateFilePath('uploads/draft-documents/abc/file.pdf');
      expect(result).toBe(true);
    });

    it('returns false for a path containing ..', () => {
      const result = validateFilePath('../../../etc/passwd');
      expect(result).toBe(false);
    });

    it('returns false for an absolute path starting with /', () => {
      const result = validateFilePath('/etc/passwd');
      expect(result).toBe(false);
    });
  });
});