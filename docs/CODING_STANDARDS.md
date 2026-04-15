# /GlobalRX_v2/docs/CODING_STANDARDS.md
# GlobalRx Platform — Coding Standards & Conventions

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the general coding rules and conventions for the GlobalRx platform. These standards are not suggestions — they are requirements. If you believe a standard cannot be followed for a specific reason, stop and ask before proceeding.

This document covers **general, cross-cutting rules**: how to work with Andy, file naming, TypeScript, error handling, logging, privacy, documentation, and file size. Specialized rules live in separate documents — see "Where rules live" below.

---

## Where rules live

Before starting any task, read the standards file that matches the work you are doing. Do not assume rules that apply to one area also apply to another.

| If you are working on... | Read this file |
|---|---|
| API routes (`src/app/api/**`) | `API_STANDARDS.md` |
| Database schema, Prisma, migrations | `DATABASE_STANDARDS.md` |
| React components, forms, dialogs, tables, styling, translations | `COMPONENT_STANDARDS.md` |
| Writing or fixing tests | `TESTING_STANDARDS.md` |
| Anything else (or general principles) | This document |

If your task touches more than one area, read every file that applies. Do not skim.

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

Before modifying a file that already exists in the project, read it first. Understand what is already there before making any changes. Never assume what a file contains — always verify.

### 1.3 Plain Language First

Andy is not a developer. Avoid technical jargon in explanations. When a technical term must be used, briefly explain what it means in plain English.

### 1.4 Think Before Coding

Before writing any code, summarize the approach in plain English first. Andy prefers to understand what is being built and why before implementation begins. Do not jump straight to code — briefly explain the plan, then proceed.

### 1.5 Minimal Footprint

Only change what is necessary to accomplish the task. Do not refactor unrelated code, rename things, or "clean up" files that are not part of the current task. Small, focused changes are safer and easier to review.

Never create files that the architect's plan did not specify. If the architect says to modify one file, only that file is changed. If you believe a new file is genuinely needed that was not in the plan, stop immediately and explain why to Andy before creating anything.

Never create files just to make tests pass. If a test requires a file that should not exist, the test is wrong and must be rewritten — not satisfied by creating the file. Creating ghost routes or duplicate service layers to satisfy tests introduces technical debt and bypasses the real application code path, meaning the tests prove nothing about how the app actually works.

### 1.6 Confirm Before Deleting Anything

Never delete a file, database record, or significant block of code without explicitly confirming with Andy first. Describe what will be removed and why before taking the action.

---

## SECTION 2: File Naming and Organization

### 2.1 Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `UserForm.tsx` |
| Utility/helper files | camelCase | `authUtils.ts` |
| Route folders | kebab-case | `user-admin/` |
| API route files | kebab-case | `route.ts` inside `[id]/` |
| Type definition files | camelCase | `userTypes.ts` |

### 2.2 Where Files Belong

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

### 2.3 Import Order

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

Always use the `@/` prefix for internal imports. Never use relative paths like `../../components/ui/form`.

### 2.4 Import What You Use

All imports must be present before using any API. A missing import that happens to compile (for example, because another file in the project exports the same name) will still cause runtime errors. Always import every module, function, and type that your code references.

```typescript
// ✅ CORRECT — import all dependencies explicitly
import logger from '@/lib/logger';

logger.error('Operation failed', { reason });
```

---

## SECTION 3: TypeScript Standards

### 3.1 No `any` Types

The use of `any` as a TypeScript type is prohibited. It defeats the purpose of TypeScript and makes code harder to maintain safely. If you are unsure of a type, use `unknown` and narrow it properly, or define an explicit type.

**Common `any` anti-patterns to avoid:**

**1. User and permission objects:**
```typescript
// ❌ WRONG
const user: { id: string; permissions?: any } = ...

// ✅ CORRECT
interface ServiceUser {
  id: string;
  userType: string;
  vendorId?: string;
  permissions?: Record<string, unknown>;
}
```

**2. Prisma where clauses and update data:**
```typescript
// ❌ WRONG
const where: any = {};
const updateData: any = { status: newStatus };

// ✅ CORRECT
interface ServiceWhereClause {
  orderId?: string;
  status?: ServiceStatus;
  assignedVendorId?: string;
}
const where: ServiceWhereClause = {};

interface ServiceUpdateData {
  status?: ServiceStatus;
  assignedVendorId?: string | null;
  updatedAt?: Date;
}
const updateData: ServiceUpdateData = { status: newStatus };
```

**3. Array operations:**
```typescript
// ❌ WRONG — lose typing inside forEach/map
services.forEach((service: any) => { ... });

// ✅ CORRECT — let TypeScript infer
services.forEach((service) => { ... });
```

