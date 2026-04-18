// src/components/services/ServiceRequirementsDisplay.tsx
//
// Displays service-specific requirements collected during order submission.
// Supports two data formats:
//   1. Hydrated data (Phase 1+): Resolved labels, formatted addresses, parsed documents
//   2. Legacy data (backward compatible): Raw key/value pairs from OrderData
//
// When hydratedData is provided it takes priority. The legacy orderData
// rendering is kept as a fallback for any caller that hasn't been updated yet.

import React from 'react';
import type { OrderData } from '@/lib/schemas/service-order-data.schemas';
import type { HydratedOrderDataRecord } from '@/types/order-data-hydration';
import { isAddressRecord, isDocumentRecord } from '@/types/order-data-hydration';

interface ServiceRequirementsDisplayProps {
  /** Legacy raw key/value data — kept for backward compatibility */
  orderData?: OrderData | null;
  /** Hydrated display-ready records — preferred when available */
  hydratedData?: HydratedOrderDataRecord[] | null;
  serviceName?: string;
  isLoading?: boolean;
  /** User type for determining which API endpoint to use for document downloads */
  userType?: string;
}

/**
 * Format byte count into a human-readable file size string.
 * Used for document-type fields to show "271 KB" instead of raw bytes.
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Format ISO date strings as MM/DD/YYYY for display.
 * Returns the original string unchanged if it's not a recognizable date.
 */
const formatDate = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}($|T)/.test(value)) {
    const parts = value.split(/[-T]/);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
    }
  }
  return value;
};

/**
 * Format a raw field value for the legacy (non-hydrated) rendering path.
 * Handles null, booleans, arrays, objects, dates, and multiline text.
 */
const formatLegacyValue = (value: unknown): { text: string; isMultiline: boolean } => {
  if (value === null || value === undefined || value === '') {
    return { text: '--', isMultiline: false };
  }
  if (typeof value === 'boolean') {
    return { text: value ? 'Yes' : 'No', isMultiline: false };
  }
  if (Array.isArray(value)) {
    return { text: value.join(', '), isMultiline: false };
  }
  if (typeof value === 'object') {
    return { text: '[object]', isMultiline: false };
  }

  const stringValue = String(value);

  // Try to format as date
  if (typeof value === 'string' && value.length <= 50) {
    const formatted = formatDate(value);
    if (formatted !== value) {
      return { text: formatted, isMultiline: false };
    }
  }

  return { text: stringValue, isMultiline: stringValue.includes('\n') };
};

/**
 * Displays service-specific requirements collected during order submission.
 *
 * Business Rules:
 * - Shows all orderData fields with readable labels
 * - Displays "No additional requirements" when orderData is empty or null
 * - Fields displayed in the order they were entered
 * - All users who can view a service can see all its requirement fields
 * - Read-only display (no editing capabilities)
 * - Formats dates as MM/DD/YYYY
 * - Preserves line breaks in multi-line text
 * - Properly handles special characters
 *
 * Hydrated Data Rendering (Phase 1):
 * - Text fields: resolved label + formatted display value
 * - Address blocks: parent label as heading, each enabled piece on its own labeled line
 * - Documents: resolved label + filename with file size
 */
