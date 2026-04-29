# Candidate Authentication API

This document describes the candidate authentication system introduced in Phase 5 Stage 2. This system is completely separate from the main user authentication (NextAuth) and is designed for candidates who need to log in to complete their background check applications.

## Overview

The candidate authentication system allows candidates who have already created a password to log back into their application using their invitation token and password. Sessions are managed using JWT tokens stored in HTTP-only cookies with a 4-hour expiration that refreshes on activity.

**Key Security Features:**
- Rate limiting: 5 failed attempts trigger a 15-minute lockout
- JWT session tokens with 4-hour sliding expiration
- HTTP-only, secure cookies
- Password verification using bcrypt
- Separate from main user authentication system

## Endpoints

### POST /api/candidate/auth/verify

Verifies a candidate's password and creates a session.

**Request:**
```json
{
  "token": "invitation_token_here",
  "password": "candidate_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "firstName": "Sarah",
    "status": "accessed",
    "token": "invitation_token_here"
  }
}
```

Also sets the `candidate_session` HTTP-only cookie.

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing token or password | `{ "error": "Token and password are required" }` |
| 401 | Invalid credentials | `{ "error": "Invalid credentials" }` |
| 401 | Expired invitation | `{ "error": "This invitation has expired" }` |
| 401 | Completed invitation | `{ "error": "This invitation has already been completed" }` |
| 429 | Rate limited | `{ "error": "Too many attempts. Please try again later.", "retryAfterMinutes": 15 }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

**Security Notes:**
- Token not found, no password set, and wrong password all return "Invalid credentials"
- Rate limiting is per invitation ID (5 attempts in 15 minutes)
- Only invitations with status "accessed" can log in
- Failed attempts are tracked in server memory (resets on server restart)

### GET /api/candidate/auth/session

Checks if the candidate has a valid session and returns their information.

**Request:** No body. Uses `candidate_session` cookie.

**Success Response (200):**
```json
{
  "authenticated": true,
  "invitation": {
    "id": "uuid",
    "firstName": "Sarah",
    "status": "accessed",
    "token": "invitation_token_here"
  }
}
```

Also refreshes the session cookie expiration.

**Error Response (401):**
```json
{
  "authenticated": false
}
```

**Validation Steps:**
1. Verifies JWT signature and expiration
2. Checks invitation still exists in database
3. Confirms invitation status is still "accessed"
4. Confirms invitation hasn't expired since login
5. Refreshes session expiration to 4 hours from now

### POST /api/candidate/auth/logout

Clears the candidate's session cookie.

**Request:** No body.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

This endpoint is safe to call multiple times and doesn't require an existing session.

## Session Management

### Session Data
Sessions contain:
- `invitationId`: UUID of the candidate invitation
- `token`: The invitation token for URL routing
- `firstName`: Candidate's first name for display
- `status`: Current invitation status
- `expiresAt`: When this session expires

### Cookie Configuration
- **Name:** `candidate_session`
- **Type:** HTTP-only, secure (HTTPS only in production)
- **SameSite:** Lax (allows following invitation links from email)
- **Duration:** 4 hours sliding expiration
- **Path:** / (available to all candidate routes)

### Environment Variables
- `CANDIDATE_SESSION_SECRET`: Required in production for JWT signing
- Uses development fallback key in non-production environments

## Rate Limiting

Failed login attempts are tracked in server memory:
- 5 attempts within 15 minutes triggers lockout
- Lockout duration: 15 minutes from last failed attempt
- Data is cleaned up automatically every 5 minutes
- Server restart clears all lockout data

## Integration with Landing Page

The landing page at `/candidate/[token]` uses this authentication system:
1. Calls enhanced invitation lookup to get `hasPassword` field
2. If `hasPassword` is true, shows LoginForm component
3. LoginForm calls POST /api/candidate/auth/verify
4. On success, redirects to `/candidate/[token]/portal`

The portal page calls GET /api/candidate/auth/session to verify authentication.

## Error Handling

All candidate authentication errors return consistent JSON responses. The frontend should:
- Show generic error messages for security
- Clear password fields on failed attempts
- Display lockout countdown during rate limiting
- Redirect to login page when sessions expire

## Testing

Tests cover:
- Schema validation for all request/response formats
- Rate limiting behavior with timing verification
- Session creation, validation, and refresh
- Error conditions for expired/completed invitations
- Integration with the LoginForm component