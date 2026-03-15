// /GlobalRX_v2/src/app/api/portal/documents/[id]/download-template/__tests__/route.test.ts
// API route tests for PDF template download endpoint

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXRequirement: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((path) => {
    // Simulate path resolution to handle path traversal
    if (path.includes('..')) {
      // Simplified: if path contains .., resolve to something outside of public
      return '/etc/passwd';
    }
    return path;
  })
}));

describe('GET /api/portal/documents/[id]/download-template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not a customer user', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Access denied');
    });

    it('should allow customer users to proceed', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          customerId: 'cust-123'
        }
      });

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      // Should fail with 404 (document not found) rather than 403
      expect(response.status).toBe(404);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          customerId: 'cust-123'
        }
      });
    });

    it('should return 404 when document ID is not a valid UUID', async () => {
      const request = new Request('http://localhost:3000/api/portal/documents/not-a-uuid/download-template');
      const response = await GET(request, { params: { id: 'not-a-uuid' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Document not found');
    });

    it('should return 404 when document does not exist', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Document not found');
    });

    it('should return 404 when document has no PDF template', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({}), // No pdfPath
        disabled: false
      });

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('No template available for this document');
    });

    it('should return 404 when pdfPath is empty string', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({ pdfPath: '' }), // Empty string
        disabled: false
      });

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('No template available for this document');
    });

    it('should return 404 when document is disabled', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({ pdfPath: '/template.pdf' }),
        disabled: true // Disabled document
      } as any);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('This document template is no longer available');
    });

    it('should handle malformed documentData JSON', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: 'not valid json{', // Malformed JSON
        disabled: false
      } as any);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('No template available for this document');
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          customerId: 'cust-123'
        }
      });
    });

    it('should return 404 when PDF file does not exist on server', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({ pdfPath: '/uploads/template.pdf' }),
        disabled: false
      });

      vi.mocked(fs.stat).mockRejectedValueOnce(new Error('ENOENT: File not found'));

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Template file not found. Please contact support.');
    });

    it('should return PDF file with correct headers on success', async () => {
      const mockPdfContent = Buffer.from('PDF content');
      const mockFileStat = { size: 1024 };

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/employment-form.pdf',
          filename: 'employment-verification.pdf'
        }),
        disabled: false
      });

      vi.mocked(fs.stat).mockResolvedValueOnce(mockFileStat);
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockPdfContent);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="employment-verification.pdf"');
      expect(response.headers.get('Content-Length')).toBe('1024');

      const blob = await response.blob();
      expect(blob.size).toBe(mockPdfContent.length);
    });

    it('should use original filename from documentData if available', async () => {
      const mockPdfContent = Buffer.from('PDF content');

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/template.pdf',
          filename: 'custom-form-name.pdf'
        }),
        disabled: false
      });

      vi.mocked(fs.stat).mockResolvedValueOnce({ size: 2048 });
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockPdfContent);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="custom-form-name.pdf"');
    });

    it('should fallback to default filename if not provided', async () => {
      const mockPdfContent = Buffer.from('PDF content');

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/template.pdf'
          // No filename provided
        }),
        disabled: false
      });

      vi.mocked(fs.stat).mockResolvedValueOnce({ size: 2048 });
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockPdfContent);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="document.pdf"');
    });

    it('should handle large PDF files correctly', async () => {
      const largePdfSize = 50 * 1024 * 1024; // 50 MB
      const mockPdfContent = Buffer.alloc(largePdfSize);

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Large Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/large-template.pdf',
          filename: 'large-form.pdf'
        }),
        disabled: false
      });

      vi.mocked(fs.stat).mockResolvedValueOnce({ size: largePdfSize });
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockPdfContent);

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(largePdfSize.toString());
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          customerId: 'cust-123'
        }
      });
    });

    it('should return 500 when database query fails', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 when file read fails', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/template.pdf',
          filename: 'form.pdf'
        }),
        disabled: false
      });

      vi.mocked(fs.stat).mockResolvedValueOnce({ size: 1024 });
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('Permission denied'));

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Error reading template file');
    });

    it('should handle path traversal attempts safely', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '../../etc/passwd' // Path traversal attempt
        }),
        disabled: false
      });

      const request = new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template');
      const response = await GET(request, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } });

      // Should fail with 400 Bad Request for path traversal attempts
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid template path');
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple simultaneous download requests', async () => {
      const mockPdfContent = Buffer.from('PDF content');

      // Set up mocks for multiple requests
      const sessionMock = {
        user: {
          id: '1',
          userType: 'customer',
          customerId: 'cust-123'
        }
      };

      const documentMock = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Document',
        documentData: JSON.stringify({
          pdfPath: '/uploads/template.pdf',
          filename: 'form.pdf'
        }),
        disabled: false
      };

      // Mock for 3 concurrent requests
      vi.mocked(getServerSession)
        .mockResolvedValueOnce(sessionMock)
        .mockResolvedValueOnce(sessionMock)
        .mockResolvedValueOnce(sessionMock);

      vi.mocked(prisma.dSXRequirement.findUnique)
        .mockResolvedValueOnce(documentMock)
        .mockResolvedValueOnce(documentMock)
        .mockResolvedValueOnce(documentMock);

      vi.mocked(fs.stat)
        .mockResolvedValue({ size: 1024 });

      vi.mocked(fs.readFile)
        .mockResolvedValue(mockPdfContent);

      // Make 3 concurrent requests
      const requests = Array.from({ length: 3 }, () =>
        new Request('http://localhost:3000/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template')
      );

      const responses = await Promise.all(
        requests.map(req => GET(req, { params: { id: '123e4567-e89b-12d3-a456-426614174000' } }))
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
      });
    });
  });
});