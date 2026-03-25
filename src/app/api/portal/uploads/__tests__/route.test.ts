// /GlobalRX_v2/src/app/api/portal/uploads/__tests__/route.test.ts

// REGRESSION TEST: proves bug fix for document persistence in draft orders
// Bug: File objects cannot be JSON serialized. When the order form saves,
// it calls JSON.stringify() on the request body which includes uploadedDocuments
// containing File objects. When JSON.stringify encounters a File object,
// it converts it to an empty object {}. The documents never reach the server.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('crypto', () => {
  const randomUUIDFn = vi.fn(() => 'test-uuid-1234');
  return {
    default: { randomUUID: randomUUIDFn },
    randomUUID: randomUUIDFn,
  };
});

vi.mock('fs', () => {
  const existsSyncFn = vi.fn();
  const mkdirSyncFn = vi.fn();
  const writeFileSyncFn = vi.fn();
  const unlinkSyncFn = vi.fn();

  return {
    default: {
      existsSync: existsSyncFn,
      mkdirSync: mkdirSyncFn,
      writeFileSync: writeFileSyncFn,
      unlinkSync: unlinkSyncFn,
    },
    existsSync: existsSyncFn,
    mkdirSync: mkdirSyncFn,
    writeFileSync: writeFileSyncFn,
    unlinkSync: unlinkSyncFn,
  };
});

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    extname: vi.fn((filename) => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot === -1 ? '' : filename.substring(lastDot);
    }),
    basename: vi.fn((filename, ext) => {
      if (ext && filename.endsWith(ext)) {
        return filename.substring(0, filename.length - ext.length);
      }
      const lastSlash = filename.lastIndexOf('/');
      return lastSlash === -1 ? filename : filename.substring(lastSlash + 1);
    }),
  },
}));

describe('POST /api/portal/uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('REGRESSION TEST: Document upload for draft orders', () => {
    it('should save uploaded file and return metadata instead of File object', async () => {
      // Mock authenticated session
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      // Mock file system operations
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      // Create a mock file
      const mockFile = new File(['test content'], 'test-document.pdf', {
        type: 'application/pdf'
      });

      // Create FormData
      const formData = new FormData();
      formData.append('file', mockFile);
      formData.append('documentId', 'doc-123');

      // Create mock request
      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      // Call the handler
      const response = await POST(request);
      const data = await response.json();

      // Assert the response contains metadata, not a File object
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toMatchObject({
        documentId: 'doc-123',
        filename: 'test-document.pdf',
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: expect.any(Number),
        uploadedAt: expect.any(String),
        uploadedBy: 'user-123',
      });

      // Verify file path is returned for later retrieval
      expect(data.metadata).toHaveProperty('storagePath');
      expect(data.metadata.storagePath).toContain('uploads');
      expect(data.metadata.storagePath).toContain('test-document.pdf');

      // Ensure no File object is in the response (would fail JSON serialization)
      expect(data.metadata).not.toHaveProperty('file');
      expect(data.metadata).not.toBeInstanceOf(File);

      // Verify file system operations were called
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should reject upload when user is not authenticated', async () => {
      // Mock unauthenticated session
      vi.mocked(getServerSession).mockResolvedValue(null);

      const mockFile = new File(['test content'], 'test-document.pdf', {
        type: 'application/pdf'
      });

      const formData = new FormData();
      formData.append('file', mockFile);
      formData.append('documentId', 'doc-123');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should handle multiple documents for different requirements', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      // Upload first document
      const formData1 = new FormData();
      formData1.append('file', new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }));
      formData1.append('documentId', 'req-001');

      const request1 = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData1,
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();

      // Upload second document
      const formData2 = new FormData();
      formData2.append('file', new File(['content2'], 'doc2.pdf', { type: 'application/pdf' }));
      formData2.append('documentId', 'req-002');

      const request2 = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData2,
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      // Both should succeed with different metadata
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.metadata.documentId).toBe('req-001');
      expect(data2.metadata.documentId).toBe('req-002');
      expect(data1.metadata.filename).not.toBe(data2.metadata.filename);
    });

    it('should replace an already uploaded document when uploading a new one', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      // Mock that old file exists
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true) // uploads directory exists
        .mockReturnValueOnce(true); // old file exists

      vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      const formData = new FormData();
      formData.append('file', new File(['new content'], 'new-doc.pdf', { type: 'application/pdf' }));
      formData.append('documentId', 'doc-123');
      formData.append('previousFile', 'uploads/user-123/doc-123/old-doc.pdf');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.filename).toBe('new-doc.pdf');

      // Verify old file was deleted
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old-doc.pdf'));
      // Verify new file was written
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle document with special characters in filename', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      const specialFilename = 'test & document (2024) #1.pdf';
      const formData = new FormData();
      formData.append('file', new File(['content'], specialFilename, { type: 'application/pdf' }));
      formData.append('documentId', 'doc-123');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Filename should be sanitized
      expect(data.metadata.filename).toMatch(/^[a-zA-Z0-9-_\.]+$/);
      // Original name should be preserved
      expect(data.metadata.originalName).toBe(specialFilename);
    });

    it('should reject non-allowed file types', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      const formData = new FormData();
      formData.append('file', new File(['content'], 'malicious.exe', { type: 'application/x-msdownload' }));
      formData.append('documentId', 'doc-123');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('File type not allowed');
    });

    it('should handle upload failure gracefully', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      // Mock file system error - both mkdir and writeFileSync should fail
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Disk full');
      });
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Cannot write to disk');
      });

      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }));
      formData.append('documentId', 'doc-123');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Failed to upload file');
    });

    it('should enforce file size limits', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      // Create a large file (over 10MB limit)
      const largeContent = new Uint8Array(11 * 1024 * 1024); // 11MB
      const formData = new FormData();
      formData.append('file', new File([largeContent], 'large.pdf', { type: 'application/pdf' }));
      formData.append('documentId', 'doc-123');

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('File size exceeds limit');
    });

    it('should validate required form fields', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      // Missing documentId
      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }));
      // documentId intentionally not included

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Document ID is required');
    });

    it('should handle missing file in request', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      });

      // No file in FormData
      const formData = new FormData();
      formData.append('documentId', 'doc-123');
      // file intentionally not included

      const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('No file provided');
    });
  });
});