**When you must use type assertions:** use them sparingly, document why, and prefer `as unknown as TargetType` over `as any`. If you keep reaching for assertions, the underlying data structure probably needs fixing instead.

### 3.2 Strict Mode

**Current State:** TypeScript strict mode is currently disabled but must be enabled as part of enterprise readiness improvements. The codebase contains a known number of `any` uses that must be replaced with proper typing before enabling strict mode.

**Target:** Enable strict mode in `tsconfig.json`. Do not disable or work around strict mode checks once enabled.

### 3.3 Types Live in `/src/types/`

All shared type definitions belong in the `/src/types/` directory. Do not define types locally inside a component file if they are used in more than one place.

**Best practices:**

1. **Create feature-specific type files:**
   - `src/types/service-fulfillment.ts` — types for service fulfillment feature
   - `src/types/order.ts` — types for order management
   - `src/types/user.ts` — user and permission types

2. **Export related types together:**
```typescript
// src/types/service-fulfillment.ts
export interface ServiceFulfillment { ... }
export interface ServiceUser { ... }
export interface ServiceWhereClause { ... }
export type ServiceStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled';
```

3. **Never duplicate type definitions.** If you find yourself defining the same interface in multiple places, move it to `/src/types/`.

### 3.4 Zod Schemas as the Source of Truth

For any data that comes from a form or an API, define a Zod schema first and derive the TypeScript type from it. This ensures the type and the validation rule are always in sync.

```typescript
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Derive the type from the schema — never define it separately
type UserFormData = z.infer<typeof userSchema>;
```

---

## SECTION 4: Error Handling

API-specific error handling rules (try/catch on every route, status code conventions) live in `API_STANDARDS.md`. This section covers error handling principles that apply to all code, not just API routes.

### 4.1 User-Facing Error Messages

When an operation fails in the UI, the user must see a clear, plain-English error message. Never let an error fail silently with no feedback.

### 4.2 Error Boundaries

Every major route must have an `error.tsx` file defined to handle unexpected rendering errors gracefully.

### 4.3 Never Swallow Errors

Catching an exception and doing nothing is always wrong. If you catch an error, either:
- Log it (following Section 5 rules) and continue with a safe fallback, or
- Transform it into a user-facing error message and surface it, or
- Re-throw it so a higher layer can handle it

A bare `catch {}` with no body hides real problems and makes bugs invisible.

---

## SECTION 5: Logging and Personal Data

### 5.1 Use Winston, Not Console

All logging must go through the Winston logger. Do not use `console.log`, `console.error`, or `console.warn` in application code.

```typescript
// ❌ WRONG
console.log(`User ${email} failed login`);

// ✅ CORRECT
import logger from '@/lib/logger';

logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'invalid_credentials'
});
```

### 5.2 Never Log Personal Information

Personal information must never appear in logs, anywhere, for any reason. This applies to both application logs and error messages.

**Never log:**
- Email addresses
- Names (first, last, or full)
- Physical addresses
- Phone numbers
- Social security numbers or other government IDs
- Passwords or password hashes
- Session tokens, API keys, or authentication headers
- Date of birth
- Any other field that identifies a real person

If you need to correlate log entries to a user for debugging, log the user's internal ID (a UUID) — not their email or name. IDs are non-identifying to anyone without database access; emails and names are.

**Rationale:** Logs are frequently shipped to third-party services (error trackers, log aggregators) and stored for long periods. Putting PII in logs turns every log destination into a place that has to be GDPR-compliant, which it usually is not.

### 5.3 Log Levels

Use the appropriate log level so production monitoring can filter noise from real problems:

- `error` — something broke that needs human attention (a database call failed, an external API returned 500)
- `warn` — something unexpected happened but the system recovered (an auth check failed, a retry succeeded on second attempt)
- `info` — normal operational events worth recording (user logged in, order submitted)
- `debug` — diagnostic detail, typically only enabled in development

### 5.4 Structured, Not Concatenated

Log structured data as a second argument, not concatenated into the message string. This makes logs searchable and filterable in production monitoring tools.

```typescript
// ❌ WRONG — concatenation, hard to filter
logger.error(`Failed to create order ${orderId} for customer ${customerId}`);

// ✅ CORRECT — structured
logger.error('Failed to create order', {
  event: 'order_create_failure',
  orderId,
  customerId,
});
```

---

## SECTION 6: Monitoring and Observability

### 6.1 Required Monitoring

Every production deployment must have:
- **Error tracking** — Sentry integration for all environments
- **Health checks** — `/api/health` and `/api/ready` endpoints
- **Performance monitoring** — APM integration for production
- **Structured logging** — Winston logger for all application events (see Section 5)

### 6.2 Health Check Requirements

Every application must provide:
- **Liveness check** (`/api/health`) — service is running
- **Readiness check** (`/api/ready`) — service can handle traffic
- **Deep health check** — database and dependency verification

