# Service Requirements Display - Implementation Plan
**Created:** March 12, 2026
**Branch:** `feature/service-requirements-display`

## Overview
Display the form data captured during order creation within the service details view so that fulfillment teams can see the information needed to complete services.

## Requirements (Confirmed by Andy)
- **Visibility:** All user types can see all information and attached docs
- **Empty fields:** Show as "Not provided"
- **Location:** Display at the TOP of the service details section, above the results block
- **Documents:** Listed with links that open in new tabs

## Implementation Phases

### Phase 1: Backend API - Fetch and Include Order Data
**Status:** Ready to start
**Command:** `/build-feature Add order data fields to the service fulfillment API response so that form data captured during order creation (like school name, dates, degree for education verification) is included when fetching a service by ID`

**Scope:**
- Modify `ServiceFulfillmentService.getServiceById()` to include OrderData from related OrderItem
- Update service fulfillment type definitions to include order data fields
- Ensure all user types have access to view this data

### Phase 2: Frontend Display - Show Order Data in Service Details
**Status:** Pending Phase 1 completion
**Command:** `/build-feature Create a Service Requirements display section that shows the form data captured during order creation (like education details, employment history, etc.) in the service details expanded view`

**Scope:**
- Create ServiceRequirementsDisplay component
- Place it at the TOP of service details (above ServiceResultsSection)
- Show empty fields as "Not provided"
- Display documents with links that open in new tabs
- Format dates, addresses, and other field types appropriately

### Phase 3: Enhanced Data Presentation (Optional)
**Status:** Pending Phase 2 completion
**Command:** `/build-feature Enhance the service requirements display with better formatting, grouped sections by category, and human-readable field labels`

**Scope:**
- Group related fields by category
- Add human-readable labels
- Include tooltips for complex fields

## Technical Context

### Current State
- Order form data IS captured in `OrderData` table during order creation
- Data is NOT currently displayed in service fulfillment views
- `ServiceResultsSection` component exists for results/attachments

### Key Files to Modify
- **Backend:** `src/services/ServiceFulfillmentService.ts`
- **Types:** `src/types/services.ts`
- **Frontend:** `src/components/fulfillment/ServiceResultsSection.tsx` (or new component)
- **API Route:** Routes that fetch service details

### Data Flow
1. OrderItem → OrderData (captured during order creation)
2. ServiceFulfillmentService fetches service + related OrderData
3. Frontend displays in new ServiceRequirementsDisplay component
4. Component positioned above ServiceResultsSection

## Next Steps
1. Run Phase 1 command to implement backend changes
2. Test that API returns order data
3. Run Phase 2 command to implement frontend display
4. Test end-to-end with real order data
5. (Optional) Run Phase 3 for UI enhancements