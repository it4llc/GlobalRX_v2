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
Never create files that the architect's plan did not specify. If the architect
says to modify one file, only that file is changed. If you believe a new file is
genuinely needed that was not in the plan, stop immediately and explain why to
Andy before creating anything.
Never create files just to make tests pass. If a test requires a file that
should not exist, the test is wrong and must be rewritten — not satisfied by
creating the file. Creating ghost routes or duplicate service layers to satisfy
tests introduces technical debt and bypasses the real application code path,
meaning the tests prove nothing about how the app actually works.

### 1.6 Confirm Before Deleting Anything

Never delete a file, database record, or significant block of code without
explicitly confirming with Andy first. Describe what will be removed and why
before taking the action.

---

## SECTION 2: React Hook Patterns

### 2.1 Data Loading in useEffect

When loading data in React hooks, carefully consider the conditions that trigger loading:

**Common Bug Pattern to Avoid:**
```typescript
// ❌ WRONG - Prevents necessary data loading in edit mode
useEffect(() => {
  if (session?.user?.customerId && !editOrderId) {
    fetchAvailableServices(); // Bug: Services won't load when editing
  }
}, [session, editOrderId, fetchAvailableServices]);
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Load data when needed regardless of mode
useEffect(() => {
  if (session?.user?.customerId) {
    fetchAvailableServices(); // Services load in both create and edit modes
  }
}, [session, fetchAvailableServices]);
```

**Rule:** If data is needed in both create and edit modes, don't add edit-mode conditions that prevent loading. Only add conditions that actually determine whether the data is needed.

### 2.2 Import Dependencies

**All imports must be present before using APIs:**
```typescript
// ❌ WRONG - Missing import causes runtime error
// Using logger.error() without importing logger

// ✅ CORRECT - Import all dependencies
import logger from '@/lib/logger';
```

**Rule:** Always import what you use. TypeScript will catch missing imports during build, but runtime errors can still occur if imports are forgotten during development.

---

## SECTION 3: Component & Styling Standards

**See [COMPONENT_STANDARDS.md](COMPONENT_STANDARDS.md) for complete component and styling rules.**

### 3.1 Dialog Component Standards

**Dialog components must support declarative control via props:**

All modal, dialog, drawer, and popup components must accept an `open` prop that controls visibility state. This prevents integration issues where parent components need to manage dialog state predictably.

**Required pattern:**
```typescript
interface DialogProps {
  open?: boolean;  // Declarative control
  onClose?: () => void;
  // ... other props
}

// In component implementation:
useEffect(() => {
  if (open !== undefined && dialogRef.current) {
    if (open) {
      dialogRef.current.showModal();
    } else {
      dialogRef.current.close();
    }
  }
}, [open]);
```

**Backward compatibility:** When adding declarative control to existing imperative-only components, maintain full backward compatibility. Components should work identically when the `open` prop is not provided.

**Why this rule exists:** The ModalDialog component originally only supported imperative control via refs (showModal/close methods). Components trying to use it declaratively with an `open` prop failed silently, causing difficult-to-debug integration issues.

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

**See [API_STANDARDS.md](API_STANDARDS.md) for complete API route requirements and patterns.**

---

## SECTION 6: TypeScript Standards

### 6.1 No `any` Types

The use of `any` as a TypeScript type is prohibited. It defeats the purpose of
TypeScript and makes code harder to maintain safely. If you are unsure of a type,
use `unknown` and narrow it properly, or define an explicit type.

**Common `any` Anti-Patterns to Avoid:**

**1. User objects without proper typing:**
```typescript
// ❌ WRONG - Don't use any for user objects
const user: { id: string; permissions?: any } = ...

// ✅ CORRECT - Define proper user types
interface ServiceUser {
  id: string;
  userType: string;
  vendorId?: string;
  permissions?: Record<string, unknown>;
}
```

**2. Prisma where clauses:**
```typescript
// ❌ WRONG - Don't use any for where clauses
const where: any = {};

// ✅ CORRECT - Define typed where clause
interface ServiceWhereClause {
  orderId?: string;
  status?: ServiceStatus;
  assignedVendorId?: string;
}
const where: ServiceWhereClause = {};
```

**3. Update data objects:**
```typescript
// ❌ WRONG - Don't use any for update data
const updateData: any = { status: newStatus };

// ✅ CORRECT - Define typed update interface
interface ServiceUpdateData {
  status?: ServiceStatus;
  assignedVendorId?: string | null;
  vendorNotes?: string | null;
  updatedAt?: Date;
}
const updateData: ServiceUpdateData = { status: newStatus };
```

**4. Array operations and iterations:**
```typescript
// ❌ WRONG - Don't lose typing in forEach/map
services.forEach((service: any) => {
  delete service.order.customer;
});

// ✅ CORRECT - Maintain proper typing
services.forEach((service) => {
  // Use type assertions only when necessary
  delete (service.order as any).customer;
});
```

**5. Change tracking objects:**
```typescript
// ❌ WRONG - Don't use generic objects for tracking
const changes: Array<{
  fieldName: string;
  oldValue: any;
  newValue: any;
}> = [];

// ✅ CORRECT - Define proper change tracking type
interface AuditChange {
  fieldName: string;
  changeType: 'status_change' | 'vendor_assignment' | 'note_update';
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}
const changes: AuditChange[] = [];
```

