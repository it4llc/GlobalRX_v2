# User Management Separation Plan

## Overview
Separate internal admin users from customer users to provide clearer access control and better user experience.

## Current Issues
1. **Customer Config Users Tab Error**: The `/api/customers/[id]/users` endpoint doesn't exist, causing the Users tab to fail
2. **User Admin Tab Mix**: Currently shows ALL users (both internal admins and customer users) together
3. **No Customer User Management**: No way to add/manage customer users from within the customer record

## Implementation Plan

### Phase 1: Fix the Immediate Error
- [ ] Create `/api/customers/[id]/users/route.ts` endpoint to fetch users for a specific customer
  - Filter users by `userType === 'customer'` AND `customerId === [id]`
  - Return user list with appropriate fields

### Phase 2: Separate User Management Areas

#### A. User Admin Tab (Internal Users Only)
- [ ] Modify `/api/users/route.ts` to only return `userType === 'admin'` users
- [ ] Update user creation in User Admin to always set `userType: 'admin'`
- [ ] Keep existing permission structure for admin users (countries, services, dsx, customers)

#### B. Customer User Management (Within Customer Record)
- [ ] Add "Add User" button to Customer Config Users tab
- [ ] Create customer user form component with:
  - Basic info (email, name, password)
  - Auto-set `userType: 'customer'` and `customerId`
  - Simple permission toggles (view orders, create orders, manage users)
- [ ] Create `/api/customers/[id]/users` POST endpoint for adding customer users
- [ ] Add edit/delete functionality for customer users within the customer context

### Phase 3: Enhanced Security & UX
- [ ] Ensure customer users can ONLY access their own customer's data
- [ ] Add user type badges in relevant tables to clearly identify user types
- [ ] Verify middleware properly routes customer users to `/portal` and admin users to main app

## Technical Details

### Database Schema
The existing User model already supports this separation:
- `userType` field: "admin" or "customer"
- `customerId` field: Links customer users to their customer
- `permissions` field: JSON structure for granular permissions

### API Endpoints

#### Existing (to be modified)
- `GET /api/users` - Return only admin users
- `POST /api/users` - Create admin users with `userType: 'admin'`

#### New Endpoints
- `GET /api/customers/[id]/users` - Get all users for a specific customer
- `POST /api/customers/[id]/users` - Create a new customer user
- `PUT /api/customers/[id]/users/[userId]` - Update customer user
- `DELETE /api/customers/[id]/users/[userId]` - Delete customer user

### Permission Structure

#### Admin Users
Keep existing broad permissions:
- `countries: ["*"]` - Access to country management
- `services: ["*"]` - Access to service management
- `dsx: ["*"]` - Access to DSX management
- `customers: ["*"]` - Access to all customers

#### Customer Users
Simplified, customer-specific permissions:
- `orders: { view: true, create: true, edit: true }`
- `users: { manage: true }` - Manage other users for their customer
- Auto-restricted to their `customerId` only

## Benefits
- **Clear separation**: Admin users vs Customer users with distinct interfaces
- **Simplified permissions**: Customer users automatically restricted to their customer
- **Better UX**: Manage customer users where it makes sense - within the customer record
- **Security**: No risk of accidentally granting customer users admin access
- **Maintainability**: Cleaner code with clear separation of concerns

## Future Enhancements (Not in current scope)
- Role-based permissions for admin users (Super Admin, Operations Manager, Support Staff)
- Invitation system for customer users (email invites)
- Audit logging for user creation/modification
- Two-factor authentication for both user types
- Password reset flow for customer users