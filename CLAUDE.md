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
- ✅ **Testing implemented** - 174 tests (156 unit + 18 E2E) with 93% pass rate
- ✅ **Monitoring deployed** - Sentry, health checks, AlertManager operational
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
- [ ] Requirements confirmed with user?
- [ ] Business logic clarified (no assumptions)?
- [ ] Tests written first?
- [ ] ALL tests failing initially (RED)?
- [ ] Implementation done incrementally (one test at a time)?
- [ ] Each test made green one at a time?
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