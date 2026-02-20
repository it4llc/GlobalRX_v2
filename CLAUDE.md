# GlobalRX Debugging Guide

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