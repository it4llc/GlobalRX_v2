# GlobalRx Development Guide

## 📋 Development Standards

**CRITICAL:** Before writing any code, read the comprehensive coding standards:

📖 **[CODING_STANDARDS.md](docs/CODING_STANDARDS.md)** - Complete development rules and conventions

### Key Standards Highlights:
- ✅ **No console statements** - Use Winston structured logging
- ✅ **Authentication required** on every API route (no exceptions)
- ✅ **Tests required** for all new code
- ✅ **No inline styles** - Use globals.css and Tailwind
- ✅ **No TypeScript 'any'** types - Use proper typing
- ✅ **No PII in logs** - Never log emails, passwords, tokens

### Current Enterprise Readiness Status:
- ✅ **Security hardened** - 99.2% console statements removed, auth on all endpoints
- ✅ **Testing implemented** - 196 tests (178 unit + 18 E2E) with 95% pass rate
- ✅ **Monitoring deployed** - Sentry, health checks, AlertManager operational
- ✅ **Business logic extraction** - 4 major components refactored with TDD (54% code reduction)
- ⚠️ **TypeScript strict mode enabled** - 545 errors remaining (26% reduced)

📊 **[Complete Audit Report](docs/audit/AUDIT_REPORT.md)** - Full enterprise readiness assessment

---

## Authentication & Authorization

### Checking User Permissions

Use the API debug endpoint to verify what permissions your current user has:

```bash
curl localhost:3000/api/debug-session
```

Or visit `/api/debug-session` in your browser.

### Permission Structure

The application supports multiple permission formats:

- Array-based: `{"customers": ["*"]}`
- Object-based: `{"customers": {"view": true}}`
- Boolean flags: `{"admin": true}`

The utilities in `src/lib/permission-utils.ts` handle all these formats.

### Debugging Permission Issues

If you're seeing "Forbidden" errors:

1. Check if you're logged in as the right user
2. Use the `/api/debug-session` endpoint to see your actual permissions
3. Ensure the frontend is using `useAuth` from `@/contexts/AuthContext` (not from `hooks/useAuth.ts` or `auth-interceptor.tsx`)
4. Check if you need specific permissions for the action (e.g., `customers.edit` vs just `customers.view`)

## Development Principles

### CRITICAL: Pre-Implementation Discovery

**⚠️ MANDATORY: Complete discovery BEFORE writing any code or tests**

#### The 5-Minute Rule
**"Test the actual user flow within 5 minutes of starting work"**

If the current behavior doesn't match your assumptions, STOP and investigate.

#### Discovery Checklist (Required for ALL user-facing changes)

1. **Manual Testing First**
   ```bash
   # Log in as the target user type
   # Navigate through the ACTUAL flow
   # Document:
   - Starting URL
   - Each click/action taken
   - Resulting URL changes
   - Which components render
   ```

2. **Find the RIGHT Files**
   ```bash
   # Don't assume - VERIFY with multiple search patterns
   grep -r "ComponentName\|buttonText\|onClick" --include="*.tsx"

   # Find ALL instances, not just the first one
   git grep -l "OrderDetails\|ViewOrder"

   # Check component usage
   grep -r "<ComponentName" --include="*.tsx"
   ```

3. **Verify Every Assumption**
   - [ ] What page does the user ACTUALLY start from?
   - [ ] What button/link do they ACTUALLY click?
   - [ ] What file handles that interaction?
   - [ ] Did I test this by clicking through it myself?
   - [ ] Are there multiple paths to the same feature?

4. **Common Discovery Failures to Avoid**
   - ❌ Updating `/portal/orders` when users actually use `/portal/dashboard`
   - ❌ Modifying a component that isn't actually rendered
   - ❌ Assuming navigation flow without testing it
   - ❌ Writing 80 tests before verifying you're in the right file

#### When Discovery is Complete
You should be able to answer:
- "I clicked X button on Y page and it did Z"
- "The code for this is in file A at line B"
- "I verified this by actually doing it, not by reading code"

### Test-Driven Development (TDD)

**ALWAYS follow TDD principles for new features and refactoring:**

