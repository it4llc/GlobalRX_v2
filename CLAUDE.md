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
- 🔴 **Critical security gaps** - 625 console statements with sensitive data
- 🔴 **No testing** - Zero test coverage
- 🔴 **No monitoring** - No error tracking or health checks
- ⚠️ **TypeScript strict mode disabled** - 122 'any' types need fixing

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