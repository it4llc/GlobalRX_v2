// /GlobalRX_v2/src/components/services/ServiceRequirementsDisplay.tsx

import React from 'react';
import type { OrderData } from '@/lib/schemas/service-order-data.schemas';

interface ServiceRequirementsDisplayProps {
  orderData?: OrderData | null;
  serviceName?: string;
  isLoading?: boolean;
}

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
 */
export const ServiceRequirementsDisplay = React.memo(({ orderData, serviceName = '' }: ServiceRequirementsDisplayProps) => {
  // Edge cases: Handle null, undefined, or empty orderData
  const hasData = orderData && typeof orderData === 'object' && Object.keys(orderData).length > 0;

  // Helper function to format date strings
  const formatDate = (value: string): string => {
    // Only format strings that are clearly dates (ISO format with dashes)
    // Don't format plain years or other number strings
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

  // Helper function to format field values
  const formatValue = (value: any): { text: string; isMultiline: boolean } => {
    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      return { text: '--', isMultiline: false };
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return { text: value ? 'Yes' : 'No', isMultiline: false };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return { text: value.join(', '), isMultiline: false };
    }

    // Handle objects
    if (typeof value === 'object') {
      return { text: '[object]', isMultiline: false };
    }

    // Convert to string
    let stringValue = String(value);

    // Check for dates and format them
    if (typeof value === 'string' && value.length <= 50) {
      const formatted = formatDate(value);
      if (formatted !== value) {
        return { text: formatted, isMultiline: false };
      }
    }

    // Check for multi-line text
    const hasLineBreaks = stringValue.includes('\n');

    return { text: stringValue, isMultiline: hasLineBreaks };
  };

  return (
    <section
      data-testid="service-requirements-section"
      className="bg-white rounded-lg p-4"
      aria-label="Submitted Information"
      tabIndex={0}
    >
      <div data-testid="service-requirements-display" className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900">Submitted Information</h3>

        {hasData ? (
          <dl className="space-y-2">
            {Object.entries(orderData).map(([key, value], index) => {
              const { text, isMultiline } = formatValue(value);
              const fieldId = key.replace(/\s+/g, '-').toLowerCase();

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
                    {/* WHY USE CSS FOR MULTILINE TEXT:
                        We use CSS classes instead of dangerouslySetInnerHTML
                        to prevent XSS attacks. This safely preserves line breaks without
                        allowing HTML injection through user-submitted order data. */}
                    {isMultiline ? (
                      <span className="whitespace-pre-wrap">
                        {text}
                      </span>
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