#### TDD Workflow - MUST FOLLOW IN ORDER

##### 1. REQUIREMENTS Phase (Ask First!)
- **ALWAYS confirm business requirements with user BEFORE writing tests**
- Document the requirements clearly
- Get explicit confirmation that requirements are correct

##### 2. RED Phase (Tests First)
- Write ALL tests before ANY implementation
- Run tests to confirm they ALL fail (should see RED in test output)
- If any test passes before implementation, the test is likely wrong
- Document what each test is testing and why it should fail
- **⚠️ CRITICAL: Fix or remove failing tests before proceeding to GREEN phase**

##### 3. GREEN Phase (Minimal Implementation)
- Write ONLY enough code to make one test pass at a time
- Run tests after each small change
- Do NOT write the full implementation at once
- Commit after each test goes green (optional but recommended)

##### 4. REFACTOR Phase
- Only refactor AFTER all tests are green
- Keep running tests to ensure nothing breaks
- Improve code quality without changing behavior

#### TDD Checklist (MUST complete in order)
- [ ] Pre-implementation discovery completed?
- [ ] Requirements confirmed with user?
- [ ] Business logic clarified (no assumptions)?
- [ ] Tests written first?
- [ ] ALL tests failing initially (RED)?
- [ ] ALL tests passing before moving to implementation?
- [ ] Implementation done incrementally (one test at a time)?
- [ ] Each test made green one at a time?
- [ ] Feature manually tested before declaring complete?
- [ ] Refactoring done only after all green?

**Common TDD Mistakes to Avoid:**
- ❌ Writing implementation and tests at the same time
- ❌ Writing all implementation before running tests
- ❌ Assuming business requirements without confirmation
- ❌ Skipping the RED phase (tests should fail first)

### Business Logic Clarification

**NEVER assume business requirements or logic. Always:**

1. **Ask for clarification** when business rules are unclear
2. **Confirm assumptions** before implementing business logic
3. **Document business decisions** in code comments when complex
4. **Validate edge cases** with explicit user confirmation

Examples of when to ask:
- "Should orders in 'pending' status be editable?"
- "What happens when a customer is deactivated but has active orders?"
- "Should admin users bypass this validation rule?"
- "Is this field required for all customer types or only specific ones?"

### Refactoring Guidelines

When refactoring existing code:
1. **Understand current behavior first** - Read tests, ask about undocumented behavior
2. **Maintain backward compatibility** unless explicitly told otherwise
3. **Extract business logic** into testable services/hooks
4. **Ask before changing** any business behavior, even if it seems like a bug

## 🤖 Agent Workflow

This project uses a team of specialized subagents to enforce TDD.
Agent files are in `.claude/agents/`.

### TDD Pipeline (run in order, automatically)

To build any new feature using the full TDD pipeline, type:
```
/build-feature [describe the feature in plain English]
```

