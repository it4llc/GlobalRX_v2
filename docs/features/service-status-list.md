# Feature: Service Status List Display

## Overview
The Service Status List feature provides a unified component for displaying service statuses within orders tables across the GlobalRx portal. This feature enhances order management by giving users clear visibility into the status of each service within their orders, replacing previous implementations that showed raw service data or simple counts.

## User Guide

### How It Appears
In any orders table (Portal Orders page, Portal Dashboard, or Fulfillment page), the Services column now displays:

- **Service Name** - Truncated to 30 characters for table readability
- **Country/Location** - Shows country code (preferred) or country name
- **Status Badge** - Color-coded status matching order status conventions
- **Show More/Less** - For orders with more than 5 services

### Layout Variations

**Desktop Layout (Default):**
```
Service Name - Country - Status Badge
Service Name - Country - Status Badge
[Show 3 more]
```

**Mobile Layout:**
```
Service Name
  Country • Status Badge
Service Name
  Country • Status Badge
[Show 3 more]
```

### Status Color Coding
- **Draft** - Gray background
- **Submitted** - Blue background
- **Processing** - Yellow background
- **Missing Info** - Orange background
- **Completed** - Green background
- **Cancelled** - Red background

### Missing Data Handling
- **No Service Name** - Shows "Unnamed Service" in italics
- **No Location** - Shows "Unknown Location" in italics
- **No Services** - Shows "No services" message

## Technical Details

### Key Files
- **Main Component:** `/src/components/orders/ServiceStatusList.tsx`
- **Type Definitions:** `/src/types/service-status-display.ts`
- **Integration Points:**
  - `/src/app/portal/orders/page.tsx` - Customer portal orders list
  - `/src/app/portal/dashboard/page.tsx` - Customer portal dashboard
  - `/src/app/fulfillment/page.tsx` - Internal fulfillment page

### Database Integration
The component consumes order data with the following structure:
```typescript
interface OrderItem {
  id: string;
  service: { name: string; };
  location: { name: string; code?: string; };
  status: string;
}
```

### Props Interface
```typescript
interface ServiceStatusListProps {
  items: ServiceDisplayItem[];
  preferCountryCode?: boolean;  // Show country code vs name
  isMobile?: boolean;          // Mobile layout toggle
  maxInitialDisplay?: number;  // Items to show before "more"
}
```

### Runtime Validation
The component includes Zod schema validation for backward compatibility with legacy data that might not match current structure.

## Configuration

### Display Preferences
- **Service Name Truncation:** 30 characters (configurable via code)
- **Initial Display Count:** 5 services before showing "more" button
- **Country Code Preference:** Can be set via `preferCountryCode` prop

### Internationalization
All text strings are externalized to translation files:
- `services.noServices` - Empty state message
- `services.showMore` - Expand button text
- `services.showLess` - Collapse button text
- `services.more` - Additional items indicator

### Translation Files Updated
- `/src/translations/en-US.json`
- `/src/translations/en-GB.json`
- `/src/translations/es-ES.json`
- `/src/translations/es.json`
- `/src/translations/ja-JP.json`

## Testing

### Unit Tests
**File:** `/src/components/orders/__tests__/ServiceStatusList.test.tsx`

**Test Coverage:**
- Empty state handling
- Service name truncation
- Location display fallbacks
- Show more/less functionality
- Mobile vs desktop layouts
- Status color coding
- Translation integration
- Props validation

### E2E Tests
**File:** `/e2e/tests/orders-table-services-display.spec.ts`

**Test Coverage:**
- Service display in portal orders page
- Service display in portal dashboard
- Service display in fulfillment page
- Mobile responsive behavior
- Show more/less interaction
- Status badge rendering

### Critical Bug Fix
**Issue:** Portal dashboard initially did not use ServiceStatusList component, showing inconsistent service display.

**Resolution:** Added ServiceStatusList to portal dashboard with regression tests to ensure all order tables use consistent service display.

## Implementation Notes

### Design Decisions
1. **30 Character Limit:** Prevents table layout issues while showing meaningful service names
2. **Color Consistency:** Status colors match order status badges for visual coherence
3. **Mobile First:** Stacked layout on mobile prevents horizontal scrolling
4. **Progressive Disclosure:** Show/hide more prevents table bloat with many services
5. **Graceful Degradation:** Handles missing data without breaking table layout

### Performance Considerations
- Component uses React.memo for prop change optimization
- Runtime validation is memoized to prevent repeated schema parsing
- Truncation and formatting are pure functions for consistent performance

### Accessibility Features
- ARIA labels on status badges for screen readers
- Proper semantic markup with role="list"
- Touch-friendly button sizes on mobile (min 44px)
- High contrast status colors for visibility

## Future Enhancements

### Planned Improvements
1. **Service-Level Actions:** Click-through to individual service details
2. **Status Filters:** Filter orders by service status combinations
3. **Bulk Status Updates:** Multi-select service status changes
4. **Custom Status Colors:** Customer-configurable status color schemes

### Technical Debt
1. Consider extracting status color logic to shared utility
2. Evaluate need for virtual scrolling with very large service lists
3. Assess performance with hundreds of services per order