# GlobalRx Project Structure
**Created:** February 23, 2026
**Status:** Current State Documentation

## Overall Architecture

### Technology Stack
- **Framework:** Next.js 14.1.0 with App Router
- **Language:** TypeScript 5.3.3
- **Styling:** Tailwind CSS with shadcn/ui components
- **Database:** PostgreSQL with Prisma ORM
- **State Management:** React hooks and context
- **Authentication:** NextAuth.js

### Project Organization
```
/src
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin user management (minimal)
│   ├── api/               # API routes
│   ├── customer-configs/  # Customer configuration module
│   ├── global-configurations/ # Global settings module
│   ├── portal/            # Customer portal module
│   └── login/             # Authentication pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── modules/          # Feature-specific components
│   └── auth/             # Authentication components
├── lib/                   # Utilities and services
│   ├── services/         # Business logic services
│   └── utils/            # Helper functions
├── types/                 # TypeScript type definitions
├── contexts/             # React context providers
└── hooks/                # Custom React hooks
```

## Module Breakdown

### 1. Admin Module (/app/admin)
**Status:** Under-developed
- Basic user management page
- Minimal functionality compared to other modules
- **Files:** 2 (layout.tsx, users/page.tsx)

### 2. Customer Configurations (/app/customer-configs)
**Status:** Well-structured ⭐⭐⭐⭐⭐
- Comprehensive customer management
- Proper dynamic routing with [id] parameters
- Sub-modules for workflows, packages, scope
- **Files:** 15+ pages and layouts

### 3. Global Configurations (/app/global-configurations)
**Status:** Excellently organized ⭐⭐⭐⭐⭐
- Clear separation by configuration type:
  - `/data-rx` - Data requirements
  - `/dsx` - DSX configurations
  - `/locations` - Location management
  - `/services` - Service definitions
  - `/translations` - Multi-language support
- Consistent patterns across sub-modules

### 4. Portal Module (/app/portal)
**Status:** Well-organized ⭐⭐⭐⭐
- Customer-facing functionality
- Dashboard, orders, profile sections
- Clear user journey flow

### 5. API Routes (/app/api)
**Status:** Comprehensive but needs refactoring
- 45+ API endpoints
- Mix of REST patterns
- Business logic embedded in route handlers
- Needs service layer extraction

## Component Architecture

### UI Components (/components/ui)
Reusable, atomic components:
- Buttons, forms, dialogs, alerts
- Tables, cards, navigation
- Based on shadcn/ui library
- **Count:** 30+ UI components

### Module Components (/components/modules)
Feature-specific components:
- `/customer` - Customer management components
- `/global-config` - Configuration components
- `/workflows` - Workflow builders
- `/services` - Service configuration
- **Count:** 50+ module components

## Code Quality Metrics

### File Size Distribution
- **Over 1000 lines:** 3 files (CRITICAL)
- **400-1000 lines:** 16 files (needs refactoring)
- **Under 400 lines:** ~200 files (good)

### Largest Files (Need Decomposition)
1. `/app/portal/orders/new/page.tsx` - 1,470 lines
2. `/lib/services/order.service.ts` - 1,055 lines
3. `/app/customer-configs/[id]/page.tsx` - 1,013 lines

### TypeScript Usage
- **Strict Mode:** ❌ DISABLED
- **Any Types:** 122 instances
- **Type Coverage:** ~70% (estimated)
- **Path Aliases:** ✅ Configured (@/*)

## Patterns and Conventions

### Naming Conventions
✅ **Good Practices:**
- PascalCase for components
- kebab-case for files
- camelCase for utilities
- Consistent page.tsx/layout.tsx

⚠️ **Inconsistencies:**
- Mixed patterns for "new" components (-new suffix vs versions)
- Some direct component files vs organized folders

### Code Patterns

#### API Routes Pattern
```typescript
// Current pattern (mixed concerns)
export async function GET(request) {
  // Authentication check
  // Permission check
  // Direct Prisma calls
  // Business logic
  // Response formatting
}
```

#### Component Pattern
```typescript
// Large components doing too much
export function CustomerConfig() {
  // 1000+ lines of mixed concerns
  // State management
  // API calls
  // Complex rendering
  // Business logic
}
```

## Duplication Issues

### Dialog Components
- 14 similar dialog implementations
- Could share base dialog component
- Repeated form patterns

### API Call Patterns
- Inconsistent fetch usage
- Some use fetchWithAuth helper
- Others use direct fetch()
- No centralized API client

### Permission Checking
- Duplicated logic across routes
- Though utility exists, not always used
- Mixed implementation patterns

## Strengths

1. **Clear module separation** - Each business domain well isolated
2. **Modern stack** - Next.js 14 App Router, TypeScript
3. **Component organization** - Good ui/modules separation
4. **Routing structure** - Proper use of dynamic routes
5. **Consistent layouts** - Good use of layout.tsx pattern

## Weaknesses

1. **TypeScript strict mode disabled** - Reduces type safety
2. **Large files** - Several 1000+ line components
3. **Mixed API patterns** - No consistent service layer
4. **Any type overuse** - 122 instances
5. **Business logic in routes** - Should be in services

## Recommendations

### Immediate Actions
1. Enable TypeScript strict mode
2. Break down files over 400 lines
3. Extract business logic from API routes
4. Create base dialog component

### Short Term (This Month)
1. Reduce any type usage to < 20
2. Implement consistent API client
3. Create service layer for business logic
4. Standardize component patterns

### Long Term (Quarter)
1. Full type coverage
2. Component library documentation
3. Storybook for UI components
4. Architecture decision records

## Migration Path

### Phase 1: Type Safety
```bash
# Enable strict mode gradually
"strict": true,
"strictNullChecks": true,
"strictFunctionTypes": true,
"strictBindCallApply": true,
```

### Phase 2: Service Layer
Extract business logic from routes:
```typescript
// Before: In API route
const customer = await prisma.customer.create({...})

// After: In service
const customer = await customerService.create({...})
```

### Phase 3: Component Decomposition
Break large components into smaller, focused ones:
- Extract forms into separate components
- Create custom hooks for state logic
- Separate data fetching from rendering

## Architecture Score

**Overall: 7/10** - Good foundation with clear improvement areas

### Scoring Breakdown
- Module Organization: 9/10
- Component Structure: 8/10
- Type Safety: 5/10
- Code Reusability: 6/10
- Separation of Concerns: 6/10

The architecture is solid and maintainable but needs refinement for enterprise scale.