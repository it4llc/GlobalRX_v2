# /GlobalRX_v2/docs/audit/GLOBALRX_AUDIT_PLAN.md
# GlobalRx Platform — Enterprise Readiness Audit Plan

---

## INSTRUCTIONS FOR CLAUDE CODE

You are being asked to perform a comprehensive audit of the GlobalRx platform codebase.
This plan defines exactly what to examine, what questions to answer, and what output to
produce. Follow each section in order. Do not skip sections. Do not make any changes to
any code during this audit — your job is to observe and report only.

**IMPORTANT: Multi-Chat Continuity Instructions**
- This audit may span multiple chat sessions
- After completing each section, update the audit plan to mark it as COMPLETED
- Save progress to a checkpoint file: `/GlobalRX_v2/docs/audit/AUDIT_PROGRESS.md`
- When resuming, read the progress file to understand what has been completed
- Stay focused on the plan — do not deviate to other tasks or directions
- Each section's findings should be saved immediately upon completion

**Documentation Creation During Audit**
As you conduct the audit, create documentation in these folders:
- `/docs/audit/` — Audit findings and reports (AUDIT_REPORT.md, AUDIT_PROGRESS.md)
- `/docs/architecture/` — Document the current system architecture as discovered
- `/docs/standards/` — Note any coding patterns that should become standards
- `/docs/api/` — Document API endpoints and contracts found during analysis
- `/docs/runbooks/` — Create operational procedures for deployment/maintenance
- `/docs/decisions/` — Record important architectural decisions discovered
- `/docs/plans/` — Create implementation plans based on audit findings

At the end, you will produce a structured report saved to:
  `/GlobalRX_v2/docs/audit/AUDIT_REPORT.md`

Work methodically. If you are unsure about something you find, note it as a question
rather than making an assumption. Be specific — vague findings are not useful.

---

## CONTEXT: What This Platform Is

GlobalRx is a background screening platform built with:
- **Language:** TypeScript
- **Frontend:** Next.js 14 with App Router
- **Styling:** Tailwind CSS + Shadcn/ui components
- **Backend:** Next.js API routes
- **Database:** PostgreSQL managed via Prisma ORM
- **Authentication:** NextAuth.js with role-based access control
- **Package Manager:** pnpm

The platform has four modules:
1. User Admin — manage internal users and permissions
2. Global Configurations — locations, services, DSX (data requirements), translations
3. Customer Configurations — customer accounts and service scopes
4. Candidate Workflow — application forms and multilingual support

The platform was built incrementally without a formal testing strategy. The goal of this
audit is to understand how enterprise-ready it is, and to provide a clear prioritized
roadmap for improvement.

---

## BEFORE YOU BEGIN

1. Read this entire plan before starting any analysis
2. Start by mapping the project structure with: `find . -type f -name "*.ts" -o -name "*.tsx" | sort`
3. Read the `package.json` file to understand all dependencies and scripts
4. Read `prisma/schema.prisma` to understand the full data model
5. Note the current Next.js version and whether App Router is used consistently

---

## SECTION 1: Testing Coverage Audit

**Goal:** Understand how much of the codebase is currently tested, and how testable the
code is in its current form.

### Steps:

1. Search for any existing test files:
   ```
   find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx"
   ```

2. Check if any testing frameworks are installed by looking at `package.json` for:
   - jest
   - vitest
   - playwright
   - cypress
   - testing-library

3. Check if there is a jest or vitest config file at the root level

4. For each of these critical areas, evaluate whether the existing code is written in a
   way that would make it easy or hard to test:

   **a. API Routes** — located in `/src/app/api/` or `/pages/api/`
   - Are business logic and database calls mixed together, or separated?
   - Do route handlers do too many things at once?
   - Is there consistent error handling?

   **b. Authentication and Permissions**
   - Find where permission checks happen (look for `getServerSession`, `checkPermission`,
     or similar)
   - Are permissions checked consistently before data is returned?
   - Is there a central place where permissions are enforced, or is it scattered?

   **c. Database Queries via Prisma**
   - Are Prisma calls happening directly in components/pages, or are they isolated in
     separate service/repository files?
   - Direct calls in components are harder to test and should be noted

   **d. Form Validation**
   - Find where Zod schemas are defined
   - Are they reused between frontend and backend, or duplicated?

