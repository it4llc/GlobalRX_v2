# /GlobalRX_v2/docs/standards/CODING_STANDARDS.md
# GlobalRx Platform — Coding Standards & Conventions

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the rules and standards that MUST be followed when writing,
editing, or reviewing any code in the GlobalRx platform. Before writing any code,
read this document in full. These standards are not suggestions — they are
requirements. If you believe a standard cannot be followed for a specific reason,
stop and ask the user before proceeding.

---

## SECTION 1: Working With Andy

These rules govern how Claude Code should interact and communicate during development.

### 1.1 Always Show the File Path in Code

Every code file must begin with a comment showing its full path and filename.

**Correct:**
```typescript
// /GlobalRX_v2/src/components/ui/UserForm.tsx
```

**Wrong:**
```typescript
// UserForm.tsx
```

### 1.2 Always Check Before Editing Existing Files

Before modifying a file that already exists in the project, read it first.
Understand what is already there before making any changes. Never assume what
a file contains — always verify.

### 1.3 Plain Language First

Andy is not a developer. Avoid technical jargon in explanations. When a technical
term must be used, briefly explain what it means in plain English.

### 1.4 Think Before Coding

Before writing any code, summarize the approach in plain English first. Andy
prefers to understand what is being built and why before implementation begins.
Do not jump straight to code — briefly explain the plan, then proceed.

### 1.5 Minimal Footprint

Only change what is necessary to accomplish the task. Do not refactor unrelated
code, rename things, or "clean up" files that are not part of the current task.
Small, focused changes are safer and easier to review.

### 1.6 Confirm Before Deleting Anything

Never delete a file, database record, or significant block of code without
explicitly confirming with Andy first. Describe what will be removed and why
before taking the action.

---

## SECTION 2: Styling Rules

These rules govern how the visual appearance of the platform is controlled.

### 2.1 No Inline Styling — Ever

Inline styles (writing style directly on a component, like `style={{ color: 'red' }}`)
are **strictly prohibited**. All styling must be done through centralized methods.

**Wrong:**
```tsx
<div style={{ marginTop: '16px', color: 'red' }}>Error message</div>
```

**Correct:**
```tsx
<div className="form-error">Error message</div>
```

If you believe inline styling is truly necessary, **stop and ask the user for
permission before proceeding**. Explain why it cannot be avoided.

### 2.2 Where Styles Live

All centralized styles are defined in:
- `globals.css` — for global CSS classes used across the entire platform
- Tailwind CSS utility classes — for one-off layout adjustments within components
- CSS variables in `:root` — for colors, fonts, and theme values

Never create a new local stylesheet for a single component. If a new reusable
style is needed, add it to `globals.css`.

### 2.3 Established CSS Classes

Use these existing classes — do not recreate them:

**Layout:**
- `.centered-container` — centers content with max-width and white background
- `.content-section` — consistent padding for content sections

**Forms:**
- `.form-table` — base styles for form tables
- `.form-label` / `.form-label-top` — label cell styles
- `.form-input` / `.form-input-top` — input cell styles
- `.form-info` — info/action cell styles
- `.form-required` / `.form-optional` — required/optional field indicators
- `.form-error` — error message styling

**Dropdowns:**
- `.standard-dropdown` — dropdown container
- `.dropdown-trigger` — trigger button
- `.dropdown-menu` — options container
- `.dropdown-item` — individual option
- `.dropdown-placeholder` — placeholder text

### 2.4 Tailwind Usage

Tailwind utility classes are acceptable for layout and spacing adjustments.
Always use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) for
responsive behavior — never use media queries in inline styles.

---

## SECTION 3: Component Standards

These rules govern how UI components are built and used.

### 3.1 Dialogs (Popups)

All modal dialogs MUST use the native HTML `<dialog>` element via the
platform's `ModalDialog` component. Do NOT use Shadcn UI Dialog or any
other dialog library.

**Correct pattern:**
```tsx
const dialogRef = useRef<DialogRef>(null);

<ModalDialog
  ref={dialogRef}
  title="Dialog Title"
  footer={
    <DialogFooter
      onCancel={() => dialogRef.current?.close()}
      onConfirm={handleSubmit}
      confirmText="Save"
      disabled={!isValid}
      loading={isSubmitting}
    />
  }
>
  {/* Content here */}
</ModalDialog>
```

**Dialog rules:**
- Every dialog must have a visible close/cancel button
- ESC key must close the dialog (this is automatic with native dialog)
- Focus must be trapped inside the dialog when it is open
- Dialogs must follow the layout: Header (title + close) / Content / Footer (Cancel left, Confirm right)

