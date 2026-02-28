#!/bin/bash

# Run tests sequentially to avoid hanging issues
# This is a temporary workaround for CI/CD

echo "Running tests sequentially..."

FAILED=0

# Run hook tests
echo "Running hook tests..."
pnpm test src/__tests__/hooks --run || FAILED=1

# Run other unit tests
echo "Running other unit tests..."
pnpm test src/__tests__/auth.test.ts --run || FAILED=1
pnpm test src/__tests__/order-form.test.ts --run || FAILED=1
pnpm test src/__tests__/order-services-refactor.test.ts --run || FAILED=1
pnpm test src/__tests__/permission-utils.test.ts --run || FAILED=1
pnpm test src/__tests__/order-form-hooks.test.ts --run || FAILED=1
pnpm test src/__tests__/customer-configs-page.test.tsx --run || FAILED=1

if [ $FAILED -eq 0 ]; then
  echo "All tests passed!"
else
  echo "Some tests failed!"
  exit 1
fi