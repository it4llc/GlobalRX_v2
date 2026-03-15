/**
 * useDocumentTemplate Hook
 *
 * React hook that manages PDF template download functionality with state management.
 * Handles template metadata parsing, download state, and error management.
 *
 * Features:
 * - Automatic JSON parsing for template metadata
 * - Loading states during download
 * - Error handling with user-friendly messages
 * - Field name normalization for legacy/new data formats
 *
 * @param documentId - UUID of the document requirement
 * @param initialData - Template metadata from document data (JSON string or object)
 * @returns Template data, download function, loading state, and error state
 */

import { useState } from 'react';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';

interface DocumentTemplateData {
  pdfPath?: string | null;
  pdfFilename?: string | null;
  filename?: string | null;
  pdfFileSize?: number | null;
  fileSize?: number | null;
  instructions?: string | null;
  [key: string]: unknown; // Allow other fields
}

interface UseDocumentTemplateReturn {
  templateData: DocumentTemplateData | null;
  isDownloading: boolean;
  error: string | null;
  downloadTemplate: () => Promise<void>;
}

interface ErrorResponse {
  error?: string;
  message?: string;
}

export function useDocumentTemplate(
  documentId: string,
  initialData?: DocumentTemplateData | string
): UseDocumentTemplateReturn {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse initial data if it's a string
  let templateData: DocumentTemplateData | null = null;
  if (initialData) {
    try {
      let parsedData: DocumentTemplateData;
      if (typeof initialData === 'string') {
        parsedData = JSON.parse(initialData);
      } else {
        parsedData = initialData;
      }

      // Normalize field names to handle both legacy and new naming conventions
      // Legacy: pdfFilename, pdfFileSize
      // New: filename, fileSize
      templateData = {
        ...parsedData,
        filename: parsedData.filename || parsedData.pdfFilename || null,
        fileSize: parsedData.fileSize || parsedData.pdfFileSize || null
      };
    } catch {
      templateData = null;
    }
  }

  const downloadTemplate = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(`/api/portal/documents/${documentId}/download-template`);

      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse;
        throw new Error(errorData.error || errorData.message || 'Failed to download template');
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
      } else if (templateData?.pdfFilename || templateData?.filename) {
        downloadFilename = templateData.pdfFilename || templateData.filename || 'document.pdf';
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download template';
      setError(errorMessage);
      clientLogger.error('Download error', errorToLogMeta(err));
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    templateData,
    isDownloading,
    error,
    downloadTemplate
  };
}