### What to report:
- Number of existing test files found (likely zero — confirm this)
- A rating for each critical area: Easy to Test / Needs Refactoring to Test / Very Difficult to Test
- Specific examples of code patterns that would make testing difficult

### Documentation to create:
- `/docs/standards/testing-strategy.md` — Recommended testing approach based on current code structure
- `/docs/plans/testing-implementation.md` — Step-by-step plan to add testing

---

## SECTION 2: Security and Data Safety Audit

**Goal:** Identify any gaps that could allow unauthorized access or data exposure.
This is especially important given that the platform handles sensitive personal
background check information.

### Steps:

1. **Authentication checks on API routes**
   - Read every file in the API routes directory
   - For each route that returns or modifies data, check: is `getServerSession()` or
     equivalent called at the top before any data is accessed?
   - List any routes where this check appears to be missing or incomplete

2. **Role-based permission enforcement**
   - Find where user roles/permissions are defined (likely in `prisma/schema.prisma`
     and in auth-related files)
   - For admin-only operations (creating users, changing configurations), verify that
     the role is checked server-side — not just hidden on the frontend
   - Note any places where a lower-privilege user might be able to call an endpoint
     they shouldn't have access to

3. **Input validation on API routes**
   - For POST and PUT routes, check: is the incoming request body validated with Zod
     or similar before being used?
   - List any routes that use request body data without validating it first

4. **Sensitive data exposure**
   - Check whether any API routes return more data than needed (e.g., returning a full
     user object including password hash when only the name is needed)
   - Look for any console.log statements that might output sensitive data
   - Check that `.env` files are in `.gitignore`

5. **Environment variables**
   - List all environment variables referenced in the codebase
   - Confirm that secrets (database URL, auth secret, etc.) are not hardcoded anywhere

6. **Rate limiting and DDoS protection**
   - Check if any API routes implement rate limiting
   - Look for middleware or libraries that provide rate limiting (e.g., express-rate-limit, next-rate-limit)
   - Identify public-facing endpoints that could be abused without rate limiting
   - Check for any implemented throttling mechanisms

### What to report:
- List of API routes with missing or incomplete authentication checks
- List of API routes with missing input validation
- Any instances of sensitive data being over-exposed
- Any hardcoded secrets or sensitive values found
- List of public endpoints without rate limiting that could be abused
- Overall security risk rating: Low / Medium / High / Critical

### Documentation to create:
- `/docs/architecture/security-model.md` — Current authentication and authorization architecture
- `/docs/standards/security-checklist.md` — Security requirements for all API routes
- `/docs/runbooks/security-audit.md` — How to perform security audits going forward

---

## SECTION 3: Code Structure and Organization Audit

**Goal:** Understand whether the codebase is organized in a way that is maintainable,
consistent, and scalable as the platform grows.

### Steps:

1. **Consistency of patterns across modules**
   - Compare how User Admin, Global Configurations, and Customer Configurations modules
     are structured
   - Do they follow the same patterns for: API routes, data fetching, form handling,
     error handling?
   - Note any modules that appear to have been built differently from the others

2. **Separation of concerns**
   - Look for "god components" — files that are doing too many things (database calls,
     business logic, AND rendering all in one place)
   - Note any files over 400 lines long — these are candidates for being split up
   - Check whether there is a clear separation between: UI components / business logic /
     data access

3. **Code duplication**
   - Look for repeated patterns that appear in multiple places
   - Examples to look for: similar error handling blocks, repeated permission checks,
     similar form validation logic
   - Note the most significant cases of duplication

4. **Type safety**
   - Check `tsconfig.json` — is strict mode enabled?
   - Search for uses of `any` type: `grep -r ": any" src/`
   - A high number of `any` usages weakens the benefits of TypeScript

5. **Naming and file organization**
   - Are component files consistently named in PascalCase?
   - Are utility/helper files consistently named in camelCase?
   - Are there files in unexpected locations?

6. **API route consistency**
   - Do all API routes follow the same pattern for: returning success responses,
     returning error responses, and handling unexpected errors?
   - Is there a standard response format used everywhere, or does each route do its own thing?