### 3.2 Forms

All forms MUST use the `FormTable`, `FormRow`, and `FormActions` components.
Do not build custom form layouts.

**Correct pattern:**
```tsx
import { FormTable, FormRow, FormActions } from '@/components/ui/form';

<FormTable>
  <FormRow label="Name" htmlFor="name" required={true} error={errors.name?.message}>
    <Input id="name" {...register('name')} />
  </FormRow>
</FormTable>
```

**Form rules:**
- Labels are right-aligned in a fixed 150px column
- Required fields must be clearly marked
- All input elements must use a consistent height of 28px
- Validate with Zod schemas — share the same schema between frontend and backend
- Use React Hook Form for form state management
- Button order: Cancel on the left, Submit/Confirm on the right
- Show a loading state on the submit button while the form is submitting
- Display error messages beneath the relevant input field

### 3.3 Tables

All data tables MUST use the Shadcn UI table components with consistent class names.

**Rules:**
- Tables must always be `w-full table-fixed`
- Define column widths explicitly as percentages
- Table headers must use `bg-gray-100` and `font-semibold`
- Use alternating row colors for readability
- Always use the `ActionDropdown` component for row action menus (edit, delete, etc.)
- Tables with potentially large datasets must include pagination controls
- Wrap tables in `<div className="w-full overflow-x-auto">` to allow horizontal scrolling on small screens

### 3.4 Action Menus

Always use the platform's `ActionDropdown` component for action menus on table rows.
Do not create custom dropdown menus for row actions.

---

## SECTION 4: File Naming and Organization

### 4.1 Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `UserForm.tsx` |
| Utility/helper files | camelCase | `authUtils.ts` |
| Route folders | kebab-case | `user-admin/` |
| API route files | kebab-case | `route.ts` inside `[id]/` |
| Type definition files | camelCase | `userTypes.ts` |

### 4.2 Where Files Belong

```
src/
├── app/                        # Next.js App Router pages and API routes
│   ├── api/                    # All API routes
│   │   └── [resource]/         # Collection endpoint (GET, POST)
│   │       └── [id]/           # Instance endpoint (GET, PUT, DELETE)
│   └── [module]/               # Page routes organized by module
├── components/
│   ├── layout/                 # Structural elements (nav, header, footer)
│   ├── ui/                     # Reusable UI elements (buttons, inputs, dialogs)
│   └── [module]/               # Module-specific components
├── lib/                        # Utilities and helpers
│   ├── auth.ts                 # Auth utilities
│   ├── auth.server.ts          # Server-side auth utilities
│   ├── prisma.ts               # Prisma client
│   └── utils.ts                # General helpers
├── types/                      # TypeScript type definitions
└── translations/               # Language files (en.json, es.json, etc.)
```

### 4.3 Import Order

Always organize imports in this order, with a blank line between each group:

```typescript
// 1. React and Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// 3. Internal project imports
import { FormTable, FormRow } from '@/components/ui/form';
import { getUserById } from '@/lib/utils';

// 4. Types
import type { User } from '@/types/user';
```

Always use the `@/` prefix for internal imports. Never use relative paths
like `../../components/ui/form`.

---

## SECTION 5: API Route Standards

Every API route must follow this structure without exception.

### 5.1 Required Elements for Every Route

1. **Authentication check** — must be the very first thing in every route handler
2. **Input validation** — validate all incoming data with Zod before using it
3. **Try/catch error handling** — all database calls and business logic must be wrapped
4. **Consistent response format** — use the same shape for all success and error responses

### 5.2 Standard Route Pattern