**When you MUST use type assertions:**
- Use them sparingly and document why they're needed
- Prefer `as unknown as TargetType` over `as any`
- Consider if the underlying data structure should be fixed instead

### 6.2 Strict Mode

**Current State:** TypeScript strict mode is currently disabled but must be enabled
as part of enterprise readiness improvements. The codebase contains 122 uses of 'any'
type that must be replaced with proper typing before enabling strict mode.

**Target:** Enable strict mode in `tsconfig.json`. Do not disable or work around
strict mode checks once enabled.

### 6.3 Types Live in `/src/types/`

All shared type definitions belong in the `/src/types/` directory. Do not define
types locally inside a component file if they are used in more than one place.

**Type Organization Best Practices:**

1. **Create feature-specific type files:**
   - `src/types/service-fulfillment.ts` - All types for service fulfillment feature
   - `src/types/order.ts` - All types for order management
   - `src/types/user.ts` - All user and permission types

2. **Export related types together:**
```typescript
// src/types/service-fulfillment.ts
export interface ServiceFulfillment { ... }
export interface ServiceUser { ... }
export interface ServiceWhereClause { ... }
export interface ServiceUpdateData { ... }
export type ServiceStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled';
```

3. **Import types in services and components:**
```typescript
import type {
  ServiceFulfillment,
  ServiceUser,
  ServiceWhereClause,
  ServiceUpdateData
} from '@/types/service-fulfillment';
```

4. **Never duplicate type definitions** - If you find yourself defining the same interface in multiple places, move it to `/src/types/`

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

**See [COMPONENT_STANDARDS.md](COMPONENT_STANDARDS.md) for translation system requirements.**

---

## SECTION 8: Business Logic Standards

**See [DATABASE_STANDARDS.md](DATABASE_STANDARDS.md) for order ID format and customer code requirements.**

---

## SECTION 9: Security Standards

These rules protect the platform and the sensitive personal data it handles.

### 9.1 Authentication on Every API Route

Every API route that reads or writes data must check authentication before
doing anything else. **No exceptions.**

**Fixed Issue:** All previously unauthenticated endpoints have been secured,
including Data Rx endpoints and debug routes.

**Critical:** Any API route without authentication is a security vulnerability.

### 9.2 Role Checks Must Be Server-Side

Never rely on the frontend hiding a button or page to protect a feature.
Role and permission checks must happen in the API route, on the server.

### 9.3 Validate All Input

Never use data from a request body, query parameter, or URL without validating
it first with a Zod schema. Assume all incoming data could be malformed or malicious.

### 9.4 Additional Security Standards

**For comprehensive API security standards, see [API_STANDARDS.md](API_STANDARDS.md).**

**For database-related security standards, see [DATABASE_STANDARDS.md](DATABASE_STANDARDS.md).**



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

**See [TESTING_STANDARDS.md](TESTING_STANDARDS.md) for complete testing requirements and TDD workflow.**


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

## SECTION 14: Database Changes and Prisma Migrations

**See [DATABASE_STANDARDS.md](DATABASE_STANDARDS.md) for complete database migration requirements and patterns.**

---

## SECTION 15: File Upload Patterns

### 15.1 File Object Serialization Issues

**NEVER store File objects in state that will be JSON serialized**

File objects cannot be JSON serialized. When `JSON.stringify()` is called on data containing File objects, they become empty `{}` objects, causing data loss.

**Common Bug Pattern to Avoid:**
```typescript
// ❌ WRONG - File objects in state get lost during JSON serialization
const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});

// When saving draft data that includes uploadedFiles:
const draftData = {
  subject: {...},
  services: [...],
  uploadedFiles  // File objects become {} when JSON.stringify() is called
};
fetch('/api/save-draft', {
  body: JSON.stringify(draftData) // Files are lost here
});
```

**Correct Pattern: Immediate Upload with Metadata Storage**
```typescript
// ✅ CORRECT - Upload immediately, store only JSON-serializable metadata
const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedAt?: string;
}>>({});

// Upload file immediately when selected:
const handleFileSelect = async (file: File, documentId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData  // Use FormData for uploads, not JSON
  });

  const result = await response.json();
  // Store only serializable metadata, not the File object
  setUploadedDocuments(prev => ({
    ...prev,
    [documentId]: result.metadata
  }));
};
```

**Rule:** Always upload files immediately when selected and store only JSON-serializable metadata in component state. Never defer file uploads until form submission.

### 15.2 FormData vs JSON for File Uploads

**File uploads MUST use FormData, not JSON**

```typescript
// ✅ CORRECT - Use FormData for file uploads
const formData = new FormData();
formData.append('file', file);
formData.append('documentId', documentId);

fetch('/api/uploads', {
  method: 'POST',
  body: formData  // Browser automatically sets correct Content-Type
});

// ❌ WRONG - Cannot send files as JSON
fetch('/api/uploads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ file, documentId }) // File object becomes {}
});
```

