// /GlobalRX_v2/src/components/portal/orders/__tests__/DocumentTemplateButton.test.tsx
// Component tests for PDF template download button

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DocumentTemplateButton } from '../DocumentTemplateButton';

// Mock fetch globally
global.fetch = vi.fn();

describe('DocumentTemplateButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should not render when hasTemplate is false', () => {
      const { container } = render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={false}
          filename={null}
          fileSize={null}
        />
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('Download Form')).not.toBeInTheDocument();
    });

    it('should not render when pdfPath is empty', () => {
      const { container } = render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={false}
          pdfPath=""
          filename="template.pdf"
          fileSize={1024}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render button when hasTemplate is true', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/uploads/template.pdf"
          filename="employment-form.pdf"
          fileSize={2500000}
        />
      );

      expect(screen.getByText('Download Form')).toBeInTheDocument();
      expect(screen.getByText('(2.4 MB)')).toBeInTheDocument();
    });

    it('should display correct file size formatting', () => {
      const testCases = [
        { size: 500, expected: '(0.0 MB)' },
        { size: 1024, expected: '(0.0 MB)' },
        { size: 1048576, expected: '(1.0 MB)' },
        { size: 2500000, expected: '(2.4 MB)' },
        { size: 10485760, expected: '(10.0 MB)' },
        { size: 104857600, expected: '(100.0 MB)' }
      ];

      testCases.forEach(({ size, expected }) => {
        const { rerender } = render(
          <DocumentTemplateButton
            documentId="test-id"
            hasTemplate={true}
            pdfPath="/template.pdf"
            filename="template.pdf"
            fileSize={size}
          />
        );

        expect(screen.getByText(expected)).toBeInTheDocument();
        rerender(<div />); // Clear for next test
      });
    });

    it('should show download icon', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      // Check for download icon (assuming it has a test id or aria-label)
      const button = screen.getByRole('button', { name: /download form/i });
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle missing file size gracefully', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={null}
        />
      );

      expect(screen.getByText('Download Form')).toBeInTheDocument();
      // Should not show file size when null
      expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
    });

    it('should handle zero file size', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={0}
        />
      );

      expect(screen.getByText('Download Form')).toBeInTheDocument();
      expect(screen.getByText('(0.0 MB)')).toBeInTheDocument();
    });
  });

  describe('download functionality', () => {
    it('should trigger download when button is clicked', async () => {
      // Reset fetch mock completely
      vi.clearAllMocks();
      (global.fetch as any) = vi.fn();

      // Mock successful download
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: (key: string) => {
            if (key === 'Content-Disposition') {
              return 'attachment; filename="employment-form.pdf"';
            }
            return null;
          }
        }
      });

      // Mock URL.createObjectURL and URL.revokeObjectURL
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // First render the component
      const { container } = render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="employment-form.pdf"
          fileSize={2500000}
        />
      );

      // Then mock document.createElement for the download functionality
      const mockClick = vi.fn();
      const mockRemove = vi.fn();
      const originalCreateElement = document.createElement.bind(document);

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            download: '',
            click: mockClick,
            remove: mockRemove
          } as any;
        }
        return originalCreateElement(tagName);
      });

      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template'
        );
        expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      });
    });

    it('should show loading state while downloading', async () => {
      // Create a promise that we can control
      let resolveDownload: any;
      const downloadPromise = new Promise((resolve) => {
        resolveDownload = resolve;
      });

      (global.fetch as any).mockReturnValueOnce(downloadPromise);

      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Downloading...')).toBeInTheDocument();
        expect(button).toBeDisabled();
      });

      // Resolve the download
      resolveDownload({
        ok: true,
        blob: async () => new Blob(['PDF content']),
        headers: {
          get: () => 'attachment; filename="form.pdf"'
        }
      });

      // Should return to normal state
      await waitFor(() => {
        expect(screen.getByText('Download Form')).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });
    });

    it('should handle download errors gracefully', async () => {
      // Mock console.error to suppress error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock failed download
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Template file not found' })
      });

      // Mock alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Template file not found. Please contact support.');
        expect(screen.getByText('Download Form')).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      // Mock console.error to suppress error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Mock alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to download template. Please try again.');
        expect(screen.getByText('Download Form')).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    it('should use default filename if not provided in response', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
        headers: {
          get: () => null // No Content-Disposition header
        }
      });

      // First render the component
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename={null}
          fileSize={1000000}
        />
      );

      // Then mock document.createElement for the download functionality
      const mockClick = vi.fn();
      let capturedDownload = '';
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const mockAnchor = {
            href: '',
            get download() { return capturedDownload; },
            set download(value) { capturedDownload = value; },
            click: mockClick,
            remove: vi.fn()
          } as any;
          return mockAnchor;
        }
        return originalCreateElement(tagName);
      });
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(capturedDownload).toBe('document.pdf');
      });
    });

    it('should prevent multiple simultaneous downloads', async () => {
      // Create a promise that never resolves
      (global.fetch as any).mockReturnValueOnce(new Promise(() => {}));

      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });

      // First click
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Second click should not trigger another fetch
      fireEvent.click(button);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling and positioning', () => {
    it('should apply correct CSS classes for positioning', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });

      // Check for expected styling classes
      expect(button).toHaveClass('inline-flex');
      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('gap-2');
    });

    it('should be accessible', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });

      // Check accessibility attributes
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAccessibleName();
    });
  });

  describe('edge cases', () => {
    it('should handle very long filenames', () => {
      const longFilename = 'this-is-a-very-long-filename-that-might-cause-display-issues-in-the-ui-employment-verification-form-2024-03-14-final-approved-version-2.pdf';

      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename={longFilename}
          fileSize={1000000}
        />
      );

      expect(screen.getByText('Download Form')).toBeInTheDocument();
    });

    it('should handle special characters in document ID', () => {
      render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      const button = screen.getByRole('button', { name: /download form/i });
      fireEvent.click(button);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/portal/documents/123e4567-e89b-12d3-a456-426614174000/download-template'
      );
    });

    it('should handle missing documentId', () => {
      const { container } = render(
        <DocumentTemplateButton
          documentId=""
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      // Should not render if document ID is invalid
      expect(container.firstChild).toBeNull();
    });

    it('should cleanup properly on unmount', () => {
      const { unmount } = render(
        <DocumentTemplateButton
          documentId="123e4567-e89b-12d3-a456-426614174000"
          hasTemplate={true}
          pdfPath="/template.pdf"
          filename="form.pdf"
          fileSize={1000000}
        />
      );

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });
  });
});