This automatically chains these agents in sequence:
1. `business-analyst` — writes the specification (pauses for Andy's approval)
2. `architect` — produces the technical plan (pauses for Andy's approval)
3. `test-writer` — writes all tests before any code exists
4. `implementer` — writes code to make tests pass
5. `code-reviewer` — reviews logic and security
6. `standards-checker` — verifies coding standards compliance
7. `documentation-writer` — updates docs and code comments

### Running individual agents

```
Use the file-explorer agent to find files related to [topic]
Use the code-reviewer agent on the recent changes
Use the standards-checker agent on [filename]
Use the documentation-writer agent now that implementation is complete
```

### Key rule
Never write code before tests exist. Never skip the business-analyst stage.
Full agent instructions are in `.claude/agents/` — agents read these automatically.

## Work Process

### CRITICAL: Verify Changes Before Committing

NEVER commit changes before they have been verified as working! Follow this process:

1. Identify an issue
2. Make changes to address the issue
3. WAIT for explicit user confirmation that the changes work
4. Only after confirmation, stage and commit the changes

This pattern must be followed for EVERY change - no exceptions!

## Common Fixes

### Authentication Component Usage

**IMPORTANT**: Always use the AuthContext from `src/contexts/AuthContext.tsx` which uses the permission utilities correctly:

```jsx
import { useAuth } from '@/contexts/AuthContext';
```

Avoid using:
- `import { useAuth } from '@/hooks/useAuth';`
- `import { useAuth } from '@/components/auth/auth-interceptor';`

### Running commands

**IMPORTANT: This project uses pnpm, not npm!**

Recommended commands to run after making changes:

```bash
# Development server
pnpm dev:alt

# Build check
pnpm build

# Type checking
pnpm typecheck

# Lint check
pnpm lint
```

## API Routes with Permission Checks

The following API routes require specific permissions:

- `/api/packages/[id]` - Requires `customers.view` for GET, `customers.edit` for PUT/DELETE
- `/api/customers/[id]/packages` - Requires `customers.view` for GET, `customers.edit` for POST

## Provider Setup 

The application's providers should be set up in this order in `client-provider.tsx`:

```jsx
<SessionProvider>
  <TranslationProvider>
    <AuthProvider> {/* From @/contexts/AuthContext */}
      <LocationProvider>
        <DSXProvider>
          {children}
        </DSXProvider>
      </LocationProvider>
    </AuthProvider>
  </TranslationProvider>
</SessionProvider>
```

## Styling Issues

If Tailwind CSS styling suddenly stops working (buttons look like HTML, brand colors missing), see the detailed troubleshooting guide:

📋 **[Styling Troubleshooting Guide](docs/troubleshooting-styling.md)**

**Quick Fix**: Check if `postcss.config.js` exists and uses CommonJS syntax (`module.exports`), not ES modules (`export default`).

---

## 🛠️ Implementation Workflow

### For Audit-Driven Improvements:
1. **Create feature branch** for specific audit task
2. **Follow CODING_STANDARDS.md** for all code changes
3. **Add tests** for any new functionality
4. **Use structured logging** instead of console statements
5. **Verify changes work** before committing
6. **Update progress** in audit report

### Branch Naming Convention:
- `fix/remove-sensitive-logging` - Security fixes
- `feature/monitoring-setup` - New infrastructure
- `test/api-routes` - Adding test coverage
- `refactor/large-files` - Code quality improvements

## 📌 Creating Pull Requests

**NOTE: GitHub CLI (`gh`) is NOT installed on this system.**

To create a pull request after pushing your branch:
1. Push your branch: `git push -u origin <branch-name>`
2. Open the URL provided in the git push output
3. Or manually go to: https://github.com/it4llc/GlobalRX_v2/pulls and click "New pull request"

Do not attempt to use `gh pr create` or other GitHub CLI commands.

---

## 📝 Documentation Requirements

### When Building New Features:

**Always create/update documentation for:**
- New API endpoints → Add JSDoc comments with permissions, params, responses
- Complex business logic → Explain the "why" with inline comments
- New environment variables → Update `.env.example` immediately
- Breaking changes → Document migration path in `/docs/migrations/`
- Significant features → Create `/docs/features/[feature-name].md`

### Inline Documentation Guidelines:

**DO add comments for:**
```typescript
// Good: Explains business logic
// Order sequences reset daily per customer to maintain readable IDs
// that can be communicated over phone support (e.g., 20250223-XK7-0003)
const sequence = await getNextSequenceForCustomer(customerId, today);
```

**DON'T add obvious comments:**
```typescript
// Bad: States the obvious
// Set the user's name
user.name = formData.name;
```

### API Documentation Template:
```typescript
/**
 * POST /api/orders/[id]/submit
 *
 * Submits an order for processing
 *
 * Required permissions: orders.submit
 *
 * Body: { reviewedBy: string, notes?: string }
 * Returns: { order: Order, status: 'submitted' }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Order not found
 *   409: Order already submitted
 */
```

### Feature Documentation Structure:

For new features, create `/docs/features/[feature-name].md`:

```markdown
# Feature Name

## Overview
Brief description of what the feature does and why it exists

## User Guide
How end users interact with this feature

## Technical Details
- **Key files:** List main components/APIs
- **Database:** Any schema changes
- **Dependencies:** External services or packages

## Configuration
Environment variables and settings

## Testing
How to verify the feature works correctly
```