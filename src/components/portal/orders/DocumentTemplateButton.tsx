/**
 * DocumentTemplateButton Component
 *
 * Provides PDF template download functionality for customer order documents.
 * Handles secure template downloads with file validation, error handling,
 * and user feedback. Templates are automatically downloaded as file attachments.
 *
 * Security features:
 * - UUID validation on document IDs
 * - Authenticated API endpoint access only
 * - File size display for user awareness
 * - Graceful error handling with user-friendly messages
 *
 * Usage: Embedded in order creation workflow where document requirements
 * have associated PDF templates that customers can download for completion.
 *
 * @component
 */

'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';

interface DocumentTemplateButtonProps {
  /** Unique identifier for the document requirement */
  documentId: string;
  /** Whether a template is available for this document */
  hasTemplate?: boolean;
  /** File path to the PDF template (for validation) */
  pdfPath?: string | null;
  /** Original filename of the template */
  filename?: string | null;
  /** File size in bytes for display to user */
  fileSize?: number | null;
}

// Format file size for display
const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '';
  const mb = bytes / (1024 * 1024);
  return `(${mb.toFixed(1)} MB)`;
};

export function DocumentTemplateButton({
  documentId,
  hasTemplate = false,
  pdfPath,
  filename,
  fileSize
}: DocumentTemplateButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Don't render if no template available
  if (!hasTemplate && (!pdfPath || pdfPath.trim() === '')) {
    return null;
  }

  // Don't render if documentId is missing or invalid
  if (!documentId) {
    return null;
  }

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      // Call the secure download API endpoint that validates:
      // 1. User authentication and customer access
      // 2. Document ID format (UUID)
      // 3. Template file exists and is readable
      // 4. File size limits and security checks
      const response = await fetch(`/api/portal/documents/${documentId}/download-template`);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error === 'Template file not found'
          ? 'Template file not found. Please contact support.'
          : errorData.error || 'Failed to download template';

        // Log the error for debugging
        clientLogger.warn('Template download failed', {
          documentId,
          error: errorData.error,
          errorMessage,
          status: response.status
        });

        // Show user-friendly error (temporarily using alert until toast is implemented)
        if (typeof window !== 'undefined') {
          window.alert(errorMessage);
        }
        return;
      }

      const blob = await response.blob();

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename = 'document.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      } else if (filename) {
        downloadFilename = filename;
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      clientLogger.error('Download error', errorToLogMeta(error));

      // Show user-friendly error (temporarily using alert until toast is implemented)
      if (typeof window !== 'undefined') {
        window.alert('Failed to download template. Please try again.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Download Form"
    >
      <Download className="w-4 h-4" />
      <span>{isDownloading ? 'Downloading...' : 'Download Form'}</span>
      {fileSize !== null && fileSize !== undefined && !isDownloading && (
        <span className="text-gray-500">{formatFileSize(fileSize)}</span>
      )}
    </button>
  );
}