```typescript
// /GlobalRX_v2/src/app/api/[resource]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Define the validation schema for incoming data
const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export async function POST(request: NextRequest) {
  // Step 1: Always check authentication first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Validate the incoming request body
  const body = await request.json();
  const validation = createResourceSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 3: Perform database operation inside try/catch
  try {
    const result = await prisma.resource.create({
      data: validation.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5.3 HTTP Status Codes

Always return the correct status code:

| Situation | Status Code |
|-----------|------------|
| Success (read) | 200 |
| Success (created) | 201 |
| Bad input from user | 400 |
| Not logged in | 401 |
| Logged in but not allowed | 403 |
| Record not found | 404 |
| Server/database error | 500 |

### 5.4 Never Return More Data Than Needed

When returning records, only include the fields the frontend actually needs.
Do not return full database objects if only a few fields are required.
Never return password hashes, tokens, or internal system fields.

---

## SECTION 6: TypeScript Standards

### 6.1 No `any` Types

The use of `any` as a TypeScript type is prohibited. It defeats the purpose of
TypeScript and makes code harder to maintain safely. If you are unsure of a type,
use `unknown` and narrow it properly, or define an explicit type.

**Wrong:**
```typescript
const handleData = (data: any) => { ... }
```

**Correct:**
```typescript
const handleData = (data: UserFormData) => { ... }
```

### 6.2 Strict Mode

**Current State:** TypeScript strict mode is currently disabled but must be enabled
as part of enterprise readiness improvements. The codebase contains 122 uses of 'any'
type that must be replaced with proper typing before enabling strict mode.

**Target:** Enable strict mode in `tsconfig.json`. Do not disable or work around
strict mode checks once enabled.

### 6.3 Types Live in `/src/types/`

All shared type definitions belong in the `/src/types/` directory. Do not define
types locally inside a component file if they are used in more than one place.

### 6.4 Zod Schemas as the Source of Truth

For any data that comes from a form or an API, define a Zod schema first and
derive the TypeScript type from it. This ensures the type and the validation
rule are always in sync.

```typescript
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Derive the type from the schema — never define it separately
type UserFormData = z.infer<typeof userSchema>;
```

---

## SECTION 7: Translation Standards

All user-facing text must support the platform's translation system.

### 7.1 Never Hardcode Display Text

Do not write English text directly into components. All display text must use
the translation system via the `t()` function or `data-i18n-key` attribute.

**Wrong:**
```tsx
<button>Save User</button>
```

**Correct:**
```tsx
<button>{t('common.saveUser')}</button>
```

### 7.2 Adding New Text

When adding any new user-facing text:
1. Add the key and English text to `en.json`
2. Add the key (with appropriate translation or placeholder) to all other language files
3. Use the key in the component

### 7.3 Key Naming Convention

Translation keys follow a dot-notation hierarchy:
- `module.section.element` for module-specific text
- `common.action` for text used across multiple modules

Examples: `userAdmin.form.nameLabel`, `common.save`, `common.cancel`

---

## SECTION 8: Business Logic Standards

### 8.1 Order ID Format

Background check orders use this ID format:

```
YYYYMMDD-[CustomerCode]-NNNN
```

Example: `20250223-XK7-0003`

| Part | Format | Description |
|------|--------|-------------|
| Date | 8 digits, no dashes (YYYYMMDD) | Date the order was placed |
| Customer Code | 3–4 alphanumeric characters | Short code representing the customer |
| Sequence | 4 digits, zero-padded | That customer's order count for the day |

**Rules:**
- Sequence resets to 0001 each day, per customer
- Maximum 9,999 orders per customer per day (4-digit sequence)
- Customer codes are short alphanumeric identifiers — never the customer's full name
- The ID must be human-readable and suitable for reading aloud over the phone

### 8.2 Customer Codes

- 3–4 characters, alphanumeric
- Assigned when a customer account is created
- Must be unique across all customers
- Should not be the customer's full company name

---

## SECTION 9: Security Standards

These rules protect the platform and the sensitive personal data it handles.

### 9.1 Authentication on Every API Route

Every API route that reads or writes data must check authentication before
doing anything else. **No exceptions.**

**Current Issue:** Audit found unauthenticated endpoints including `/api/dsx` GET
requests and `/api/debug-session`. These must be secured immediately.

**Critical:** Any API route without authentication is a security vulnerability.

### 9.2 Role Checks Must Be Server-Side

Never rely on the frontend hiding a button or page to protect a feature.
Role and permission checks must happen in the API route, on the server.

### 9.3 Validate All Input

Never use data from a request body, query parameter, or URL without validating
it first with a Zod schema. Assume all incoming data could be malformed or malicious.

### 9.4 No Secrets in Code

Database URLs, API keys, passwords, and other secrets must only exist in
environment variables (`.env.local`). Never hardcode secrets in any file
that is committed to GitHub.

### 9.5 Environment Variables Must Be Documented

Every environment variable used in the project must be listed in `.env.example`
with a description of what it is (but not its real value).

---

## SECTION 10: Error Handling Standards

### 10.1 Every API Route Needs Try/Catch

All database calls and external API calls must be inside a try/catch block.
Silent failures are not acceptable.

### 10.2 User-Facing Error Messages

When an API call fails in the UI, the user must see a clear, plain-English
error message. Never let an error fail silently with no feedback.

### 10.3 Error Boundaries

Every major route must have an `error.tsx` file defined to handle unexpected
rendering errors gracefully.

### 10.4 Logging Standards

**Current Issue:** The codebase contains 625 console statements across 140 files,
including sensitive data (passwords, emails, permissions). This is a critical
security vulnerability.

**Requirements:**
- Use Winston structured logging instead of console statements
- Never log sensitive data (passwords, emails, tokens, personal information)
- Replace all console.log/error/warn statements with proper logging
- Use appropriate log levels: error, warn, info, debug
- Log structured data in JSON format for production monitoring

**Pattern:**
```typescript
import logger from '@/lib/logger';

