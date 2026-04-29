# Technical Plan: Phase 5, Stage 1 — Candidate Landing Page & Password Creation
**Based on specification:** phase5-stage1-candidate-landing-password.md  
**Date:** April 28, 2026

## Database Changes
No database changes are required. The `CandidateInvitation` table already has all necessary fields from Phase 3:
- `passwordHash` (String?) - currently null, will store the hashed password
- `status` (String) - will change from "pending" to "in_progress" 
- `lastAccessedAt` (DateTime?) - will be updated when password is created

## New Files to Create

### 1. `/src/app/portal/candidate/[token]/page.tsx`
- **Purpose:** Main candidate landing page component (Next.js page)
- **Contents:** Server component that renders the candidate landing experience
- Fetches invitation data, determines what to show based on status

### 2. `/src/app/portal/candidate/[token]/layout.tsx`
- **Purpose:** Standalone layout for candidate pages (no admin portal chrome)
- **Contents:** Clean, minimal layout wrapper specifically for candidates

### 3. `/src/components/candidate/CandidateLandingContent.tsx`
- **Purpose:** Client component that handles the main landing page logic
- **Contents:** Manages state, calls APIs, renders appropriate content based on invitation status

### 4. `/src/components/candidate/PasswordCreationForm.tsx`
- **Purpose:** Client component for the password creation form
- **Contents:** Form with password/confirm fields, validation, submission logic

### 5. `/src/components/ui/password-input.tsx`
- **Purpose:** Reusable password input component with show/hide toggle
- **Contents:** Input field with eye icon toggle for visibility

### 6. `/src/app/api/candidate/auth/create-password/route.ts`
- **Purpose:** API endpoint to create password for candidate
- **Contents:** Validates token and password, saves hashed password, updates invitation

### 7. `/src/lib/validations/candidate-auth.ts`
- **Purpose:** Zod schemas for candidate authentication
- **Contents:** Password creation schema with validation rules

### 8. `/src/types/candidate-auth.ts`
- **Purpose:** TypeScript types for candidate authentication
- **Contents:** Types derived from Zod schemas

### 9. `/src/app/portal/candidate/[token]/error.tsx`
- **Purpose:** Error boundary for candidate pages
- **Contents:** Clean error display for unexpected errors

## Existing Files to Modify

### 1. `/src/lib/services/candidate-invitation.service.ts`
- **Current:** Contains invitation lookup and management functions
- **Change:** Add function to check if password exists (returns boolean indicating password is set)
- **Change:** Modify `lookupByToken` to include customer company name in response
- **Confirmed:** File read and verified

### 2. `/src/types/candidateInvitation.ts`
- **Current:** Contains invitation types
- **Change:** Add `InvitationLookupResponse` type that includes customer company name and password existence flag
- **Confirmed:** File read and verified

### 3. `/src/app/api/candidate/invitations/lookup/[token]/route.ts`
- **Current:** Returns invitation data without customer info
- **Change:** Include customer company name in the response
- **Confirmed:** File read and verified

### 4. `/src/translations/en-US.json`
- **Current:** Contains all UI text translations
- **Change:** Add new translation keys for candidate landing page
- **Confirmed:** File read and verified

## API Routes

### 1. `POST /api/candidate/auth/create-password`
- **HTTP Method:** POST
- **Authentication:** None required (token is the authentication)
- **Input data:**
  - `token` (string, required): The invitation token from URL
  - `password` (string, required): The candidate's chosen password
- **Validation:**
  - Password minimum 8 characters
  - Must contain at least one letter and one number
- **Success returns:** `{ success: true, status: "in_progress" }`
- **Error handling:**
  - 400: Missing fields, invalid token format, password doesn't meet requirements, invitation expired, password already exists
  - 404: Token not found
  - 500: Database or hashing error

### 2. `GET /api/candidate/invitations/lookup/[token]` (Modified)
- **Change:** Add customer company name to response
- **New response fields:**
  - `customerName` (string): The company name that sent the invitation
  - `hasPassword` (boolean): Whether a password has already been set

## Zod Validation Schemas

### 1. `createPasswordSchema` in `/src/lib/validations/candidate-auth.ts`
```typescript
{
  token: z.string().min(1, "Token is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
}
```

## TypeScript Types

### 1. `CreatePasswordInput` in `/src/types/candidate-auth.ts`
- Derived from `z.infer<typeof createPasswordSchema>`
- Fields: `token: string`, `password: string`

### 2. `InvitationLookupResponse` in `/src/types/candidateInvitation.ts`
- Extends existing `InvitationResponse`
- Additional fields: `customerName: string`, `hasPassword: boolean`

## UI Components

### 1. `/src/app/portal/candidate/[token]/page.tsx`
- **Type:** Server component
- **Renders:** Wrapper that passes token to client component
- **API calls:** None (deferred to client component)

