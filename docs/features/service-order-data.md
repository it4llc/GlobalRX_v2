# Service Order Data Feature

## Overview

The Service Order Data feature enhances the service details API endpoint to include comprehensive order data (form fields) collected during the order submission process. This enables fulfillment teams, vendors, and customers to access the complete information provided for each service, improving the accuracy and efficiency of the fulfillment workflow.

## Business Purpose

When customers submit orders, they provide service-specific information through dynamic forms (education verification requires school details, employment verification needs employer information, etc.). Previously, this crucial data was stored in the database but not accessible to fulfillment teams. This feature makes that data available in the service details view, providing complete context for service processing.

## User Benefits

### Internal Fulfillment Teams
- **Complete Context:** See exactly what information was collected for each service
- **Faster Processing:** Reduce back-and-forth communication with customers for missing details
- **Better Vendor Assignments:** Match services to vendors based on specific requirements
- **Quality Control:** Verify all necessary information was collected before processing

### Vendor Users
- **Service Details:** Access complete service requirements without separate communication
- **Efficient Processing:** Have all necessary information to complete verifications
- **Reduced Questions:** Minimize need to contact customers or internal teams for clarification

### Customer Users
- **Transparency:** View exactly what information they provided for each service
- **Status Tracking:** Understand what data is available for processing their requests
- **Self-Service:** Verify their submissions without contacting support

## Technical Implementation

### Architecture Overview

```
API Request → Service Details Endpoint → ServiceOrderDataService → Database
                                    ↓
                            Format & Filter Data
                                    ↓
                              Response with orderData
```

### Key Components

#### 1. ServiceOrderDataService
**Location:** `src/lib/services/service-order-data.service.ts`

Core business logic service that handles:
- Fetching order data records from database
- Filtering out duplicate subject information
- Formatting field names with proper labels
- Handling missing workflow configurations
- Graceful error handling

#### 2. Service Order Data Schemas
**Location:** `src/lib/schemas/service-order-data.schemas.ts`

Zod validation schemas for:
- Order data field values (max 5000 characters)
- Service details response structure
- Type-safe API responses

#### 3. Type Definitions
**Location:** `src/types/service-order-data.ts`

TypeScript interfaces for:
- Workflow field configurations
- Order subject information
- Database entity relationships

#### 4. Enhanced API Endpoint
**Location:** `src/app/api/fulfillment/services/[id]/route.ts`

Modified GET endpoint that:
- Maintains existing service details functionality
- Adds order data retrieval and formatting
- Implements graceful degradation on errors
- Supports all user types with appropriate permissions

### Data Flow

1. **API Request:** User requests service details via GET /api/fulfillment/services/[id]
2. **Service Lookup:** Existing service fulfillment logic retrieves basic service data
3. **Order Data Fetching:** ServiceOrderDataService queries OrderData table for related records
4. **Subject Retrieval:** Order subject information obtained for duplicate detection
5. **Field Filtering:** Subject information fields excluded from order data
6. **Label Formatting:** Field names converted to display labels using workflow configuration
7. **Response Assembly:** Order data included in existing service response structure
8. **Error Handling:** Empty object returned if order data retrieval fails

### Database Schema

The feature leverages existing database tables:

- **OrderData:** Contains field name/value pairs from order submissions
- **Order:** Provides subject information for duplicate filtering
- **WorkflowSection:** (Future) Will contain field label configurations
- **ServicesFulfillment:** Links services to order items

## Business Rules Implementation

### 1. Universal Data Inclusion
**Rule:** Order data must be included for ALL service types without exception
**Implementation:** No service type filtering - all services get order data lookup

### 2. Flat Key-Value Structure
**Rule:** Return data as flat key-value pairs with readable labels
**Implementation:** Single-level object with "Field Label": "field value" format

### 3. Subject Information Exclusion
**Rule:** Exclude fields that duplicate order.subject information
**Implementation:** SUBJECT_FIELDS constant filters out firstName, lastName, email, DOB, SSN, phone

### 4. Field Label Resolution
**Rule:** Use workflow configuration labels when available
**Implementation:** Lookup field configurations, fallback to formatted field names

### 5. Universal Access
**Rule:** All users who can view a service can see its order data
**Implementation:** No additional permission checks beyond service access

### 6. Integrated Response
**Rule:** Order data returned as part of existing service response
**Implementation:** Added orderData field to service details response

### 7. Error Resilience
**Rule:** Service details must work even if order data fails
**Implementation:** Empty object returned on errors, service functionality preserved

### 8. Consistent Structure
**Rule:** orderData must be object, never null or undefined
**Implementation:** All paths return {} object, even on errors or missing data

### 9. Data Preservation
**Rule:** Field values returned exactly as stored
**Implementation:** No transformation of field values, preserving original customer input

### 10. Configuration Resilience
**Rule:** Handle deleted workflow configurations gracefully
**Implementation:** Fallback formatting converts underscores to spaces

## Edge Case Handling

