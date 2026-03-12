# Feature Specification: Include Order Data in Service Details API
**Date:** March 12, 2026
**Requested by:** Andy
**Status:** Approved

## Summary
Enhance the service details API endpoint to include the order data (form fields) collected during the order submission process. This data is currently stored in the OrderData table and needs to be available when viewing individual service details in the fulfillment module, allowing fulfillment teams and vendors to see the complete information collected for each service.

## Who Uses This
- **Internal fulfillment team members** - View all order data to process services accurately
- **Vendor users** - View order data for services assigned to them
- **Customer users** - View their own order data when checking service status
- **Admin users** - Full access to all order data for oversight and troubleshooting

## Business Rules
1. Order data must be included for ALL service types without exception
2. The system must return the data as flat key-value pairs (e.g., "school_name": "University of Michigan")
3. Subject Information fields that duplicate what's already in the order.subject JSON must NOT be included in the order data to avoid redundancy
4. All fields from the OrderData table must be included except for the Subject Information duplicates
5. Field labels must come from the original order workflow configuration, not the raw field names stored in the database
6. All users who can view a service can see all its order data fields (no field-level filtering by user type)
7. The order data must be returned as part of the existing service details response, not as a separate API call
8. If no order data exists for a service, the orderData property should be an empty object, not null or undefined
9. Field values must be returned exactly as stored without transformation (dates as strings, numbers as strings if that's how they were saved)
10. The system must handle cases where the workflow configuration no longer exists (deleted workflow) by falling back to the raw field names

## User Flow
1. A user (internal, vendor, or customer) navigates to the fulfillment module
2. They click on a specific service to view its details
3. The system calls the service details API endpoint
4. The API retrieves the service information along with its associated order item data
5. The API fetches all OrderData records for that order item
6. The API retrieves the original workflow configuration to get proper field labels
7. The API filters out any Subject Information fields that duplicate order.subject
8. The API formats the data as flat key-value pairs with proper labels
9. The user sees the service details with all collected order data displayed
10. The user can now make informed decisions based on the complete information

## Data Requirements

### API Response Structure
The service details API response will include an additional `orderData` field:

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Order Data | orderData | object | Yes | Must be object, never null | {} |
| [Dynamic Label from Workflow] | [fieldName from OrderData] | string | No | Max 5000 chars | "" |

Example response structure:
```json
{
  "service": {
    "id": "srv_123",
    "name": "Education Verification",
    // ... existing service fields ...
    "orderData": {
      "School Name": "University of Michigan",
      "Degree Type": "Bachelor's",
      "Graduation Date": "2020-05-15",
      "Major/Field of Study": "Computer Science",
      "Student ID": "123456789"
    }
  }
}
```

### Subject Information Fields to Exclude
The following fields should NOT appear in orderData if they exist in order.subject:
- firstName / First Name
- lastName / Last Name
- middleName / Middle Name
- dateOfBirth / Date of Birth
- email / Email
- phone / Phone
- ssn / Social Security Number

### Database Schema Used
- **OrderData table**:
  - orderItemId (FK to OrderItem)
  - fieldName (raw field identifier)
  - fieldValue (actual value entered)
  - fieldType (text, date, select, etc.)

- **WorkflowSection table**:
  - Contains field configurations with display labels

- **Order.subject**:
  - JSON field containing subject information to check for duplicates

## Edge Cases and Error Scenarios
1. **No order data exists** - Return empty orderData object {}
2. **Workflow has been deleted** - Use raw fieldName as the label with underscores converted to spaces
3. **OrderItem not found for service** - Log warning, return empty orderData object
4. **Database query fails** - Log error, continue with service details but without orderData
5. **Field label is null or empty** - Use the fieldName as fallback
6. **Very long field values** - Return as-is (frontend handles display truncation)
7. **Special characters in field values** - Return exactly as stored (no escaping needed for JSON)
8. **User lacks permission to view service** - Existing 403 error (no change)
9. **Duplicate field detection fails** - Include all fields rather than risk missing data
10. **Workflow configuration is corrupted** - Use fieldName fallback for all fields

## Impact on Other Modules
- **Service Details View (Frontend)** - Will need update to display the new orderData field
- **Service Export functionality** - May want to include order data in exports
- **Audit logging** - No impact, read operations aren't logged
- **Performance monitoring** - Additional database queries may affect response time metrics
- **API documentation** - Must be updated to reflect new response structure
- **Integration tests** - Existing tests may need updates for new response format

## Definition of Done
1. Service details API returns orderData object with all non-duplicate fields
2. Field labels come from workflow configuration when available
3. Subject Information fields that exist in order.subject are excluded
4. Empty object returned when no data exists
5. All user types can access the data (with existing permission checks)
6. Response time remains under 500ms for typical service queries
7. Error handling prevents partial failures from breaking the entire response
8. API documentation is updated with new field structure
9. Unit tests cover all edge cases listed above
10. Integration test confirms data appears correctly for internal, customer, and vendor users
11. No console.log statements in final code
12. TypeScript types are properly defined for new structure
13. Code follows existing patterns in service-fulfillment.service.ts

## Open Questions
None - all requirements have been clarified.