---

## SECTION 7: Data Privacy and Retention

Logging rules for PII are in Section 5. This section covers broader data handling rules.

### 7.1 Personal Data Handling

- **Anonymize test data** — no real credentials, real names, or real emails in seed files
- **Data minimization** — only collect and return necessary data; do not pull full database objects when a few fields will do
- **Retention policies** — automatic cleanup of old data on a defined schedule

### 7.2 GDPR Compliance

All features handling personal data must support:
- **Right to access** — user data export functionality
- **Right to erasure** — user data deletion capability
- **Right to rectification** — data correction workflows
- **Data portability** — machine-readable export formats

### 7.3 Backup and Recovery

- **Automated backups** — daily database backups required
- **Remote storage** — backups must be stored off-site
- **Backup testing** — regular restore verification required
- **Migration safety** — pre-migration backups mandatory

---

## SECTION 8: Documentation Standards

### 8.1 When Documentation is Required

Documentation must be created or updated in these situations:

1. **New features** — document how to use the feature
2. **API changes** — update endpoint documentation (see `API_STANDARDS.md` for JSDoc format)
3. **Complex business logic** — explain the "why," not just the "what"
4. **Non-obvious code** — if it took you time to figure out, document it
5. **Breaking changes** — document migration path
6. **Configuration changes** — update `.env.example`

### 8.2 Code Comments

**When to add comments:**
- Complex algorithms or business rules
- Non-obvious workarounds or bug fixes
- TODO items with context and ownership
- External integration points
- Security considerations

**When NOT to add comments:**
- Obvious code that is self-documenting
- Every function and variable (TypeScript types are documentation)
- Restating what the next line of code already says

**Good comment:**
```typescript
// Calculate order sequence: reset to 0001 each day per customer
// so that order IDs are human-readable (e.g., 20250223-XK7-0003)
// and can be communicated over phone support.
```

**Bad comment:**
```typescript
// Set name to the name value
const name = formData.name;
```

### 8.3 Data Key Consistency

When working with form field data, API responses, or any data structures where objects can be referenced by different keys, ensure consistent key usage throughout the data flow.

**Common bug pattern:**
```typescript
// ❌ WRONG — inconsistent keying causes data loss in forms
// Draft data comes with field names as keys
const draftData = { "School Name": "Harvard", "Email": "test@example.com" };

// But form expects field IDs as keys
const formFields = { "uuid-123": "Harvard", "uuid-456": "test@example.com" };

// This mismatch causes field values not to appear when editing drafts
```

**Correct pattern:**
```typescript
// ✅ CORRECT — remap keys consistently before using data
const remapFieldNamesToIds = (
  fieldsByName: Record<string, unknown>,
  fieldDefinitions: Field[]
) => {
  const remapped: Record<string, unknown> = {};
  Object.entries(fieldsByName).forEach(([fieldName, fieldValue]) => {
    const matchingField = fieldDefinitions.find(f => f.name === fieldName);
    if (matchingField) {
      remapped[matchingField.id] = fieldValue;
    }
  });
  return remapped;
};
```

**Rule:** When field data can be referenced by both name and ID, always establish which key type the consuming code expects and transform data accordingly before use.

### 8.4 Merge-Logic Documentation

When implementing deduplication or data-merging logic, document the merge strategy clearly in code comments. The reader needs to know which rule wins in a conflict:

- **OR logic** — the most restrictive rule wins (e.g., if any service requires a field, the field is required)
- **AND logic** — all conditions must be met
- **First-wins** — only use when order matters and later entries should be ignored
- **Last-wins** — only use when the most recent value should override

```typescript
// Requirements deduplication uses OR logic: if ANY service requires
// the field, it is marked required in the UI. First-wins would be
// wrong here because it could hide a required field.
if (existingField && isRequired) {
  existingField.required = true;
}
```

### 8.5 README and Feature Docs

Update `README.md` when adding new dependencies, changing setup steps, adding new npm scripts, or changing the deployment process.

For significant features, create a markdown file in `docs/features/` covering:
- **Overview** — what the feature does
- **Usage** — how to use it from a user perspective
- **Technical implementation** — key files, data flow, schema changes
- **Configuration** — environment variables or settings needed
- **Testing** — how to verify it works

---

## SECTION 9: File Size Guidance

This section is a soft trigger, not a hard cap. The goal is to catch files that have grown past the point where they can be maintained comfortably, before they become the kind of file nobody wants to touch.

### 9.1 The Numbers