export const ServiceRequirementsDisplay = React.memo(({
  orderData,
  hydratedData,
  serviceName = '',
  userType,
}: ServiceRequirementsDisplayProps) => {
  const hasHydratedData = hydratedData && hydratedData.length > 0;
  const hasLegacyData = orderData && typeof orderData === 'object' && Object.keys(orderData).length > 0;
  const hasData = hasHydratedData || hasLegacyData;

  return (
    <section
      data-testid="service-requirements-section"
      className="bg-white rounded-lg p-4"
      aria-label="Submitted Information"
      tabIndex={0}
    >
      <div data-testid="service-requirements-display" className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900">Submitted Information</h3>

        {hasHydratedData ? (
          /* ── Hydrated data rendering ─────────────────────────────────
             Resolved labels, formatted addresses, parsed documents.
             This path is active once the API returns hydratedOrderData. */
          <dl className="space-y-3" data-testid="hydrated-requirements">
            {console.log('HYDRATED DATA:', hydratedData), hydratedData!.map((record) => {

              {/* Address block: parent label as heading, each piece on its own labeled line */}
              if (isAddressRecord(record)) {
                return (
                  <div
                    key={record.requirementId}
                    data-testid={`field-container-${record.fieldKey}`}
                    className="py-1"
                  >
                    <dt
                      data-testid={`field-label-${record.fieldKey}`}
                      className="text-sm font-medium text-gray-600"
                    >
                      {record.label}
                    </dt>
                    <dd className="mt-1 ml-4 space-y-1">
                      {record.addressPieces.map((piece) => (
                        <div
                          key={piece.key}
                          data-testid={`address-piece-${record.fieldKey}-${piece.key}`}
                          className="flex flex-col sm:flex-row sm:gap-2"
                        >
                          <span className="text-xs font-medium text-gray-500 sm:min-w-[140px]">
                            {piece.label}:
                          </span>
                          <span className="text-sm text-gray-900">
                            {piece.value || '--'}
                          </span>
                        </div>
                      ))}
                    </dd>
                  </div>
                );
              }

              {/* Document: label + filename with file size */}
              if (isDocumentRecord(record)) {
                console.log('DOCUMENT RECORD:', record.requirementId, record.orderDataId, record.document);
                // Determine the download URL based on user type
                const downloadUrl = userType === 'customer'
                  ? `/api/portal/documents/${record.orderDataId}`
                  : `/api/fulfillment/documents/${record.orderDataId}`;

                return (
                  <div
                    key={record.requirementId}
                    data-testid={`field-container-${record.fieldKey}`}
                    className="flex flex-col sm:flex-row sm:gap-2 py-1"
                  >
                    <dt
                      data-testid={`field-label-${record.fieldKey}`}
                      className="text-sm font-medium text-gray-600 sm:min-w-[200px]"
                    >
                      {record.label}
                    </dt>
                    <dd
                      data-testid={`field-value-${record.fieldKey}`}
                      className="text-sm text-gray-900"
                    >
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        data-testid={`document-link-${record.fieldKey}`}
                      >
                        <span>{record.document.filename}</span>
                        {record.document.size > 0 && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({formatFileSize(record.document.size)})
                          </span>
                        )}
                      </a>
                    </dd>
                  </div>
                );
              }

              {/* Text / date / other fields: label + display value */}
              const displayText = record.displayValue || '--';
              const formattedText = formatDate(displayText);
              const isMultiline = formattedText.includes('\n');

              return (
                <div
                  key={record.requirementId}
                  data-testid={`field-container-${record.fieldKey}`}
                  className="flex flex-col sm:flex-row sm:gap-2 py-1"
                  aria-label={`${record.label}: ${formattedText}`}
                >
                  <dt
                    data-testid={`field-label-${record.fieldKey}`}
                    className="text-sm font-medium text-gray-600 sm:min-w-[200px]"
                  >
                    {record.label}
                  </dt>
                  <dd
                    data-testid={`field-value-${record.fieldKey}`}
                    className={`text-sm text-gray-900 break-words ${isMultiline ? 'whitespace-pre-line' : ''}`}
                  >
                    {/* WHY USE CSS FOR MULTILINE TEXT:
                        We use CSS classes instead of dangerouslySetInnerHTML
                        to prevent XSS attacks. This safely preserves line breaks without
                        allowing HTML injection through user-submitted order data. */}
                    {isMultiline ? (
                      <span className="whitespace-pre-wrap">{formattedText}</span>
                    ) : (
                      formattedText
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : hasLegacyData ? (
          /* ── Legacy rendering (backward compatibility) ───────────────
             Raw key/value pairs. Active when hydratedData is not available,
             e.g. from callers that haven't been updated yet. */
          <dl className="space-y-2" data-testid="legacy-requirements">
            {Object.entries(orderData!).map(([key, value]) => {
              const { text, isMultiline } = formatLegacyValue(value);

              return (
                <div
                  key={key}
                  data-testid={`field-container-${key}`}
                  className="flex flex-col sm:flex-row sm:gap-2 py-1"
                  aria-label={`${key}: ${text}`}
                >
                  <dt
                    data-testid={`field-label-${key}`}
                    className="text-sm font-medium text-gray-600 sm:min-w-[200px]"
                  >
                    {key}
                  </dt>
                  <dd
                    data-testid={`field-value-${key}`}
                    className={`text-sm text-gray-900 break-words ${isMultiline ? 'whitespace-pre-line' : ''}`}
                  >
                    {isMultiline ? (
                      <span className="whitespace-pre-wrap">{text}</span>
                    ) : (
                      text
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">No additional requirements</p>
        )}
      </div>
    </section>
  );
});