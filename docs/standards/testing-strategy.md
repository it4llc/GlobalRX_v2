# GlobalRx Testing Strategy
**Created:** February 23, 2026
**Status:** Initial Assessment

## Current State

### No Testing Infrastructure
- **Zero test files** found in the entire codebase
- **No test runners** configured (Jest, Vitest, Playwright, Cypress)
- **No test configuration files** present
- Package.json has test scripts defined but no framework installed

## Code Testability Assessment

### API Routes - Needs Refactoring to Test
**Current Issues:**
- Business logic mixed directly with HTTP handlers
- Database calls embedded in route handlers
- Permission checking logic duplicated across files (though utility exists)
- No separation between data access and business logic layers

**Example Pattern Found:**
```typescript
// Current: Everything in one place
export async function GET(request) {
  // Auth check
  // Permission check
  // Direct Prisma call
  // Response formatting
}
```

### Authentication & Permissions - Easy to Test
**Positive Findings:**
- Clean utility functions exist (`src/lib/permission-utils.ts`)
- Pure functions for permission checking
- Well-defined permission models
- Could be unit tested immediately

### Database Layer - Very Difficult to Test
**Current Issues:**
- Prisma calls scattered throughout API routes
- No repository/service layer abstraction
- Complex queries with multiple includes/joins inline
- Would require significant mocking to test current structure

### Form Validation - Easy to Test
**Positive Findings:**
- Zod schemas defined for validation
- Schemas are mostly isolated and reusable
- Could be unit tested independently

## Recommended Testing Approach

### Phase 1: Foundation (Week 1)
1. **Set up Vitest** for unit testing (faster than Jest, better TypeScript support)
2. **Add Playwright** for E2E testing
3. **Configure coverage reports**

### Phase 2: Unit Tests (Weeks 2-3)
Priority targets:
1. Permission utilities (`hasPermission`, `normalizePermissions`)
2. Zod validation schemas
3. Any pure utility functions

### Phase 3: Integration Tests (Weeks 3-4)
1. Create test database
2. Test API routes with mocked session
3. Test database queries in isolation

### Phase 4: E2E Tests (Week 5)
Critical user flows:
1. Authentication flow
2. Customer creation/editing
3. Permission-based access control
4. Order submission workflow

## Required Refactoring for Testability

### High Priority
1. **Extract business logic from API routes** into service classes
2. **Create repository layer** for database access
3. **Centralize error handling**

### Medium Priority
1. Consolidate validation schemas in central location
2. Create factory functions for test data
3. Add dependency injection for easier mocking

### Low Priority
1. Reduce component complexity
2. Extract complex UI logic into hooks
3. Improve type safety to reduce test surface area

## Testing Standards Going Forward

### Coverage Targets
- **Overall:** 80% code coverage
- **Critical paths:** 100% coverage for auth, permissions, payments
- **New code:** All new features must include tests

### Test Types Required
1. **Unit tests** for all utility functions
2. **Integration tests** for API endpoints
3. **E2E tests** for critical user journeys
4. **Performance tests** for data-heavy operations

### Test Naming Convention
```
describe('ComponentName/FunctionName', () => {
  it('should [expected behavior] when [condition]', () => {
    // test implementation
  });
});
```

## Estimated Effort

**To reach minimum viable testing:**
- Setup: 2-3 days
- Basic unit tests: 1 week
- API integration tests: 2 weeks
- E2E tests: 1 week
- **Total: ~4 weeks** for one developer

**To reach enterprise-ready testing:**
- Full coverage: 8-10 weeks
- Performance testing: 2 weeks
- Load testing: 1 week
- **Total: ~3 months** with dedicated QA resources