// Wrong
console.log(`User ${email} failed login`);

// Correct
logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'invalid_credentials'
  // Never log email or other PII
});
```

---

## SECTION 11: Testing Standards

**Current State:** The codebase has zero test coverage, which is a critical enterprise readiness gap.

### 11.1 Testing Requirements

All new code must include appropriate tests. No pull requests will be accepted without tests.

**Testing Stack:**
- **Unit tests:** Vitest for utilities and services
- **Component tests:** React Testing Library for UI components
- **Integration tests:** API route testing with test database
- **E2E tests:** Playwright for critical user workflows

### 11.2 Test Coverage Targets

- **New code:** 100% test coverage required
- **Legacy code:** Add tests when modifying existing code
- **Critical paths:** Authentication, permissions, order processing must have tests

### 11.3 Test Organization

```
src/
├── __tests__/              # Unit tests
├── components/
│   └── __tests__/          # Component tests
└── app/api/
    └── __tests__/          # API route tests
```

---

## SECTION 12: Monitoring and Observability Standards

**Current Issue:** No production monitoring, error tracking, or health checks exist.

### 12.1 Required Monitoring

- **Error tracking:** Sentry integration required for all environments
- **Health checks:** `/api/health` and `/api/ready` endpoints required
- **Performance monitoring:** APM integration for production
- **Structured logging:** Winston logger for all application events

### 12.2 Health Check Requirements

Every application must provide:
- **Liveness check** (`/api/health`) - service is running
- **Readiness check** (`/api/ready`) - service can handle traffic
- **Deep health check** - database and dependency verification

---

## SECTION 13: Data Privacy and Retention Standards

**Current Issues:** Real credentials in seed data, no data retention policies, limited GDPR compliance.

### 13.1 Personal Data Handling

- **Never log PII** - no emails, names, addresses in logs
- **Anonymize test data** - no real credentials in seed files
- **Data minimization** - only collect and return necessary data
- **Retention policies** - automatic cleanup of old data

### 13.2 GDPR Compliance Requirements

All features handling personal data must support:
- **Right to access** - user data export functionality
- **Right to erasure** - user data deletion capability
- **Right to rectification** - data correction workflows
- **Data portability** - machine-readable export formats

### 13.3 Backup and Recovery Standards

- **Automated backups** - daily database backups required
- **Remote storage** - backups must be stored off-site
- **Backup testing** - regular restore verification required
- **Migration safety** - pre-migration backups mandatory

---

## QUICK REFERENCE CHECKLIST

Before submitting any code, verify:

- [ ] File path is in a comment at the top of the file
- [ ] No inline styles used anywhere
- [ ] All new styles added to `globals.css` or use existing Tailwind classes
- [ ] Dialogs use `ModalDialog` component (not Shadcn Dialog)
- [ ] Forms use `FormTable` / `FormRow` components
- [ ] Tables use `ActionDropdown` for row actions
- [ ] Every API route checks authentication first
- [ ] Every API route validates input with Zod
- [ ] Every API route has try/catch error handling
- [ ] No `any` TypeScript types used
- [ ] All user-facing text uses the translation system
- [ ] No secrets or sensitive values hardcoded
- [ ] Imports use `@/` prefix (no relative paths)
- [ ] File is named using the correct convention (PascalCase/camelCase/kebab-case)
- [ ] **NEW:** Tests written for all new code (unit, component, or integration)
- [ ] **NEW:** Winston logger used instead of console statements
- [ ] **NEW:** No PII (emails, passwords, tokens) logged anywhere
- [ ] **NEW:** Health checks included for new API routes
- [ ] **NEW:** Data retention policies considered for personal data
- [ ] **NEW:** Authentication verified on all new API routes (no exceptions)