- **Under 300 lines** — no concern, this is the healthy range for most source files.
- **300 to 500 lines** — starting to get large. No action required, but worth noticing. If you are about to add significant new content to a file in this range, consider whether the new content belongs in its own file.
- **500 to 600 lines** — warning zone. Adding more code to a file in this range should be a deliberate decision, not a default. Before adding, ask whether the new content would be better placed in a new file.
- **Over 600 lines** — hard stop for agents. No automated agent may add code to a source file over 600 lines without explicitly stopping to ask first (see Implementer Agent Rule 10 in `.claude/agents/implementer.md`). Humans may override this rule, but the override should be a conscious decision, not an oversight.

### 9.2 What This Applies To

This guidance applies to TypeScript, TSX, JavaScript, and JSX source files in `src/` and `prisma/`.

It does **not** apply to:
- Agent instruction files in `.claude/agents/` (those are documentation, not source code, and may be longer when the content is load-bearing)
- Standards files in `docs/` (though see Section 9.5 below — standards files should also stay readable)
- Configuration files (`.eslintrc`, `tsconfig.json`, `next.config.js`, etc.)
- Generated files (Prisma client output, build artifacts, lockfiles)
- Migration files (`prisma/migrations/*/migration.sql`)
- Test files (subject to their own separate discipline — see `TESTING_STANDARDS.md`)

### 9.3 Why Soft Triggers Instead of a Hard Cap

Hard caps cause worse problems than they solve. When a file hits a hard limit, the pressure to "stay under" leads to creative workarounds: splitting things along arbitrary seams, creating wrapper files whose only purpose is to move lines out of another file, or moving functions into new files where they no longer have natural neighbors. All of those make the code harder to understand, not easier.

A soft trigger does something different: it forces a deliberate pause. At 500 lines, the question is "should I be adding more here?" and the answer is usually "yes, but think about whether this belongs in a new file." At 600 lines, the question becomes a full stop — "this file has grown past the point where adding more is the right default, and a human needs to decide what to do."

The deliberate pause is the point. It catches the failure mode where every individual addition seems reasonable in isolation but the cumulative effect is a file that has grown past the point of maintainability.

### 9.4 What To Do When a File Is Approaching the Limit

The answer is almost never "shrink this file by deleting things." It is usually "split this file along a natural seam" or "put the new content in a new file instead of this one."

Natural seams for service files usually run along responsibility boundaries: queries vs. mutations vs. status transitions vs. view tracking, for example. Natural seams for component files usually run along sub-components that have grown complex enough to stand alone, or along hooks defined inline that could live in their own hook file.

When a file is genuinely over the limit and you are unsure how to split it, the right move is to log it as tech debt and continue working in the existing file for the current task. File splitting is its own project with its own risk surface, and doing it reactively in the middle of unrelated work is how regressions happen. Open a dedicated branch, split the file cleanly, make sure all tests still pass, and ship the split as its own PR.

### 9.5 Standards Files Are Not Exempt From Readability

Standards files in `docs/` are not subject to the 500/600 line agent rule, but long standards files create their own problems. Agents asked to read a long standards file as "required reading" are more likely to skim the parts that feel less relevant, which means the rules that are actually load-bearing for the current task may get missed. If a standards file is growing past ~600 lines and contains content that would be better placed in a dedicated standards file (e.g., testing content that belongs in `TESTING_STANDARDS.md`), move it. The point of having multiple standards files is that each one can stay focused and readable.

---

## QUICK REFERENCE CHECKLIST

Use this checklist at the end of any task before declaring it complete. For specialized work (API routes, database, components, tests), also use the checklist in the matching standards file.

### General coding:
- [ ] File path is in a comment at the top of every file
- [ ] No `any` TypeScript types used
- [ ] Imports use `@/` prefix (no relative paths)
- [ ] Imports organized in the correct order (React/Next → third-party → internal → types)
- [ ] File is named using the correct convention (PascalCase / camelCase / kebab-case)
- [ ] No new files created that the architect's plan did not specify

### Error handling and logging:
- [ ] No `console.*` statements in application code — Winston logger used instead
- [ ] No personal information in any log entry (no emails, names, addresses, tokens)
- [ ] Log levels used appropriately (error / warn / info / debug)
- [ ] Log data is structured, not concatenated into strings
- [ ] No bare `catch {}` blocks that swallow errors silently

### Documentation:
- [ ] Complex business logic has explanatory comments that explain "why," not "what"
- [ ] New features have matching documentation updates
- [ ] Merge or deduplication logic documents which rule wins in a conflict

### File size:
- [ ] No file grew past 600 lines without a conscious, explicit decision
- [ ] If a file is approaching 500 lines, new content was considered for a separate file first

### Specialized standards (see linked files):
- [ ] **API routes:** `API_STANDARDS.md` checklist
- [ ] **Database / Prisma / migrations:** `DATABASE_STANDARDS.md` checklist
- [ ] **Components / forms / styling / translations:** `COMPONENT_STANDARDS.md` checklist
- [ ] **Tests:** `TESTING_STANDARDS.md` checklist