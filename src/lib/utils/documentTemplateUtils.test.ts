// /GlobalRX_v2/src/lib/utils/documentTemplateUtils.test.ts
// Unit tests for PDF template utility functions

import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  hasValidTemplate,
  extractTemplateInfo,
  sanitizeFilename,
  isValidDocumentId
} from './documentTemplateUtils';

describe('documentTemplateUtils', () => {
  describe('formatFileSize', () => {
    it('should format bytes to MB with 1 decimal place', () => {
      expect(formatFileSize(0)).toBe('(0.0 MB)');
      expect(formatFileSize(1024)).toBe('(0.0 MB)');
      expect(formatFileSize(1048576)).toBe('(1.0 MB)');
      expect(formatFileSize(2500000)).toBe('(2.4 MB)');
      expect(formatFileSize(10485760)).toBe('(10.0 MB)');
      expect(formatFileSize(104857600)).toBe('(100.0 MB)');
    });

    it('should handle null and undefined', () => {
      expect(formatFileSize(null)).toBe('');
      expect(formatFileSize(undefined)).toBe('');
    });

    it('should handle negative numbers', () => {
      expect(formatFileSize(-100)).toBe('');
      expect(formatFileSize(-1048576)).toBe('');
    });

    it('should round correctly', () => {
      expect(formatFileSize(1572864)).toBe('(1.5 MB)'); // 1.5 MB
      expect(formatFileSize(2621440)).toBe('(2.5 MB)'); // 2.5 MB
      expect(formatFileSize(3670016)).toBe('(3.5 MB)'); // 3.5 MB
    });

    it('should handle very large files', () => {
      expect(formatFileSize(1073741824)).toBe('(1024.0 MB)'); // 1 GB
      expect(formatFileSize(10737418240)).toBe('(10240.0 MB)'); // 10 GB
    });

    it('should handle very small files', () => {
      expect(formatFileSize(1)).toBe('(0.0 MB)');
      expect(formatFileSize(100)).toBe('(0.0 MB)');
      expect(formatFileSize(1000)).toBe('(0.0 MB)');
    });
  });

  describe('hasValidTemplate', () => {
    it('should return true for valid template data', () => {
      expect(hasValidTemplate({ pdfPath: '/uploads/template.pdf' })).toBe(true);
      expect(hasValidTemplate({ pdfPath: '/path/to/file.pdf', filename: 'test.pdf' })).toBe(true);
      expect(hasValidTemplate(JSON.stringify({ pdfPath: '/template.pdf' }))).toBe(true);
    });

    it('should return false when pdfPath is missing', () => {
      expect(hasValidTemplate({})).toBe(false);
      expect(hasValidTemplate({ filename: 'test.pdf' })).toBe(false);
      expect(hasValidTemplate({ pdfPath: null })).toBe(false);
      expect(hasValidTemplate({ pdfPath: undefined })).toBe(false);
    });

    it('should return false for empty pdfPath', () => {
      expect(hasValidTemplate({ pdfPath: '' })).toBe(false);
      expect(hasValidTemplate({ pdfPath: '   ' })).toBe(false);
      expect(hasValidTemplate(JSON.stringify({ pdfPath: '' }))).toBe(false);
    });

    it('should handle null and undefined documentData', () => {
      expect(hasValidTemplate(null)).toBe(false);
      expect(hasValidTemplate(undefined)).toBe(false);
    });

    it('should handle malformed JSON strings', () => {
      expect(hasValidTemplate('not json')).toBe(false);
      expect(hasValidTemplate('{invalid json')).toBe(false);
      expect(hasValidTemplate('{"pdfPath": ')).toBe(false);
    });

    it('should handle both string and object inputs', () => {
      const obj = { pdfPath: '/test.pdf' };
      const str = JSON.stringify(obj);

      expect(hasValidTemplate(obj)).toBe(true);
      expect(hasValidTemplate(str)).toBe(true);
    });
  });

  describe('extractTemplateInfo', () => {
    it('should extract template info from valid data', () => {
      const result = extractTemplateInfo({
        pdfPath: '/uploads/template.pdf',
        filename: 'employment-form.pdf'
      });

      expect(result).toEqual({
        hasTemplate: true,
        pdfPath: '/uploads/template.pdf',
        filename: 'employment-form.pdf'
      });
    });

    it('should extract from JSON string', () => {
      const result = extractTemplateInfo(JSON.stringify({
        pdfPath: '/uploads/template.pdf',
        filename: 'form.pdf'
      }));

      expect(result).toEqual({
        hasTemplate: true,
        pdfPath: '/uploads/template.pdf',
        filename: 'form.pdf'
      });
    });

    it('should return default info when no template', () => {
      const result = extractTemplateInfo({});

      expect(result).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });
    });

    it('should handle missing filename', () => {
      const result = extractTemplateInfo({
        pdfPath: '/uploads/template.pdf'
      });

      expect(result).toEqual({
        hasTemplate: true,
        pdfPath: '/uploads/template.pdf',
        filename: null
      });
    });

    it('should return default for empty pdfPath', () => {
      const result = extractTemplateInfo({
        pdfPath: '',
        filename: 'test.pdf'
      });

      expect(result).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });
    });

    it('should handle null and undefined', () => {
      expect(extractTemplateInfo(null)).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });

      expect(extractTemplateInfo(undefined)).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });
    });

    it('should handle malformed JSON', () => {
      const result = extractTemplateInfo('invalid json');

      expect(result).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });
    });

    it('should handle whitespace in pdfPath', () => {
      const result = extractTemplateInfo({
        pdfPath: '   ',
        filename: 'test.pdf'
      });

      expect(result).toEqual({
        hasTemplate: false,
        pdfPath: null,
        filename: null
      });
    });
  });

  describe('sanitizeFilename', () => {
    it('should return default for null/undefined', () => {
      expect(sanitizeFilename(null)).toBe('document.pdf');
      expect(sanitizeFilename(undefined)).toBe('document.pdf');
      expect(sanitizeFilename('')).toBe('document.pdf');
    });

    it('should preserve valid PDF filenames', () => {
      expect(sanitizeFilename('form.pdf')).toBe('form.pdf');
      expect(sanitizeFilename('employment-verification.pdf')).toBe('employment-verification.pdf');
      expect(sanitizeFilename('2024-03-14-template.pdf')).toBe('2024-03-14-template.pdf');
    });

    it('should add .pdf extension if missing', () => {
      expect(sanitizeFilename('document')).toBe('document.pdf');
      expect(sanitizeFilename('template.txt')).toBe('template.txt.pdf');
      expect(sanitizeFilename('form')).toBe('form.pdf');
    });

    it('should remove path components', () => {
      expect(sanitizeFilename('/uploads/templates/form.pdf')).toBe('form.pdf');
      expect(sanitizeFilename('../../etc/passwd')).toBe('passwd.pdf');
      expect(sanitizeFilename('path/to/file.pdf')).toBe('file.pdf');
    });

    it('should handle case insensitive .pdf extension', () => {
      expect(sanitizeFilename('document.PDF')).toBe('document.PDF');
      expect(sanitizeFilename('form.Pdf')).toBe('form.Pdf');
      expect(sanitizeFilename('template.pDF')).toBe('template.pDF');
    });

    it('should handle special characters', () => {
      expect(sanitizeFilename('form with spaces.pdf')).toBe('form with spaces.pdf');
      expect(sanitizeFilename('template@2024.pdf')).toBe('template@2024.pdf');
      expect(sanitizeFilename('form#1.pdf')).toBe('form#1.pdf');
    });

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(200) + '.pdf';
      expect(sanitizeFilename(longName)).toBe(longName);
    });
  });

  describe('isValidDocumentId', () => {
    it('should validate correct UUID v4 format', () => {
      expect(isValidDocumentId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidDocumentId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidDocumentId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidDocumentId('123')).toBe(false);
      expect(isValidDocumentId('not-a-uuid')).toBe(false);
      expect(isValidDocumentId('12345678-1234-1234-1234-12345678901g')).toBe(false);
      expect(isValidDocumentId('12345678-1234-1234-1234-123456789')).toBe(false);
      expect(isValidDocumentId('')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidDocumentId(null)).toBe(false);
      expect(isValidDocumentId(undefined)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isValidDocumentId('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
      expect(isValidDocumentId('550E8400-e29b-41d4-A716-446655440000')).toBe(true);
    });

    it('should accept UUIDs of any version', () => {
      // UUID v1
      expect(isValidDocumentId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      // UUID v3
      expect(isValidDocumentId('6ba7b810-9dad-31d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject UUIDs with spaces or extra characters', () => {
      expect(isValidDocumentId(' 123e4567-e89b-12d3-a456-426614174000')).toBe(false);
      expect(isValidDocumentId('123e4567-e89b-12d3-a456-426614174000 ')).toBe(false);
      expect(isValidDocumentId('{123e4567-e89b-12d3-a456-426614174000}')).toBe(false);
    });
  });
});