### 2. `/src/components/candidate/CandidateLandingContent.tsx`
- **Type:** Client component (`"use client"`)
- **Renders:** Main content based on invitation status
- **Uses:** `Card` from ui library for layout
- **API calls:** 
  - `GET /api/candidate/invitations/lookup/[token]` on mount
  - Shows appropriate content based on response

### 3. `/src/components/candidate/PasswordCreationForm.tsx`
- **Type:** Client component (`"use client"`)
- **Renders:** Form with password fields and submit button
- **Uses:** 
  - `PasswordInput` component (new)
  - `Button` from ui library
  - `react-hook-form` with Zod validation
- **API calls:** `POST /api/candidate/auth/create-password`

### 4. `/src/components/ui/password-input.tsx`
- **Type:** Client component (`"use client"`)
- **Renders:** Input with show/hide toggle
- **Uses:**
  - `Input` from existing ui library
  - `Eye` and `EyeOff` icons from `lucide-react`

## Translation Keys

All keys follow the `module.section.element` convention:

```json
{
  "candidate.landing.welcome": "Welcome, {firstName}!",
  "candidate.landing.invitation": "{companyName} has invited you to complete a background check application.",
  "candidate.landing.getStarted": "To get started, please create a password that you'll use to access your application.",
  "candidate.landing.createPassword": "Create Password",
  "candidate.landing.passwordLabel": "Password",
  "candidate.landing.confirmPasswordLabel": "Confirm Password",
  "candidate.landing.passwordHint": "Minimum 8 characters with at least one letter and one number",
  "candidate.landing.passwordMismatch": "Passwords do not match",
  "candidate.landing.passwordTooShort": "Password must be at least 8 characters",
  "candidate.landing.passwordNoLetter": "Password must include at least one letter",
  "candidate.landing.passwordNoNumber": "Password must include at least one number",
  "candidate.landing.success": "Your password has been created!",
  "candidate.landing.successMessage": "You can return to this link at any time to continue your application.",
  "candidate.landing.invalidLink": "This link is not valid",
  "candidate.landing.invalidLinkMessage": "Please check your email for the correct link, or contact the company that sent you the invitation.",
  "candidate.landing.expiredLink": "This invitation link has expired",
  "candidate.landing.expiredLinkMessage": "Please contact {companyName} to request a new link.",
  "candidate.landing.alreadyCompleted": "Your application has already been submitted",
  "candidate.landing.alreadyCompletedMessage": "No further action is needed.",
  "candidate.landing.returningUser": "Welcome back!",
  "candidate.landing.returningUserMessage": "Please come back later — login will be available soon.",
  "candidate.landing.error": "Something went wrong",
  "candidate.landing.errorMessage": "Please try again in a few minutes. If the problem continues, contact the company that sent you the invitation.",
  "candidate.landing.tryAgain": "Try Again",
  "candidate.landing.loading": "Loading..."
}
```

## Order of Implementation

1. **Database schema changes** - None required
2. **Prisma migration** - None required  
3. **TypeScript types** - `/src/types/candidate-auth.ts`, update `/src/types/candidateInvitation.ts`
4. **Zod schemas** - `/src/lib/validations/candidate-auth.ts`
5. **Service layer updates** - Modify `/src/lib/services/candidate-invitation.service.ts`
6. **API routes** - Create `/src/app/api/candidate/auth/create-password/route.ts`, modify lookup route
7. **UI components** - Create password-input, then form, then landing content
8. **Page and layout** - Create layout first, then page
9. **Translation keys** - Add all keys to `/src/translations/en-US.json`
10. **Error boundary** - Create `/src/app/portal/candidate/[token]/error.tsx`

## Risks and Considerations

### 1. Mobile Responsiveness
The specification emphasizes mobile-first design. All components must be tested at 320px width. The password show/hide toggle needs adequate touch target size (44px minimum).

### 2. Password Security
Must use bcryptjs (already in project) with the same salt rounds as the existing user system. The `hashPassword` function from `/src/lib/auth.server.ts` should be used for consistency.

### 3. Token Security
The token is passed in the URL and must be validated on every request. The existing `lookupByToken` function handles expiration checking, which must be preserved.

### 4. State Management
After password creation, the candidate sees a success message but is NOT logged in. This is intentional — login functionality comes in Stage 2.

### 5. Browser Back Button
After successful password creation, the back button should still show the success message, not the form again. This requires careful state management in the client component.

### 6. Missing Customer Name
The current `lookupByToken` function doesn't include the customer company name. We need to modify it to join with the Customer table through the customerId field.

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (no specific field table in this spec, but password requirements are matched)
- [x] All existing patterns from the codebase are followed
- [x] Security considerations are addressed
- [x] Mobile requirements from the spec are acknowledged