**Rule:** Use FormData for any request that includes file uploads. Let the browser automatically set the Content-Type header.

---

## SECTION 16: Documentation Standards

### 16.1 When Documentation is Required

Documentation must be created or updated in these situations:

1. **New Features** - Document how to use the feature
2. **API Changes** - Update endpoint documentation
3. **Complex Business Logic** - Explain the "why" not just the "what"
4. **Non-Obvious Code** - If it took you time to figure out, document it
5. **Breaking Changes** - Document migration path
6. **Configuration Changes** - Update .env.example

### 16.2 Code Comments

**When to add comments:**
- Complex algorithms or business rules
- Non-obvious workarounds or bug fixes
- TODO items with context and ownership
- API integration points
- Security considerations

**When NOT to add comments:**
- Obvious code that is self-documenting
- Every function/variable (TypeScript types are documentation)
- Redundant information

**Good comment:**
```typescript
// Calculate order sequence: Reset to 0001 each day per customer
// This ensures order IDs are readable (e.g., 20250223-XK7-0003)
// and can be communicated over phone support
```

**Bad comment:**
```typescript
// Set name to the name value
const name = formData.name;
```

### 16.3 API Documentation

Every API endpoint must have:

```typescript
/**
 * GET /api/customers/[id]/packages
 *
 * Retrieves all packages for a specific customer
 *
 * Required permissions: customers.view
 *
 * Query params:
 *   - status?: 'active' | 'inactive' | 'all'
 *   - limit?: number (default: 25)
 *   - offset?: number (default: 0)
 *
 * Returns: { packages: Package[], total: number }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Customer not found
 */
```

### 16.4 Data Key Consistency

When working with form field data, API responses, or any data structures where objects can be referenced by different keys, **ensure consistent key usage throughout the data flow**.

**Common Bug Pattern to Avoid:**
```typescript
// ❌ WRONG - Inconsistent keying causes data loss in forms
// Draft order data comes with field names as keys
const draftData = { "School Name": "Harvard", "Email": "test@example.com" };

// But form expects field IDs as keys
const formFields = { "uuid-123": "Harvard", "uuid-456": "test@example.com" };

// This mismatch causes field values to not appear when editing drafts
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Remap keys consistently before using data
const remapFieldNamesToIds = (fieldsByName: Record<string, any>, fieldDefinitions: Field[]) => {
  const remapped: Record<string, any> = {};

  Object.entries(fieldsByName).forEach(([fieldName, fieldValue]) => {
    const matchingField = fieldDefinitions.find(field => field.name === fieldName);
    if (matchingField) {
      remapped[matchingField.id] = fieldValue; // Use ID as key, not name
    }
  });

  return remapped;
};
```

**Rule:** When field data can be referenced by both name and ID, always establish which key type the consuming code expects and transform data accordingly before use.

### 16.5 Business Logic Documentation

When implementing deduplication logic or data merging algorithms:

**Document the merge strategy clearly:**
- **OR logic** - Use when the most restrictive rule should win (e.g., required fields)
- **AND logic** - Use when all conditions must be met
- **First-wins** - Only use when order matters and later entries should be ignored
- **Last-wins** - Only use when the most recent value should override

**Example: Requirements Deduplication**
```typescript
// BUG PREVENTION: When merging requirements from multiple services,
// use OR logic for 'required' fields - if ANY service requires the field,
// it should be marked as required in the UI.
//
// WRONG: First-wins logic (can hide required asterisks)
// RIGHT: OR logic (most restrictive requirement wins)
if (existingField && isRequired) {
  existingField.required = true; // OR logic: required if ANY service needs it
}
```

### 16.6 README Updates

Update README.md when:
- Adding new dependencies
- Changing setup/installation steps
- Adding new npm scripts
- Changing deployment process

### 16.7 Feature Documentation

For significant features, create a markdown file in `/docs/features/`:

```markdown
# Feature Name

## Overview
Brief description of what the feature does

## Usage
How to use the feature from user perspective

## Technical Implementation
- Key components/files
- Data flow
- Database schema changes

## Configuration
Environment variables or settings needed

## Testing
How to test the feature works correctly
```


---

## QUICK REFERENCE CHECKLIST

### Core Standards:
- [ ] File path is in a comment at the top of the file
- [ ] No `any` TypeScript types used (search for `: any`)
- [ ] Imports use `@/` prefix (no relative paths)
- [ ] File is named using the correct convention (PascalCase/camelCase/kebab-case)
- [ ] Winston logger used instead of console statements
- [ ] No PII (emails, passwords, tokens) logged anywhere
- [ ] Documentation updated for new features or API changes
- [ ] Complex business logic has explanatory comments

### Specialized Standards:
- [ ] **API Routes:** See [API_STANDARDS.md](API_STANDARDS.md) checklist
- [ ] **Testing:** See [TESTING_STANDARDS.md](TESTING_STANDARDS.md) checklist
- [ ] **Database:** See [DATABASE_STANDARDS.md](DATABASE_STANDARDS.md) checklist
- [ ] **Components:** See [COMPONENT_STANDARDS.md](COMPONENT_STANDARDS.md) checklist
