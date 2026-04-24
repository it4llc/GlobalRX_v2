# Candidate Invitation API

## Overview

The Candidate Invitation API provides endpoints for managing candidate invitations in the GlobalRx system. These endpoints allow customers to create invitations for candidates to complete background check orders.

## Authentication

All endpoints except the lookup endpoint require authentication. The lookup endpoint is intentionally public to allow candidates to access their invitations without logging in first.

## Permissions

### Create Invitation (POST /api/candidate/invitations)
- **All users:** Require `candidates.invite` permission (checked via `canInviteCandidates()`)
- **Admin users:** Have automatic access regardless of specific permission
- **Vendor users:** Are explicitly excluded from creating invitations
- **Customer users:** Can only create invitations for their own customer
- **Internal/admin users:** Can create invitations for any customer

### Extend/Resend Invitations (POST /api/candidate/invitations/[id]/extend and /api/candidate/invitations/[id]/resend)
- **Customer users:** Require `candidate_workflow` permission and can only manage invitations for their own customer
- **Internal/admin users:** Require `customer_config` permission and can manage invitations for any customer
- Uses `canManageCandidateInvitations()` function for permission checks

---

## Endpoints

### Create Invitation

**POST** `/api/candidate/invitations`

Creates a new candidate invitation with an associated draft order.

#### Request Body

```json
{
  "packageId": "uuid",           // Required: Package to use for the invitation
  "firstName": "string",         // Required: Candidate's first name (max 100 chars)
  "lastName": "string",          // Required: Candidate's last name (max 100 chars)
  "email": "string",            // Required: Valid email address
  "phoneCountryCode": "string", // Optional: Phone country code (max 5 chars)
  "phoneNumber": "string",      // Optional: Phone number (max 20 chars)
  "customerId": "uuid"          // Optional: Required for admin users only
}
```

#### Business Rules

- If `phoneNumber` is provided, `phoneCountryCode` must also be provided
- Package must exist and belong to the customer
- Package must have an active workflow assigned
- Email is normalized to lowercase before storage

#### Response

**201 Created**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "customerId": "uuid",
  "token": "secure-random-token",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneCountryCode": "string",
  "phoneNumber": "string",
  "status": "sent",
  "expiresAt": "2026-04-23T12:00:00Z",
  "createdAt": "2026-04-23T12:00:00Z",
  "createdBy": "uuid"
}
```

#### Error Responses

- **400**: Invalid input (validation failed)
- **403**: Insufficient permissions or package doesn't belong to customer
- **404**: Package not found
- **422**: Package has no active workflow assigned
- **500**: Token generation failed or database error

---

### Lookup Invitation

**GET** `/api/candidate/invitations/lookup/[token]`

Looks up an invitation by its unique token. This endpoint is public and does not require authentication.

#### Path Parameters

- `token` (string): The unique invitation token from the email link

#### Response

**200 OK**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "customerId": "uuid",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneCountryCode": "string",
  "phoneNumber": "string",
  "status": "sent",
  "expiresAt": "2026-04-23T12:00:00Z",
  "createdAt": "2026-04-23T12:00:00Z",
  "createdBy": "uuid",
  "completedAt": null,
  "lastAccessedAt": null
}
```

#### Automatic Expiration Handling

If the invitation has expired but the status hasn't been updated yet, this endpoint will automatically:
- Update the status to `expired`
- Save the previous status in `previousStatus`
- Log an expiration event to the order history

#### Error Responses

- **400**: Token parameter is missing
- **404**: No invitation found for this token
- **500**: Database error

---

### Extend Invitation

**POST** `/api/candidate/invitations/[id]/extend`

Extends the expiration date of a candidate invitation.

#### Path Parameters

- `id` (string): The invitation ID (UUID)

#### Request Body

```json
{
  "days": 5  // Optional: Number of days to extend (1-15, defaults to workflow setting)
}
```

#### Business Rules

- Days must be between 1 and 15
- If not specified, uses the workflow's `expirationDays` setting (capped at 15)
- Cannot extend completed invitations
- If extending an expired invitation, restores the previous status

#### Response

**200 OK**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "customerId": "uuid",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneCountryCode": "string",
  "phoneNumber": "string",
  "status": "sent",
  "expiresAt": "2026-05-01T12:00:00Z",  // Extended date
  "createdAt": "2026-04-23T12:00:00Z",
  "createdBy": "uuid",
  "updatedAt": "2026-04-25T12:00:00Z"   // Updated timestamp
}
```

#### Error Responses

- **400**: Invalid days parameter (not between 1 and 15)
- **403**: Insufficient permissions or invitation doesn't belong to customer
- **404**: Invitation not found
- **422**: Invitation is completed (cannot extend completed invitations)
- **500**: Database error

---

### Resend Invitation

**POST** `/api/candidate/invitations/[id]/resend`

Resends an invitation to the candidate. Currently logs the event only; actual email sending is planned for a future phase.

#### Path Parameters

- `id` (string): The invitation ID (UUID)

#### Request Body

Empty body `{}`

#### Business Rules

- Can only resend invitations with status `sent` or `opened`
- Cannot resend expired invitations (extend them first)
- Cannot resend completed invitations

#### Response

**200 OK**
```json
{
  "success": true,
  "message": "Invitation has been resent"
}
```

#### Error Responses

- **403**: Insufficient permissions, invitation doesn't belong to customer, or invalid status
- **404**: Invitation not found
- **500**: Database error

---

## Event Logging

All invitation operations are logged to the `OrderStatusHistory` table with appropriate event types:

- `invitation_created`: New invitation created
- `invitation_resent`: Invitation resent to candidate
- `invitation_extended`: Invitation expiration extended
- `invitation_expired`: Invitation automatically expired

These events include descriptive messages and are visible in order activity logs.