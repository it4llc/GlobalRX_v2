# Feature Specification: Service Requirements Display
**Date:** March 12, 2026
**Requested by:** Andy
**Status:** Draft

## Summary
Display the service-specific requirements (order data) collected during order submission in the service details view within the fulfillment module. This allows fulfillment staff and vendors to see all the additional information collected beyond the subject's personal details, such as school information for education verifications or employer details for employment checks. The data is already being fetched in the API response and needs to be displayed in the user interface.

## Who Uses This
- **Internal fulfillment team members** - View all submitted requirements to process services accurately
- **Vendor users** - View requirements for services assigned to them to complete verifications
- **Customer users** - View what information they submitted when checking service status
- **Admin users** - Full access to all service requirements for oversight and support

## Business Rules
1. **Display location** - Requirements must be shown above the results and comments sections, but within the expandable row (first section when expanded)
2. **Data visibility** - All users who can view a service can see all its requirement fields (no field-level filtering by user type)
3. **Field order** - Fields must be displayed in the order they were originally entered during order submission
4. **Empty state handling** - If no additional requirements exist, display the message "No additional requirements" instead of hiding the section
5. **Field formatting** - Values should be formatted for readability (dates formatted as MM/DD/YYYY, line breaks preserved in text areas, etc.)
6. **Section title** - The section must be titled "Submitted Information" to be clear to users
7. **Performance** - Continue using the existing data fetch mechanism (orderData is already included in the API response)
8. **Duplicate prevention** - Subject information fields already shown in the Subject Information section must not be repeated
9. **Field labels** - Use the human-readable labels from orderData keys, not raw database field names
10. **Read-only display** - All requirement fields are read-only and cannot be edited from the fulfillment interface
11. **Expandable integration** - The requirements section must only be visible when the service row is expanded
12. **Consistent styling** - Use the same visual styling as other sections in the expanded view for consistency

## User Flow
1. A user (internal, vendor, or customer) navigates to the fulfillment module or order details page
2. They see the list of services in the ServiceFulfillmentTable
3. The user clicks the expand arrow (chevron) next to a service they want to view
4. The row expands to show additional details
5. As the first visible section in the expanded area, they see "Submitted Information"
6. The system displays all order data fields (excluding subject duplicates) as a formatted list
7. Each field shows its label and value in a readable format
8. If no additional requirements were collected, they see "No additional requirements"
9. Below the submitted information, they see the results section (if results exist)
10. Below that, they see the comments section
11. The user can review all the information needed to fulfill the service
12. They can collapse the row by clicking the chevron again

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Submitted Information | orderData | object | Yes | Must be object from API | {} |
| [Dynamic Field Label] | [orderData key] | string | No | Max 5000 chars per field | "" |
| Empty State Message | - | string (hardcoded) | No | - | "No additional requirements" |

### Example Data Structure
```json
{
  "orderData": {
    "School Name": "University of Michigan",
    "Degree Type": "Bachelor of Science",
    "Graduation Year": "2020",
    "Major": "Computer Science",
    "Student ID": "12345678"
  }
}
```

## Edge Cases and Error Scenarios
1. **No order data exists** - Display "No additional requirements" message
2. **Order data is empty object** - Display "No additional requirements" message
3. **API returns null for orderData** - Treat as empty object and show "No additional requirements"
4. **Very long field values** - Allow text to wrap naturally, don't truncate
5. **Special characters in values** - Display as-is, properly escaped for HTML
6. **Date values as strings** - Format if recognizable as date, otherwise display as-is
7. **Null/undefined field values** - Display as empty string or dash (--)
8. **Network error loading data** - The entire service row handles this, no special handling needed
9. **Field label contains colons** - Display as-is, don't add extra colons
10. **Multi-line text values** - Preserve line breaks and display with proper spacing

## Impact on Other Modules
- **No API changes required** - The orderData is already included in the service fulfillment API response
- **No database changes** - Data is already stored and retrieved correctly
- **Service Results Section** - Must remain below the new requirements section
- **Comments Section** - Must remain at the bottom of the expanded view
- **Service Status Updates** - No impact on status change functionality
- **Vendor Assignment** - No impact on vendor assignment process
- **Export functionality** - If exports are added later, should include requirement fields

## UI/UX Requirements

### Visual Design
- Use consistent styling with other expandable sections
- Title: "Submitted Information" in medium font weight
- Display fields in a clean list or grid format
- Each field on its own line or in a two-column grid for better readability
- Field labels in slightly muted color, values in standard text color
- Proper spacing between fields for easy scanning
- Section background should match other content areas

### Layout Structure
```
[Expanded Service Row]
  ├── Submitted Information (New Section)
  │   ├── Field Label 1: Value 1
  │   ├── Field Label 2: Value 2
  │   └── ... more fields
  ├── Service Results (Existing)
  │   └── [Results content]
  └── Comments (Existing)
      └── [Comments content]
```

### Mobile Responsiveness
- Stack fields vertically on small screens
- Ensure readable font sizes on all devices
- Maintain proper touch targets for expand/collapse

## Definition of Done
1. ✅ Requirements section displays as first item in expanded service row
2. ✅ Section titled "Submitted Information"
3. ✅ All orderData fields are displayed with readable labels
4. ✅ Subject information fields are not duplicated
5. ✅ Empty state shows "No additional requirements" message
6. ✅ Fields display in the order they were entered
7. ✅ Values are formatted for readability (dates, line breaks, etc.)
8. ✅ Section uses consistent styling with rest of the interface
9. ✅ Works for all user types (internal, vendor, customer)
10. ✅ No performance degradation (data already in API response)
11. ✅ Properly handles edge cases (empty data, long values, special characters)
12. ✅ Mobile responsive design implemented
13. ✅ Accessibility requirements met (proper ARIA labels, keyboard navigation)
14. ✅ Manual testing completed across different service types
15. ✅ Code review passed with no critical issues

## Technical Constraints
- Must use existing orderData from API response (no additional API calls)
- Must integrate with existing ServiceFulfillmentTable component
- Must not break existing expand/collapse functionality
- Must maintain backward compatibility with services that have no order data
- Should not require database migrations
- Must work with current permission system

## Acceptance Criteria
### Functional Requirements
- [ ] When I expand a service row, I see "Submitted Information" as the first section
- [ ] The submitted information shows all fields from orderData
- [ ] Subject fields (name, DOB, SSN, etc.) are not shown in submitted information
- [ ] Fields are displayed with human-readable labels
- [ ] Empty requirements show "No additional requirements" message
- [ ] The section appears above results and comments

### Non-Functional Requirements
- [ ] Page load time is not impacted (data already in response)
- [ ] Mobile users can view requirements clearly
- [ ] Screen readers can navigate the requirements section
- [ ] The UI remains consistent with existing design patterns

## Open Questions
None - all requirements have been clarified and confirmed.

## Notes
- The orderData is already being fetched and included in the API response as of the service-fulfillment-order-data implementation
- This is a frontend-only change to display existing data
- Priority is to make the information visible to users who need it for fulfillment