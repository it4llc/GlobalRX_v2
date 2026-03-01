# Vendor Management System Requirements

## Overview
The vendor management system enables GlobalRx to outsource order fulfillment to third-party vendor organizations while maintaining control and visibility over the process.

## Business Requirements

### User Types
1. **Internal Users** - GlobalRx employees who manage the system
2. **Customer Users** - Clients who place orders
3. **Vendor Users** - Third-party fulfillment organizations who process orders

### View System
1. **Configuration View** - For internal admin users only
   - Access to User Admin, Global Config, Customer Config, and Vendor Admin modules
   - Requires specific admin permissions

2. **Orders View** - For all user types
   - Internal users see all orders and act as backup fulfillment team
   - Vendor users see only orders assigned to their organization
   - Customer users see only their own orders

### Vendor Organizations
1. **Properties**:
   - Name (required)
   - Contact Email (required)
   - Contact Phone (required)
   - Address (optional)
   - Notes (optional)
   - Active/Inactive status
   - Primary designation (only one vendor can be primary)

2. **Order Assignment**:
   - New orders auto-assign to the primary active vendor
   - If no primary vendor or primary is inactive, orders go to internal team
   - Manual reassignment available for internal users

### Permissions Model

#### Internal Users Can Have:
- `user_admin` - Manage all users
- `global_config` - Manage system configurations
- `customer_config` - Manage customer settings
- `vendors` - Manage vendor organizations
- `fulfillment` - Access orders for fulfillment

#### Vendor Users:
- Can ONLY have `fulfillment` permission
- Cannot have any admin permissions
- Can only see orders assigned to their vendor organization
- Cannot create or modify orders

#### Customer Users:
- No admin permissions
- Can view their own orders only
- Can create new orders

### User-Vendor Association
1. Each vendor user must be associated with exactly one vendor organization
2. Vendor users can only access data for their assigned organization
3. User type must be set to "vendor" and vendorId must be populated

## Technical Implementation

### Database Schema
```prisma
model VendorOrganization {
  id           String  @id @default(uuid())
  name         String
  isActive     Boolean @default(true)
  isPrimary    Boolean @default(false)
  contactEmail String
  contactPhone String
  address      String?
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  users        User[]   @relation("VendorUserRelation")
  assignedOrders Order[] @relation("OrderVendorAssignment")
}

model User {
  // ... existing fields
  userType   String? // 'internal', 'customer', 'vendor'
  vendorId   String?
  vendor     VendorOrganization? @relation("VendorUserRelation")
  // ... other fields
}

model Order {
  // ... existing fields
  assignedVendorId String?
  assignedVendor   VendorOrganization? @relation("OrderVendorAssignment")
  // ... other fields
}
```

### API Endpoints

#### Vendor Management
- `GET /api/vendors` - List vendors (filtered by user type)
- `POST /api/vendors` - Create vendor (internal users only)
- `PUT /api/vendors/:id` - Update vendor (internal users only)
- `DELETE /api/vendors/:id` - Delete vendor (internal users only)

#### User Management Updates
- User creation/update must include:
  - `userType`: 'internal', 'customer', or 'vendor'
  - `vendorId`: Required for vendor users
  - `customerId`: Required for customer users

### Security Rules
1. **Authentication**: Required on all endpoints
2. **Authorization**:
   - Vendor management requires `vendors` or `global_config` permission
   - Vendor users can only access their organization's data
   - No cross-vendor data access allowed

### UI Components

#### Vendor Management Page (`/admin/vendors`)
- List all vendor organizations
- Add/Edit/Delete vendors
- Set primary vendor
- Toggle active status

#### User Admin Updates
- User form includes vendor/customer organization selection
- When userType = 'vendor', vendor dropdown appears
- When userType = 'customer', customer dropdown appears
- Permissions restricted based on user type

## Testing Requirements

### Unit Tests
1. Vendor CRUD operations
2. Permission checks for vendor management
3. Order assignment logic
4. User-vendor association validation

### Integration Tests
1. Vendor user login and session management
2. Order visibility based on vendor assignment
3. Primary vendor auto-assignment
4. Cross-vendor data isolation

### E2E Tests
1. Complete vendor creation workflow
2. Vendor user login and order access
3. Order assignment and reassignment
4. Permission enforcement

## Outstanding Issues

1. **UserType Persistence**: User type not updating when edited
2. **Fulfillment Permission**: Need to add fulfillment permission
3. **Permission Restrictions**: Vendor users should only have fulfillment permission
4. **View Toggle**: Implementation of view switching between Config and Orders
5. **Order Assignment UI**: Interface for manual order reassignment

## Migration Path

1. Add VendorOrganization table
2. Add vendorId to User table
3. Add assignedVendorId to Order table
4. Migrate existing users to have userType = 'internal'
5. Update permission checks to support new format

## Future Enhancements

1. Vendor performance metrics
2. Automated vendor selection based on capacity
3. Vendor-specific SLAs
4. Multi-vendor order splitting
5. Vendor portal with limited admin capabilities