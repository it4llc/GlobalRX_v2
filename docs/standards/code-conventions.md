# GlobalRx Code Conventions and Standards
**Created:** February 23, 2026
**Purpose:** Coding standards for consistent, maintainable code

## TypeScript Standards

### Type Safety Requirements
```typescript
// ✅ ALWAYS use strict typing
interface CustomerData {
  id: string;
  name: string;
  email: string;
}

// ❌ NEVER use any
const processData = (data: any) => {} // Bad

// ✅ Use unknown and type guards instead
const processData = (data: unknown) => {
  if (isCustomerData(data)) {
    // Type is now narrowed to CustomerData
  }
}
```

### Enable Strict Mode
```json
// tsconfig.json - Required settings
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true
  }
}
```

## File and Folder Structure

### Naming Conventions
```
/src
├── components/
│   ├── CustomerDialog.tsx      # ✅ PascalCase for components
│   └── ui/
│       └── button.tsx          # ✅ lowercase for ui components
├── lib/
│   ├── utils/
│   │   └── formatDate.ts       # ✅ camelCase for utilities
│   └── services/
│       └── customerService.ts  # ✅ camelCase with 'Service' suffix
├── app/
│   ├── customer-configs/       # ✅ kebab-case for routes
│   │   └── page.tsx           # ✅ Always page.tsx
│   └── api/
│       └── customers/
│           └── route.ts        # ✅ Always route.ts for API
└── types/
    └── customer.types.ts       # ✅ .types.ts suffix
```

### File Size Limits
- **Maximum file size:** 400 lines
- **Ideal file size:** 100-250 lines
- **Component complexity:** Single responsibility

## Component Standards

### Component Structure Template
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { CustomerData } from '@/types/customer.types';

// 2. Types/Interfaces
interface CustomerListProps {
  initialData?: CustomerData[];
  onSelect: (customer: CustomerData) => void;
}

// 3. Component
export function CustomerList({
  initialData = [],
  onSelect
}: CustomerListProps) {
  // 4. State and hooks
  const [customers, setCustomers] = useState(initialData);
  const { user } = useAuth();

  // 5. Effects
  useEffect(() => {
    // Effect logic
  }, [dependency]);

  // 6. Handlers
  const handleSelect = (customer: CustomerData) => {
    onSelect(customer);
  };

  // 7. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Component Best Practices
```typescript
// ✅ GOOD: Small, focused component
export function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Card>
      <CardHeader>{customer.name}</CardHeader>
      <CardContent>{customer.email}</CardContent>
    </Card>
  );
}

// ❌ BAD: God component doing everything
export function CustomerManager() {
  // 1000+ lines handling:
  // - Data fetching
  // - Form validation
  // - Multiple sub-features
  // - Complex state management
}
```

## API Route Standards

### API Route Template
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-utils';
import { customerSchema } from '@/schemas/customer.schema';
import { customerService } from '@/services/customer.service';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Authorization
    if (!hasPermission(session.user, 'customers', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Validation
    const body = await request.json();
    const validated = customerSchema.parse(body);

    // 4. Business logic (in service, not here!)
    const result = await customerService.create(validated);

    // 5. Response
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}
```

## Service Layer Standards

### Service Pattern
```typescript
// services/customer.service.ts
class CustomerService {
  async create(data: CreateCustomerDto): Promise<Customer> {
    // Business logic here
    return await prisma.customer.create({ data });
  }

  async findById(id: string): Promise<Customer | null> {
    return await prisma.customer.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateCustomerDto): Promise<Customer> {
    // Validation, business rules, etc.
    return await prisma.customer.update({ where: { id }, data });
  }
}

export const customerService = new CustomerService();
```

## State Management

### Context Pattern
```typescript
// contexts/CustomerContext.tsx
interface CustomerContextType {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  fetchCustomers: () => Promise<void>;
  createCustomer: (data: CreateCustomerDto) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  // Provider implementation
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within CustomerProvider');
  }
  return context;
}
```

## Error Handling

### Standard Error Response
```typescript
interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}

// Consistent error handling
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.errors },
      { status: 400 }
    );
  }

  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Duplicate entry' },
        { status: 409 }
      );
    }
  }

  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Import Organization

### Import Order
```typescript
// 1. React/Next.js imports
import React, { useState, useEffect } from 'react';
import { NextRequest, NextResponse } from 'next/server';

// 2. Third-party libraries
import { z } from 'zod';
import { format } from 'date-fns';

// 3. Internal absolute imports
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { customerService } from '@/services/customer.service';

// 4. Relative imports
import { localHelper } from './utils';

// 5. Types
import type { Customer } from '@/types/customer.types';
```

## Comments and Documentation

### JSDoc for Functions
```typescript
/**
 * Creates a new customer account with associated services
 * @param data - Customer creation data
 * @param services - Array of service IDs to associate
 * @returns The created customer with service relationships
 * @throws {ValidationError} If data validation fails
 * @throws {DuplicateError} If customer email already exists
 */
export async function createCustomer(
  data: CreateCustomerDto,
  services: string[]
): Promise<Customer> {
  // Implementation
}
```

### Inline Comments
```typescript
// ✅ GOOD: Explains WHY
// We need to check both conditions because legacy customers
// might have incomplete data from the old system
if (!customer.email || !customer.verified) {
  return false;
}

// ❌ BAD: Explains WHAT (obvious from code)
// Check if email exists
if (!customer.email) {
  return false;
}
```

## Testing Standards

### Test File Naming
```
CustomerService.test.ts       # Unit tests
CustomerDialog.test.tsx       # Component tests
customers.e2e.test.ts        # End-to-end tests
```

### Test Structure
```typescript
describe('CustomerService', () => {
  describe('create', () => {
    it('should create a customer with valid data', async () => {
      // Arrange
      const data = mockCustomerData();

      // Act
      const result = await customerService.create(data);

      // Assert
      expect(result).toMatchObject(data);
    });

    it('should throw validation error with invalid email', async () => {
      // Test implementation
    });
  });
});
```

## Git Commit Standards

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Examples
```
feat(customers): add bulk import functionality
fix(auth): resolve session timeout issue
refactor(api): extract business logic to service layer
test(orders): add integration tests for order workflow
docs(api): update endpoint documentation
```

## Code Review Checklist

Before submitting PR:
- [ ] TypeScript strict mode enabled
- [ ] No `any` types used
- [ ] Files under 400 lines
- [ ] Components follow single responsibility
- [ ] API routes use permission checks
- [ ] Business logic in services, not routes
- [ ] Proper error handling
- [ ] Tests written for new code
- [ ] Documentation updated

## Migration from Current Code

### Priority 1: Type Safety
1. Enable strict mode incrementally
2. Replace all `any` with proper types
3. Add missing type definitions

### Priority 2: File Size
1. Break down large components
2. Extract reusable logic to hooks
3. Create smaller, focused modules

### Priority 3: Consistency
1. Standardize API patterns
2. Consolidate duplicate code
3. Implement service layer

## Enforcement

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### ESLint Rules
```javascript
// .eslintrc.js
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "max-lines": ["error", 400],
    "complexity": ["error", 10]
  }
}
```

These conventions ensure code quality, maintainability, and consistency across the GlobalRx platform.