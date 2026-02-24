#!/bin/bash

echo "Fixing implicit any parameters..."

# Fix event handlers with implicit any
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/(\(e\))/(\1: any)/g; 
   s/(e: any: any)/(e: any)/g' {} +

# Fix other common implicit any patterns
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/(\(item\))/(\1: any)/g;
   s/(item: any: any)/(item: any)/g' {} +

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/(\(workflow\))/(\1: any)/g;
   s/(workflow: any: any)/(workflow: any)/g' {} +

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/(\(countryId\))/(\1: any)/g;
   s/(countryId: any: any)/(countryId: any)/g' {} +

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/(\(subregion1Id\))/(\1: any)/g;
   s/(subregion1Id: any: any)/(subregion1Id: any)/g' {} +

echo "Implicit any fixes applied!"
