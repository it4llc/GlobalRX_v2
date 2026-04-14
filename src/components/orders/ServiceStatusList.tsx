// /GlobalRX_v2/src/components/orders/ServiceStatusList.tsx

'use client';

import React, { useState } from 'react';
import type { ServiceStatusListProps } from '@/types/service-status-display';
import { serviceStatusListPropsSchema } from '@/types/service-status-display';
import { getStatusColorClass } from '@/lib/schemas/serviceStatusSchemas';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatServiceStatus } from '@/lib/status-utils';
import { NewActivityDot } from '@/components/ui/NewActivityDot';

/**
 * ServiceStatusList Component
 *
 * Displays service statuses within orders table across multiple pages in the portal.
 * Each service shows as an individual row with name, location, and status badge.
 *
 * Key Features:
 * - Service name truncation at 30 chars for table readability
 * - Location display (country code preferred, name fallback, "Unknown Location" default)
 * - Status color coding matching order statuses for visual consistency
 * - Show more/less functionality for lists > 5 items to prevent table bloat
 * - Mobile responsive layout with stacked vs inline formatting
 * - Full internationalization support for global deployment
 * - Runtime prop validation for backward compatibility with legacy data
 *
 * Business Context:
 * This component is critical for order management workflows where users need to
 * quickly assess the status of multiple services within each order. The display
 * prioritizes the most important information (service, location, status) while
 * maintaining table performance with truncation and pagination.
 */

// Status formatting now uses centralized utility from src/lib/status-utils.ts
// This ensures consistent formatting regardless of how status is stored in DB

// Truncate service names longer than 30 characters to prevent table layout issues
// Business rule: 30 chars allows most service names while maintaining readable tables
const truncateServiceName = (name: string | null): string => {
  if (!name) return '';
  if (name.length > 30) {
    return name.substring(0, 30) + '...';
  }
  return name;
};

interface ServiceStatusListComponentProps {
  items: ServiceStatusListProps['items'];
  preferCountryCode?: boolean;
  isMobile?: boolean;
  maxInitialDisplay?: number;
}

export const ServiceStatusList: React.FC<ServiceStatusListComponentProps> = (props) => {
  const { t } = useTranslation();

  // Validate props at runtime for safety - critical for backward compatibility
  // Legacy order data might not match current schema, so we gracefully degrade
  const validatedProps = React.useMemo(() => {
    try {
      return serviceStatusListPropsSchema.parse(props);
    } catch (error) {
      // Fallback to props if validation fails (for backward compatibility)
      return props;
    }
  }, [props]);

  const {
    items,
    preferCountryCode = false,
    isMobile = false,
    maxInitialDisplay = 5
  } = validatedProps;

  const [isExpanded, setIsExpanded] = useState(false);

  // Handle empty state
  if (!items || items.length === 0) {
    return (
      <span className="text-gray-500" data-testid="no-services">
        {t('services.noServices')}
      </span>
    );
  }

  // Determine which items to show
  const displayItems = isExpanded ? items : items.slice(0, maxInitialDisplay);
  const hasMore = items.length > maxInitialDisplay;
  const remainingCount = items.length - maxInitialDisplay;

  return (
    <div role="list" aria-label={`${items.length} services`}>
      {displayItems.map((item, index) => {
        // Handle missing service name
        const serviceName = item.service?.name
          ? truncateServiceName(item.service.name)
          : 'Unnamed Service';
        const isUnnamedService = !item.service?.name;

        // Handle location display
        let locationDisplay = 'Unknown Location';
        let isUnknownLocation = true;

        if (item.location) {
          if (preferCountryCode && item.location.code) {
            locationDisplay = item.location.code;
            isUnknownLocation = false;
          } else if (item.location.name) {
            locationDisplay = item.location.name;
            isUnknownLocation = false;
          }
          // Don't fall back to code if name is null - show "Unknown Location" instead
        }

        // Format status for display using centralized utility
        const statusDisplay = formatServiceStatus(item.status);
        const statusColorClasses = getStatusColorClass(item.status);

        if (isMobile) {
          // Mobile layout - stacked
          return (
            <div
              key={item.id}
              className="block mb-2"
              data-testid={`service-item-${index}`}
            >
              <div className={`${isUnnamedService ? 'italic' : ''} font-medium flex items-center`}>
                <NewActivityDot
                  show={item.hasNewActivity || false}
                  aria-label={t('services.hasNewActivity')}
                  className="mr-1"
                />
                {serviceName}
              </div>
              <div className="ml-2 text-sm">
                <span className={isUnknownLocation ? 'italic text-gray-600' : 'text-gray-600'}>
                  {locationDisplay}
                </span>
                <span className="mx-1">•</span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs rounded-full ${statusColorClasses}`}
                  aria-label={`Service status: ${statusDisplay}`}
                  data-testid="service-status-badge"
                >
                  {statusDisplay}
                </span>
              </div>
            </div>
          );
        } else {
          // Desktop layout - inline
          return (
            <div
              key={item.id}
              className="flex items-center gap-1 mb-1"
              data-testid={`service-item-${index}`}
            >
              <NewActivityDot
                show={item.hasNewActivity || false}
                aria-label={t('services.hasNewActivity')}
                className="mr-1"
              />
              <span className={`${isUnnamedService ? 'italic' : ''} font-medium`}>
                {serviceName}
              </span>
              <span className="text-gray-400">-</span>
              <span className={isUnknownLocation ? 'italic text-gray-600' : 'text-gray-600'}>
                {locationDisplay}
              </span>
              <span className="text-gray-400">-</span>
              <span
                className={`inline-flex px-2 py-0.5 text-xs rounded-full ${statusColorClasses}`}
                aria-label={`Service status: ${statusDisplay}`}
                data-testid="service-status-badge"
              >
                {statusDisplay}
              </span>
            </div>
          );
        }
      })}

      {/* Show more/less controls */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-blue-600 hover:text-blue-800 font-medium mt-1 ${
            isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''
          }`}
          aria-expanded={isExpanded}
          data-testid={isExpanded ? 'show-less' : 'show-more'}
        >
          {isExpanded ? t('services.showLess') : `${t('services.showMore')} ${remainingCount} ${t('services.more')}`}
        </button>
      )}
    </div>
  );
};