### Workflow Configuration Deleted
**Problem:** Admin deletes workflow after orders submitted
**Solution:** Format raw field names (school_name → School Name)

### Order Subject Missing
**Problem:** Order.subject field is null or corrupted
**Solution:** Use raw field names without duplicate filtering

### Database Query Failures
**Problem:** OrderData table inaccessible or corrupted
**Solution:** Return empty orderData object, allow service details to load

### No Order Data Exists
**Problem:** Service has no associated order item data
**Solution:** Return empty orderData object (per business rule)

### Invalid Order Item ID
**Problem:** Service references non-existent order item
**Solution:** Log warning, return empty orderData object

## API Documentation

### Endpoint
GET /api/fulfillment/services/[id]

### New Response Field
```typescript
{
  // ... existing service fields
  orderData: {
    [fieldLabel: string]: string | null
  }
}
```

### Example Responses

**Education Verification:**
```json
{
  "orderData": {
    "School Name": "University of Michigan",
    "Degree Type": "Bachelor's",
    "Graduation Date": "2020-05-15",
    "Major/Field of Study": "Computer Science",
    "Student ID": "123456789"
  }
}
```

**Employment Verification:**
```json
{
  "orderData": {
    "Company Name": "Tech Solutions Inc",
    "Job Title": "Software Engineer",
    "Employment Start Date": "2020-06-01",
    "Employment End Date": "2024-01-15",
    "Supervisor Name": "Jane Smith"
  }
}
```

## Error Handling Strategy

### Graceful Degradation Philosophy
The feature is designed to enhance the service details experience without breaking existing functionality. If order data retrieval fails for any reason, users still receive complete service information.

### Error Scenarios
1. **Database Connection Issues:** Log error, return empty orderData
2. **Missing Order Item:** Log warning, return empty orderData
3. **Corrupted Order Subject:** Use raw field names, continue processing
4. **Deleted Workflow Config:** Use fallback formatting, continue processing
5. **Invalid Field Data:** Include as-is, let UI handle display

### Logging Strategy
All errors logged with structured data for debugging:
- Error message and stack trace
- Service ID and order item ID for context
- User information for audit trail
- No sensitive data (field values, PII) logged

## Testing Strategy

### Unit Tests
- ServiceOrderDataService business logic
- Field filtering and formatting functions
- Error handling scenarios
- Schema validation

### Integration Tests
- API endpoint with various user types
- Database query error simulation
- Missing data scenarios
- Permission validation

### End-to-End Tests
- Complete user workflows with order data display
- Error handling in UI components
- Performance with large order data sets

## Performance Considerations

### Database Impact
- Single additional query per service details request
- Indexed foreign key relationships for efficient lookups
- Minimal data transfer (only relevant order data fields)

### Caching Strategy
- Service details responses not cached due to real-time status updates
- Order data relatively static after submission (good candidate for future caching)

### Query Optimization
- Use select statements to fetch only required fields
- Leverage existing database indexes on orderItemId
- Batch order subject lookup when not included in service response

## Security Considerations

### Data Privacy
- Order data contains potentially sensitive information (school IDs, employer details)
- Existing service access permissions control order data access
- No additional sensitive data exposure beyond current service details

### Access Control
- Leverages existing permission system (fulfillment, vendor assignment, customer ownership)
- No new permission levels required
- Audit trail maintained through existing logging

### Input Validation
- Order data read-only from client perspective (no user input to validate)
- Field values stored as entered during order submission (no modification)
- Response structure validated with Zod schemas

## Future Enhancements

### Workflow Configuration Integration
Currently commented out pending database schema updates:
- Implement proper WorkflowSection.sectionConfig field lookup
- Enable rich field metadata (labels, types, descriptions)
- Support field ordering and grouping

### Field Type Support
- Date field formatting
- Numeric field validation
- Boolean field display
- File attachment references

### Advanced Filtering
- Service-type-specific field filtering
- Customer preference controls
- Field importance indicators

## Migration Notes

### Backward Compatibility
- Feature adds new orderData field to existing API response
- Existing clients ignore unknown response fields (graceful enhancement)
- No breaking changes to existing service details functionality

### Deployment Requirements
- No database migrations required (uses existing schema)
- No environment variable changes
- Compatible with existing authentication and authorization

### Rollback Plan
- Remove orderData field inclusion from API response
- No data loss (OrderData table unchanged)
- Service details functionality returns to previous state

## Support and Maintenance

### Monitoring
- Track order data retrieval success rates
- Monitor API response times with additional data
- Alert on high error rates in order data service

### Common Issues
1. **Empty orderData for all services:** Check OrderData table population
2. **Raw field names displayed:** Verify workflow configurations exist
3. **Performance degradation:** Review database query performance
4. **Permission errors:** Validate existing service access controls

### Troubleshooting
- Enable debug logging in ServiceOrderDataService
- Verify OrderData records exist for specific order items
- Check order.subject field for duplicate filtering context
- Validate workflow configuration availability

---

**Implementation Date:** March 12, 2026
**Status:** Complete
**Next Review:** April 12, 2026