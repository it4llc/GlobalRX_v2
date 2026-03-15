// /GlobalRX_v2/src/hooks/__tests__/useDocumentTemplate.test.ts
// Unit tests for useDocumentTemplate hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useDocumentTemplate } from '../useDocumentTemplate';

// Mock fetch globally
global.fetch = vi.fn();

// Mock URL methods
global.URL.createObjectURL = vi.fn(() => 'blob:url');
global.URL.revokeObjectURL = vi.fn();

// Mock document methods
const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(),
  remove: vi.fn()
};

// Store the original createElement before mocking
const originalCreateElement = document.createElement.bind(document);

describe('useDocumentTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();

    // Reset mock anchor element
    mockAnchor.href = '';
    mockAnchor.download = '';
    mockAnchor.click.mockClear();
    mockAnchor.remove.mockClear();

    // Mock document.createElement to return our mock anchor
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as any;
      return originalCreateElement(tagName);
    });

    // Mock document.body methods
    vi.spyOn(document.body, 'appendChild').mockImplementation((element) => element);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should parse string documentData', () => {
      const documentData = JSON.stringify({
        pdfPath: '/template.pdf',
        pdfFilename: 'form.pdf',
        pdfFileSize: 1000000
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', documentData)
      );

      expect(result.current.templateData).toEqual({
        pdfPath: '/template.pdf',
        pdfFilename: 'form.pdf',
        filename: 'form.pdf',
        pdfFileSize: 1000000,
        fileSize: 1000000
      });
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle object documentData', () => {
      const documentData = {
        pdfPath: '/template.pdf',
        pdfFilename: 'form.pdf',
        pdfFileSize: 1000000
      };

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', documentData)
      );

      expect(result.current.templateData).toEqual({
        pdfPath: '/template.pdf',
        pdfFilename: 'form.pdf',
        filename: 'form.pdf',
        pdfFileSize: 1000000,
        fileSize: 1000000
      });
    });

    it('should handle null documentData', () => {
      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', null)
      );

      expect(result.current.templateData).toBeNull();
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle malformed JSON documentData', () => {
      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', 'not valid json{')
      );

      expect(result.current.templateData).toBeNull();
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing template path', () => {
      const documentData = {
        instructions: 'Some instructions'
      };

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', documentData)
      );

      expect(result.current.templateData).toEqual({
        instructions: 'Some instructions',
        filename: null,
        fileSize: null
      });
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('downloadTemplate', () => {
    it('should successfully download template', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockHeaders = new Headers();
      mockHeaders.set('Content-Disposition', 'attachment; filename="downloaded.pdf"');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: mockHeaders
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf', pdfFilename: 'form.pdf' })
      );

      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/portal/documents/doc-123/download-template');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockAnchor.href).toBe('blob:url');
      expect(mockAnchor.download).toBe('downloaded.pdf');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    });

    it('should handle download failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Template not found' })
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf' })
      );

      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(result.current.error).toBe('Template not found');
      expect(mockAnchor.click).not.toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf' })
      );

      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(result.current.error).toBe('Network error');
      expect(mockAnchor.click).not.toHaveBeenCalled();
    });

    it('should use template filename when no Content-Disposition header', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockHeaders = new Headers();
      // No Content-Disposition header

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: mockHeaders
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf', pdfFilename: 'mytemplate.pdf' })
      );

      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(mockAnchor.download).toBe('mytemplate.pdf');
    });

    it('should fall back to document.pdf when no filename available', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      const mockHeaders = new Headers();
      // No Content-Disposition header

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: mockHeaders
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf' })
      );

      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(mockAnchor.download).toBe('document.pdf');
    });

    it('should not download when already downloading', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });

      // Mock a slow response
      (global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          blob: async () => mockBlob,
          headers: new Headers()
        }), 100))
      );

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf' })
      );

      // Start first download
      act(() => {
        result.current.downloadTemplate();
      });

      // Try to start second download immediately
      act(() => {
        result.current.downloadTemplate();
      });

      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('state updates', () => {
    it('should update template data when documentData changes', () => {
      const { result, rerender } = renderHook(
        ({ documentId, documentData }) => useDocumentTemplate(documentId, documentData),
        {
          initialProps: {
            documentId: 'doc-123',
            documentData: { pdfPath: '/template1.pdf' }
          }
        }
      );

      expect(result.current.templateData).toEqual({
        pdfPath: '/template1.pdf',
        filename: null,
        fileSize: null
      });

      // Update props with new documentData
      rerender({
        documentId: 'doc-123',
        documentData: { pdfPath: '/template2.pdf', pdfFilename: 'new.pdf' }
      });

      expect(result.current.templateData).toEqual({
        pdfPath: '/template2.pdf',
        pdfFilename: 'new.pdf',
        filename: 'new.pdf',
        fileSize: null
      });
    });

    it('should clear error on successful download', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });

      // First call fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Template not found' })
      });

      const { result } = renderHook(() =>
        useDocumentTemplate('doc-123', { pdfPath: '/template.pdf' })
      );

      // First download fails
      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(result.current.error).toBe('Template not found');

      // Second call succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: new Headers()
      });

      // Second download succeeds
      await act(async () => {
        await result.current.downloadTemplate();
      });

      expect(result.current.error).toBeNull();
    });
  });
});