### What to report:
- Overall structure rating: Well Organized / Mostly Consistent / Inconsistent / Difficult to Maintain
- Top 5 most significant structural issues found
- List of files over 400 lines that should be broken up
- Count of `any` type usages
- Whether strict TypeScript is enabled

### Documentation to create:
- `/docs/architecture/project-structure.md` — Current project organization and module structure
- `/docs/standards/code-conventions.md` — Coding standards and patterns to follow
- `/docs/plans/refactoring-plan.md` — Prioritized list of refactoring tasks

---

## SECTION 4: Error Handling Audit

**Goal:** Understand whether the platform handles errors gracefully and informatively,
or whether errors could crash the app or silently fail.

### Steps:

1. **API route error handling**
   - For each API route, check: is there a try/catch block?
   - When an error is caught, is a meaningful HTTP error code returned (400, 401, 403, 500)?
   - Or does the error just get silently swallowed, or re-throw without a proper response?

2. **Database error handling**
   - What happens if a Prisma database call fails?
   - Is the error caught and handled, or does it propagate uncaught?
   - Look for any Prisma calls that are NOT inside a try/catch

3. **Frontend error handling**
   - Are there `error.tsx` files defined for the main routes?
   - Is there a global error boundary?
   - What does the user see if an API call fails in the UI?

4. **Form submission errors**
   - When a form submission fails (e.g., network error, validation error from server),
     does the UI show a useful message to the user?
   - Or does it silently fail with no feedback?

### What to report:
- Percentage estimate of API routes with proper error handling
- Any Prisma calls outside try/catch blocks
- Whether global error boundaries exist
- Overall error handling rating: Robust / Adequate / Needs Improvement / Poor

### Documentation to create:
- `/docs/standards/error-handling.md` — Standard error handling patterns
- `/docs/architecture/error-strategy.md` — Error handling architecture and flow

---

## SECTION 5: Performance and Scalability Audit

**Goal:** Identify patterns that could cause performance problems as the platform grows
to handle more customers, candidates, and data.

### Steps:

1. **Database query efficiency**
   - Look for Prisma queries inside loops (e.g., fetching records one by one in a forEach)
     — this is called the "N+1 problem" and causes serious slowdowns at scale
   - Check whether `include` statements in Prisma queries are selective (only including
     what's needed) or greedy (including everything)
   - Look for any queries without pagination on lists that could grow large

2. **Data fetching patterns**
   - Are large lists of data fetched with any limit/pagination, or all at once?
   - Are there any places where the same data is fetched multiple times when it could
     be fetched once?

3. **Client vs server rendering**
   - In Next.js App Router, server components are more efficient for data fetching
   - Note how many components use `"use client"` — client components should be used
     only when interactivity requires it (e.g., forms, buttons with state)
   - Are there pages that are fully client-side rendered when they could be server-rendered?

4. **Dependencies and bundle size**
   - Review `package.json` for any large dependencies that might not be necessary
   - Check if any dependencies are duplicated or have better lightweight alternatives

5. **Database performance optimization**
   - Check if database indexes are defined in Prisma schema for frequently queried fields
   - Look for composite indexes on fields that are often queried together
   - Check if there are any full table scans happening on large tables
   - Verify that foreign key relationships have appropriate indexes
   - Look for any missing indexes on fields used in WHERE, ORDER BY, or JOIN clauses

### What to report:
- Any instances of database queries in loops (N+1 problems)
- Any lists fetched without pagination
- Estimate of server vs client component balance
- Any obvious dependency concerns
- List of fields that should have indexes but don't
- Any potential database performance bottlenecks

### Documentation to create:
- `/docs/architecture/database-schema.md` — Current database structure and relationships
- `/docs/standards/database-patterns.md` — Best practices for database queries
- `/docs/plans/performance-optimization.md` — Performance improvement roadmap

---

## SECTION 6: Dependencies and Maintenance Audit

**Goal:** Ensure the platform is built on up-to-date, well-maintained technology.

### Steps:

1. Run: `pnpm outdated` to see which packages have available updates

2. Check the versions of the most critical dependencies:
   - Next.js (should be 14.x or 15.x)
   - Prisma (should be recent stable)
   - NextAuth.js (note: v5 was released as "Auth.js" — check which is in use)
   - TypeScript (should be 5.x)

3. Look for any packages that are:
   - Deprecated
   - No longer maintained
   - Have known security vulnerabilities (run `pnpm audit` if available)

4. Check whether there is a `.nvmrc` or `engines` field in `package.json` specifying
   the required Node.js version

### What to report:
- List of significantly outdated packages
- Any deprecated or unmaintained packages
- Results of `pnpm audit` if it runs successfully
- Node.js version requirements

### Documentation to create:
- `/docs/runbooks/dependency-update.md` — Process for updating dependencies safely
- `/docs/architecture/tech-stack.md` — Current technology stack and versions

---

## SECTION 7: Documentation and Developer Experience Audit

**Goal:** Assess how easy it would be for a new developer to understand and work on
this codebase, which is important for enterprise maintainability.

### Steps:

1. **README and setup documentation**
   - Is there a `README.md`?
   - Does it explain: what the project is, how to set it up locally, how to run it,
     how to run tests (if any)?
   - Could a new developer follow it to get the project running?

2. **Code comments**
   - Are complex pieces of logic commented to explain WHY they work the way they do?
   - Note: comments explaining WHAT code does are less valuable than comments explaining
     WHY a decision was made

3. **Type definitions**
   - Are TypeScript types defined clearly and consistently?
   - Is there a central `types/` directory being used consistently?

4. **Environment setup**
   - Is there a `.env.example` file showing what environment variables are needed?
   - Are all required environment variables documented?

5. **API documentation**
   - Check if API routes are documented (OpenAPI/Swagger spec, or inline documentation)
   - Is there a central place describing available endpoints and their parameters?
   - Are request/response schemas documented?
   - Check for any API versioning strategy

### What to report:
- Whether setup documentation exists and is complete
- Whether a new developer could realistically get started without asking questions
- Quality of inline code documentation: Good / Adequate / Minimal / Missing
- API documentation status: Comprehensive / Partial / Missing
- Whether API contracts are clear and discoverable

### Documentation to create:
- `/docs/api/endpoints.md` — Complete API endpoint documentation
- `/docs/runbooks/local-setup.md` — Step-by-step local development setup
- `/docs/architecture/system-overview.md` — High-level system architecture

---

## SECTION 8: Monitoring and Observability Readiness Audit

**Goal:** Assess whether the platform is ready for production monitoring, debugging, and
incident response.

### Steps:

1. **Logging patterns**
   - Search for logging statements (console.log, console.error, custom loggers)
   - Check if there's a consistent logging strategy or just ad-hoc console statements
   - Look for structured logging (JSON format) vs unstructured string logs
   - Check if logs include appropriate context (user ID, request ID, timestamps)

2. **Error tracking readiness**
   - Check if there's integration with error tracking services (Sentry, Rollbar, etc.)
   - Look for proper error context being captured (stack traces, user context, request data)
   - Verify that errors are being logged with appropriate severity levels

3. **Performance monitoring**
   - Check for any APM (Application Performance Monitoring) integrations
   - Look for custom performance metrics being tracked
   - Check if there are any database query performance logs

4. **Health checks and readiness endpoints**
   - Look for /health or /ready endpoints for container orchestration
   - Check if these endpoints verify critical dependencies (database, external services)

5. **Audit trails**
   - For sensitive operations (user creation, permission changes), check if there's an audit log
   - Verify that audit logs capture: who, what, when, and from where

### What to report:
- Current logging approach and its production readiness
- Whether the app is ready for error tracking integration
- Any missing observability critical for production
- Audit trail completeness for compliance requirements

### Documentation to create:
- `/docs/runbooks/monitoring-setup.md` — How to set up production monitoring
- `/docs/standards/logging-standards.md` — Logging patterns and requirements
- `/docs/architecture/observability.md` — Observability strategy and implementation

---

## SECTION 9: Data Migration and Backup Strategy Audit

**Goal:** Ensure the platform has proper data management strategies for production
deployment and disaster recovery.

### Steps:

1. **Database migrations**
   - Check the `prisma/migrations` directory structure
   - Verify that migrations are properly versioned and sequential
   - Look for any migration scripts that might be destructive
   - Check if there's a rollback strategy documented

2. **Seed data and test data management**
   - Look for seed scripts in package.json or prisma directory
   - Check if seed data is separated from production data properly
   - Verify that test data doesn't contain real personal information

3. **Backup strategy indicators**
   - Check if there are any backup scripts in the codebase
   - Look for documentation about backup procedures
   - Check for any database dump scripts or backup automation

4. **Data retention and cleanup**
   - Look for any scheduled jobs or scripts that clean up old data
   - Check if there's consideration for GDPR/privacy compliance (data deletion)
   - Look for any data archival strategies

5. **Multi-environment data management**
   - Check how the app handles different environments (dev, staging, production)
   - Look for environment-specific configuration for databases
   - Verify that production credentials are properly protected

### What to report:
- Migration strategy assessment and any risks identified
- Whether backup procedures are defined or need to be created
- Data privacy and retention considerations
- Environment separation effectiveness

### Documentation to create:
- `/docs/runbooks/database-migrations.md` — How to run and manage migrations
- `/docs/runbooks/backup-restore.md` — Backup and restoration procedures
- `/docs/decisions/data-retention-policy.md` — Data retention and privacy decisions
- `/docs/architecture/environments.md` — Environment setup and management

---

## SECTION 10: TDD Readiness Assessment

**Goal:** Based on everything found in the previous sections, assess what would be
needed to begin implementing Test Driven Development going forward.

### Steps:

Synthesize the findings from Sections 1–7 to answer these questions:

1. **What would need to change before TDD is practical?**
   - If business logic is buried inside components, it needs to be extracted first
   - If there is no testing framework installed, one needs to be chosen and set up
   - If API routes mix too many concerns, they need to be refactored

2. **What are the highest-value areas to write tests for first?**
   - Authentication and permission logic
   - Order ID generation (if built)
   - Core API routes for customers and candidates
   - Form validation schemas

3. **What testing strategy would work best for this codebase?**
   - Unit tests (Jest/Vitest) for isolated functions and validation logic
   - Integration tests for API routes
   - End-to-end tests (Playwright) for critical user flows

4. **Rebuild vs. Improve: Provide a recommendation**
   - Based on the audit findings, assess: is the codebase in good enough shape to
     improve incrementally with TDD going forward?
   - Or are there enough fundamental structural problems that a guided rebuild would
     be more practical?
   - Be specific about what drives this recommendation

---

## OUTPUT: Audit Report

When all sections are complete, create the file `/GlobalRX_v2/docs/audit/AUDIT_REPORT.md` with
the following structure:

```
# GlobalRx Enterprise Readiness Audit Report
**Date:** [today's date]
**Audited By:** Claude Code

---

## Executive Summary
[3–5 sentence plain-English summary of overall findings. Suitable for a
non-technical reader. Include the single most important finding.]

---

## Overall Readiness Rating

| Area                        | Rating       |
|-----------------------------|-------------|
| Testing Coverage            | [rating]    |
| Security & Data Safety      | [rating]    |
| Code Structure              | [rating]    |
| Error Handling              | [rating]    |
| Performance & Scalability   | [rating]    |
| Dependencies & Maintenance  | [rating]    |
| Documentation               | [rating]    |

Ratings: ✅ Enterprise Ready | ⚠️ Needs Improvement | 🔴 Critical Gap

---

## Critical Issues (Fix Immediately)
[Numbered list of any findings rated Critical — these block enterprise readiness]

---

## Important Issues (Fix Before Growth)
[Numbered list of significant findings that should be addressed soon]

---

## Minor Issues (Address Over Time)
[Numbered list of lower-priority improvements]

---

## Detailed Findings by Section
[One subsection per audit section above with specific findings, file names,
and line numbers where relevant]

---

## Recommended Next Steps
[Specific, ordered action plan. What to do first, second, third.
Include whether the recommendation is to rebuild with TDD or improve incrementally.]

---

## TDD Implementation Roadmap
[Specific guidance on how to begin implementing TDD on this codebase,
including what to set up first and which areas to write tests for first]
```

---

## FINAL INSTRUCTIONS FOR CLAUDE CODE

- Do NOT modify any code during this audit
- Be specific — include file paths and line numbers in your findings
- If you cannot access a file or run a command, note it and continue
- Prioritize findings by business impact, not just technical severity
- Write the final report in plain language — the primary reader is not a developer
- When the report is complete, confirm to the user that the audit is done and
  where the report was saved (`/GlobalRX_v2/docs/audit/AUDIT_REPORT.md`)
```
