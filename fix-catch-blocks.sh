#!/bin/bash

# Fix patterns where we're accessing .message on unknown error types
echo "Fixing catch block error property accesses..."

# Pattern 1: error.message where error is unknown
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/\berror\.message\b/error instanceof Error ? error.message : String(error)/g' {} +

# Pattern 2: dbError.message where dbError is unknown  
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/\bdbError\.message\b/dbError instanceof Error ? dbError.message : String(dbError)/g' {} +

# Pattern 3: txError.message where txError is unknown
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/\btxError\.message\b/txError instanceof Error ? txError.message : String(txError)/g' {} +

# Pattern 4: e.message where e is unknown (common in catch(e))
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/\be\.message\b/e instanceof Error ? e.message : String(e)/g' {} +

echo "Catch block fixes applied!"
