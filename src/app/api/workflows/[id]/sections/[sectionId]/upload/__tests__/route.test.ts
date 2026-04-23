// /GlobalRX_v2/src/app/api/workflows/[id]/sections/[sectionId]/upload/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import fsPromises from 'fs/promises';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-uuid-1234')
  },
  randomUUID: vi.fn(() => 'test-uuid-1234')
}));

vi.mock('fs', () => {
  const existsSyncFn = vi.fn();
  const mkdirSyncFn = vi.fn();
  const writeFileSyncFn = vi.fn();

  return {
    default: {
      existsSync: existsSyncFn
    },
    existsSync: existsSyncFn
  };
});

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn()
  },
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn()
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    extname: vi.fn((filename) => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot === -1 ? '' : filename.substring(lastDot);
    })
  }
}));

// Import mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('POST /api/workflows/[id]/sections/[sectionId]/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(false);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
    });

    it('should return 400 when no file provided', async () => {
      const formData = new FormData();

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No file provided');
    });

    it('should accept PDF files', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        type: 'document'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.workflowSection.update).mockResolvedValueOnce({
        id: '456',
        fileUrl: 'uploads/workflow-documents/123/456/test-uuid_test.pdf',
        fileName: 'test.pdf'
      } as any);

      const formData = new FormData();
      formData.append('file', new File(['test content'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.fileName).toBe('test.pdf');
    });

    it('should accept DOCX files', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        type: 'document'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.workflowSection.update).mockResolvedValueOnce({
        id: '456',
        fileUrl: 'uploads/workflow-documents/123/456/test-uuid_test.docx',
        fileName: 'test.docx'
      } as any);

      const formData = new FormData();
      formData.append('file', new File(['test content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.fileName).toBe('test.docx');
    });

    it('should reject other file types', async () => {
      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid file type');
      expect(data.message).toContain('.jpg');
    });

    it('should reject files over 10MB', async () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', largeFile);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('File too large');
    });
  });

  describe('business rules', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({ id: '123' } as any);
    });

    it('should return 400 when section type is not document', async () => {
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        type: 'text' // Wrong type
      } as any);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid section type');
      expect(data.message).toContain('document');
    });

    it('should return 409 when workflow has active orders', async () => {
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        type: 'document'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1); // Has active orders

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Cannot modify workflow with active orders');
    });

    it('should delete old file when uploading replacement', async () => {
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        type: 'document',
        fileUrl: 'uploads/old-file.pdf'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // upload dir doesn't exist
        .mockReturnValueOnce(true); // old file exists
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.unlink).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.workflowSection.update).mockResolvedValueOnce({
        id: '456',
        fileUrl: 'uploads/workflow-documents/123/456/test-uuid_new.pdf',
        fileName: 'new.pdf'
      } as any);

      const formData = new FormData();
      formData.append('file', new File(['new content'], 'new.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(201);
      expect(vi.mocked(fsPromises.unlink)).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({ id: '123' } as any);
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValue({
        id: '456',
        workflowId: '123',
        type: 'document'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
    });

    it('should return 404 when workflow not found', async () => {
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Workflow not found');
    });

    it('should return 404 when section not found', async () => {
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456/upload', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Section not found');
    });
  });
});