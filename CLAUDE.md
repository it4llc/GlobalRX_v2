# GlobalRx Development Guide

## Project Overview

GlobalRx_v2 is a background screening platform built with Next.js 14, TypeScript (strict), Prisma, PostgreSQL, NextAuth.js, Zod, Vitest, Tailwind CSS, and Shadcn/ui.

**Package manager:** pnpm (never npm)
**Project location:** `~/Projects/GlobalRx_v2`

---

## Standards Documents — Read Before Working

Before writing any code, read the standards file that matches the work you are doing. These are the authoritative source for all rules.

| If you are working on...                                 | Read this file              |
|----------------------------------------------------------|-----------------------------|
| API routes (`src/app/api/**`)                            | `docs/API_STANDARDS.md`     |
| Database schema, Prisma, migrations                      | `docs/DATABASE_STANDARDS.md`|
| React components, forms, dialogs, tables, styling        | `docs/COMPONENT_STANDARDS.md`|
| Writing or fixing tests                                  | `docs/TESTING_STANDARDS.md` |
| Anything else (general principles, logging, TypeScript)  | `docs/CODING_STANDARDS.md`  |

**Also read:**
- `docs/DATA_DICTIONARY.md` — authoritative schema reference for all models and fields
- `docs/TECH_DEBT.md` — running tech debt log (TD-001 onward)

**Deprecated:** `docs/standards/` is an old folder with a README marking it as such. Never read from or reference it.

If your task touches more than one area, read every file that applies. Do not skim.

---

## Critical Project Rules

These rules apply everywhere — all agents, all tasks, no exceptions.

### Status Values Are Always Lowercase

Status values are stored and compared as **lowercase** everywhere: database, application code, and tests. Examples: `submitted`, `draft`, `processing`, `completed`.

Never use Title Case (`Submitted`) or UPPER CASE (`SUBMITTED`) for status values. Display formatting is handled separately at the UI layer.

### fieldKey Is Immutable After Creation

`DSXRequirement.fieldKey` is generated once when a requirement is created (camelCase, collision-detected). It must **never** change after that. The `name` field is the editable display label. See `docs/DATABASE_STANDARDS.md` Section 2.1 for the full explanation.

### Prisma Migration Method

This project does **not** use `prisma migrate dev`. The required process is:

1. Edit `prisma/schema.prisma`
2. Create a timestamped migration directory: `mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_migration_name`
3. Write `migration.sql` in that directory
4. Run `pnpm prisma migrate deploy`
5. Run `pnpm prisma generate`

### No Inline Styling

All styling uses `globals.css` classes or Tailwind utility classes. Inline `style={{}}` attributes are prohibited. If you believe inline styling is truly necessary, stop and ask for permission first.

### Authentication Import

Always use `useAuth` from `@/contexts/AuthContext`:

```typescript
import { useAuth } from '@/contexts/AuthContext';
```

Never import from `@/hooks/useAuth` or `@/components/auth/auth-interceptor`.

### No Console Statements

Use Winston structured logging, not `console.log/warn/error`. Never log PII (emails, passwords, tokens).

### No TypeScript `any`

Use proper typing. If the correct type is unclear, stop and investigate rather than using `any`.

### Branch Discipline

Never commit directly to `dev`. Always create a branch and use a pull request.

### ServicesFulfillment Co-Creation

Every `OrderItem` must be created in the same transaction as its `ServicesFulfillment` record (with `assignedVendorId: null`). Use `OrderCoreService.addOrderItem` — never create `OrderItem` records directly. See `docs/DATABASE_STANDARDS.md` Section 2.2.

### VendorOrganization Field Name

The correct field is `contactEmail`, not `email`. This mistake is not caught by tests — only by runtime database queries.

---

## Agent Workflow

This project uses a multi-agent pipeline managed through Claude Code. Agent files are in `.claude/agents/` and slash commands are in `.claude/commands/`.

### Available Pipelines

- `/build-feature [description]` — single-pass feature build
- `/plan-feature [description]` — multi-phase feature planning and build
- `/fix-bug [description]` — bug investigation and fix

### Key Pipeline Rules

- Andy reviews all output in Claude.ai before typing CONTINUE to advance any stage
- Fresh Claude Code sessions between pipeline stages to avoid context contamination
- Never commit or push without Andy's explicit review
- Agent self-reported test counts are **never trusted** — always require raw bash output
- Zero net test regression is required before any stage transition

Full agent instructions are in `.claude/agents/` — agents read these automatically. Do not duplicate agent-specific rules here.

---

## Common Commands

```bash
# Development server
pnpm dev:alt

# Build check
pnpm build

# Type checking
pnpm typecheck

# Lint check
pnpm lint

# Run all tests
pnpm vitest run

# Run specific test file
pnpm vitest run path/to/test.ts
```

---

## Vitest ESM Mocking — Node.js Built-ins

When mocking Node.js built-in modules (`fs`, `fs/promises`, `path`, `crypto`, etc.):

- Source files **must** use default imports: `import fs from 'fs'`
- Source code **must** call through the module object: `fs.existsSync()`, not `existsSync()`
- Named imports like `import { existsSync } from 'fs'` will **not** work — the binding locks at import time before the mock intercepts it
- Test mock factories must put mock functions on **both** the `default` object **and** as named exports

---

## Provider Hierarchy

The application's providers must be set up in this order in `src/components/providers/client-provider.tsx`:

```tsx
<SessionProvider>
  <TranslationProvider>
    <AuthProvider>
      <ViewProvider>
        <LocationProvider>
          <DSXProvider>
            {children}
          </DSXProvider>
        </LocationProvider>
      </ViewProvider>
    </AuthProvider>
  </TranslationProvider>
</SessionProvider>
```

---

## Debugging Permission Issues

If you see "Forbidden" errors:

1. Check if you are logged in as the right user
2. Visit `/api/debug-session` in the browser to see your actual permissions
3. Ensure the frontend uses `useAuth` from `@/contexts/AuthContext`
4. Check if you need specific permissions for the action (e.g., `customers.edit` vs `customers.view`)

---

## Creating Pull Requests

GitHub CLI (`gh`) is not installed. After pushing a branch:

1. Push: `git push -u origin <branch-name>`
2. Open the URL from the git push output, or go to https://github.com/it4llc/GlobalRX_v2/pulls