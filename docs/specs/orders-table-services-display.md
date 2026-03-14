# Feature Specification: Orders Table Services Display Improvement
**Date:** 2026-03-13
**Requested by:** Andy
**Status:** Confirmed

## Summary
Improve the Services column display in orders list tables to show individual service statuses with color coding matching order statuses. Services will be stacked vertically within each order row, displaying service name, country, and status on one line with appropriate color-coded status badges. This enhancement applies to both the customer portal orders list (/portal/orders) and the fulfillment dashboard (/fulfillment), providing users with at-a-glance visibility of individual service statuses without needing to open order details.

## Who Uses This
- **Customer Users:** View their orders at `/portal/orders` with enhanced service status visibility to track progress of each service within their orders
- **Internal Users (GlobalRx Staff):** View all orders at `/fulfillment` with service-level status information for better workflow management
- **Vendor Users:** View assigned orders at `/fulfillment` with service status details for fulfillment tracking

## Business Requirements

### Core Display Requirements
1. **Single Row Per Order:** Each order remains as one table row - services are displayed within the Services column cell
2. **Vertical Stacking:** Services are stacked vertically within the cell, each on its own line
3. **Service Information Format:** Each service displays: "Service Name - Country - Status" on a single line
4. **Status Color Coding:** Service status badges use the same colors as order statuses:
   - Draft: Gray (bg-gray-100 text-gray-800)
   - Submitted: Blue (bg-blue-100 text-blue-800)
   - Processing: Yellow (bg-yellow-100 text-yellow-800)
   - Missing Info: Orange (bg-orange-100 text-orange-800)
   - Completed: Green (bg-green-100 text-green-800)
   - Cancelled: Red (bg-red-100 text-red-800)
   - Cancelled DNB: Red (bg-red-100 text-red-800)

### Space Management
5. **Country Display:** If horizontal space is limited:
   - First preference: Show full country name
   - Second preference: Show 2-letter ISO country code
   - Third preference: Omit country if absolutely necessary for mobile
6. **Service Limit:** Display up to 5 services initially
7. **Overflow Handling:** If more than 5 services exist, show a "Show N more" link below the first 5
8. **Empty State:** Display "No services" in gray text (text-gray-500) when an order has no associated services

### Mobile Responsiveness
9. **Mobile Layout:** On screens smaller than 768px (mobile breakpoint):
   - Stack service information vertically for readability
   - Service name on first line
   - Country and status on second line (indented)
   - Maintain color coding for status badges

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Service Name | `item.service.name` | string | Yes | Non-empty | - |
| Country | `item.location.name` | string | Yes | Non-empty | - |
| Country Code | `item.location.code` | string | No | 2-letter ISO code | - |
| Service Status | `item.status` | string | Yes | One of: draft, submitted, processing, missing_info, completed, cancelled, cancelled_dnb | draft |
| Services Count | `order.items.length` | number | Yes | >= 0 | 0 |
| Order ID | `order.id` | string | Yes | UUID format | - |
| Visible Services | - | number | No | 1-5 initially | 5 |
| Expanded State | - | boolean | No | true/false | false |

## UI/UX Specifications

### Desktop View (>= 768px)
```
Services Column Cell:
┌─────────────────────────────────────┐
│ Criminal Check - USA - [Submitted]  │
│ Employment Ver - Canada - [Draft]   │
│ Education Ver - UK - [Processing]   │
│ Reference Check - USA - [Completed] │
│ Drug Screen - USA - [Submitted]     │
│ [Show 3 more...]                    │
└─────────────────────────────────────┘
```

### Mobile View (< 768px)
```
Services Column Cell:
┌─────────────────────────────────────┐
│ Criminal Check                      │
│   USA • [Submitted]                 │
│ Employment Verification             │
│   Canada • [Draft]                  │
│ [Show 3 more...]                    │
└─────────────────────────────────────┘
```

### Component Structure
- Each service line is a flex container with:
  - Service name (font-medium)
  - Separator dash (hidden on mobile)
  - Country name/code (text-gray-600)
  - Status badge (inline-flex px-2 py-0.5 text-xs rounded-full)

## Business Rules

1. **Status Retrieval:** Service status is read from the `OrderItem.status` field in the database
2. **Real-time Updates:** Status changes should be reflected immediately when the page is refreshed
3. **No Direct Editing:** Service status cannot be edited from the orders list table - users must open order details
4. **Sorting Preserved:** Services maintain their original creation order within each order
5. **Status Fallback:** If a service has an unrecognized status code, display it with gray coloring (default)
6. **Country Fallback:** If location name is missing, display "Unknown Location" in italics
7. **Service Name Truncation:** If service name exceeds 30 characters, truncate with ellipsis (...)
8. **Expansion Behavior:** Clicking "Show N more" expands to show all services inline (no modal/popup)
9. **Collapse Option:** After expansion, show "Show less" link to return to 5-service view
10. **Performance:** The API must include service status in the initial orders query to avoid N+1 queries

