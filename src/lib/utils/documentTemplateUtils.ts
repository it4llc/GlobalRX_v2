// /GlobalRX_v2/src/lib/utils/documentTemplateUtils.ts
// Utility functions for PDF template download feature

// Type for document data that may come from database
interface DocumentData {
  pdfPath?: string | null;
  pdfFilename?: string | null;
  filename?: string | null;
  pdfFileSize?: number | null;
  fileSize?: number | null;
  instructions?: string | null;
  [key: string]: unknown; // Allow other fields
}

/**
 * Formats file size from bytes to human-readable MB format
 * @param bytes - File size in bytes
 * @returns Formatted string like "(2.5 MB)" or empty string if invalid
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes == null || bytes < 0) return '';
  const mb = bytes / (1024 * 1024);
  return `(${mb.toFixed(1)} MB)`;
};

/**
 * Checks if document data contains a valid template
 * @param documentData - Document data object or JSON string
 * @returns True if a valid PDF template path exists
 */
export const hasValidTemplate = (documentData: DocumentData | string | null | undefined): boolean => {
  if (!documentData) return false;

  try {
    const data = typeof documentData === 'string'
      ? JSON.parse(documentData)
      : documentData;

    return !!(data.pdfPath && data.pdfPath.trim() !== '');
  } catch {
    return false;
  }
};

/**
 * Extracts template information from document data
 * @param documentData - Document data object or JSON string
 * @returns Template information including path and filename
 */
export const extractTemplateInfo = (documentData: DocumentData | string | null | undefined): {
  hasTemplate: boolean;
  pdfPath: string | null;
  filename: string | null;
} => {
  const defaultInfo = {
    hasTemplate: false,
    pdfPath: null,
    filename: null
  };

  if (!documentData) return defaultInfo;

  try {
    const data = typeof documentData === 'string'
      ? JSON.parse(documentData)
      : documentData;

    if (!data.pdfPath || data.pdfPath.trim() === '') {
      return defaultInfo;
    }

    return {
      hasTemplate: true,
      pdfPath: data.pdfPath,
      filename: data.filename || null
    };
  } catch {
    return defaultInfo;
  }
};

/**
 * Sanitizes filename for safe download
 * @param filename - Original filename
 * @returns Sanitized filename with .pdf extension
 */
export const sanitizeFilename = (filename: string | null | undefined): string => {
  if (!filename) return 'document.pdf';

  // Remove any path components, keep only the filename
  const name = filename.split('/').pop() || 'document.pdf';

  // Ensure it ends with .pdf
  if (!name.toLowerCase().endsWith('.pdf')) {
    return `${name}.pdf`;
  }

  return name;
};

/**
 * Validates if a string is a valid UUID format
 * @param id - String to validate
 * @returns True if valid UUID format
 */
export const isValidDocumentId = (id: string | null | undefined): boolean => {
  if (!id) return false;

  // UUID regex pattern (any version)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};