## User Flow

### Viewing Service Statuses
1. User navigates to either `/portal/orders` (customers) or `/fulfillment` (internal/vendors)
2. The orders table loads with the enhanced Services column
3. User sees up to 5 services per order, each with colored status badge
4. If an order has no services, user sees "No services" in gray
5. If an order has more than 5 services, user sees "Show N more..." link

### Expanding Service List
1. User clicks "Show N more..." link in a specific order row
2. The Services cell expands vertically to show all services
3. A "Show less" link appears at the bottom
4. User can click "Show less" to return to 5-service view
5. Expansion state is not persisted - resets on page refresh

### Mobile Interaction
1. On mobile devices, services automatically use stacked layout
2. Service name appears on first line
3. Country and status appear on second line with bullet separator
4. Touch targets for "Show more/less" links are minimum 44x44 pixels

## Edge Cases and Error Scenarios

1. **Missing Service Name:** Display "Unnamed Service" in italics
2. **Missing Location:** Display "Unknown Location" in italics
3. **Invalid Status Code:** Display the raw status code with gray badge coloring
4. **Empty Orders Array:** Show "No services" message
5. **API Timeout:** Maintain existing display with stale data indicator
6. **Very Long Service Names:** Truncate at 30 characters with ellipsis
7. **Network Error During Expansion:** Show error toast, maintain current view
8. **Services Loading:** Show skeleton loader in Services cell while data loads
9. **Mixed Status Updates:** If some services update while others fail, show partial updates
10. **Permissions Issues:** If user lacks permission to see service details, show "Services hidden" message

## Impact on Other Modules

1. **API Layer:**
   - `/api/portal/orders` must include `items.status` in response
   - `/api/fulfillment` must include `items.status` in response
   - No new endpoints required

2. **Database:**
   - No schema changes required
   - Existing `OrderItem.status` field is used
   - May need index on `order_items.status` for performance

3. **Order Details Page:**
   - No changes required
   - Service status management remains in order details

4. **Performance Monitoring:**
   - Monitor query performance with expanded service data
   - Track average services per order for capacity planning

## Definition of Done

1. ✅ Customer portal orders table shows service statuses with color coding
2. ✅ Fulfillment dashboard orders table shows service statuses with color coding
3. ✅ Service status badges use exact same colors as order status badges
4. ✅ Services display as "Service Name - Country - Status" on desktop
5. ✅ Mobile view shows stacked layout for service information
6. ✅ "No services" message appears for orders without services
7. ✅ Maximum 5 services shown initially with "Show N more" for overflow
8. ✅ Clicking "Show N more" expands to show all services inline
9. ✅ "Show less" option available after expansion
10. ✅ Country shows as 2-letter code when space is limited
11. ✅ All status values properly color-coded (7 statuses + fallback)
12. ✅ No N+1 queries - service data included in initial API response
13. ✅ Loading states show skeleton loader in Services column
14. ✅ Error handling for missing or invalid data
15. ✅ Accessibility: Status badges have proper ARIA labels
16. ✅ Performance: Page load time not increased by more than 200ms
17. ✅ Browser compatibility: Works in Chrome, Firefox, Safari, Edge

## Technical Constraints

1. **Existing API Structure:** Must work with current API response format
2. **Component Library:** Use existing Tailwind classes and color schemes
3. **State Management:** Expansion state is component-local (not in global state)
4. **Bundle Size:** Implementation should not add more than 5KB to bundle
5. **Render Performance:** Virtual scrolling not required (max ~100 orders per page)

## Testing Requirements

### Unit Tests
- Service status color mapping function
- Service display formatting (name - country - status)
- Show more/less toggle logic
- Mobile detection and layout switching

### Integration Tests
- API returns service status data correctly
- Orders with 0, 1, 5, 6+ services display correctly
- Status color coding matches between order and service statuses
- Expansion and collapse functionality

### E2E Tests
- User can view service statuses in customer portal
- User can view service statuses in fulfillment dashboard
- Mobile users see appropriate stacked layout
- Show more/less functionality works across browsers

## Open Questions

None - all requirements have been confirmed by Andy.

## Implementation Notes

### Recommended Approach
1. Create a reusable `ServiceStatusList` component
2. Component accepts array of services and expanded state
3. Use composition to integrate into existing table components
4. Share status color mapping with existing order status utilities
5. Use React.memo for performance optimization on large lists

### Code Locations
- Customer Portal Table: `/src/app/portal/orders/page.tsx`
- Fulfillment Table: `/src/app/fulfillment/page.tsx`
- Status Color Mapping: Already exists in both files as `getStatusColor()` or `statusColors`
- New Component: `/src/components/orders/ServiceStatusList.tsx` (recommended)

## Future Enhancements (Not in Current Scope)

- Click service to navigate directly to service details
- Inline service status editing from table
- Service-level filtering in table
- Export service status report
- Real-time status updates via WebSocket
- Service grouping by status