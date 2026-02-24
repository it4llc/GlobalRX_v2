#!/bin/bash

# Script to fix unknown type errors in catch blocks
cd "/Users/andyhellman/Library/CloudStorage/Dropbox/9-REALi Data Solutions/GlobalRx_v2"

# Find all files with error.message pattern that might be causing TS18046/TS2339 errors
files=$(find src scripts -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "\\.message" {} \;)

for file in $files; do
  echo "Processing $file..."

  # Check if file already imports getErrorDetails
  if ! grep -q "import.*getErrorDetails" "$file"; then
    # Add import for getErrorDetails from utils
    if grep -q "import.*from '@/lib/utils'" "$file"; then
      # Add to existing utils import
      sed -i '' "s/import { \(.*\) } from '@\/lib\/utils'/import { \1, getErrorDetails } from '@\/lib\/utils'/" "$file"
    else
      # Add new import line after other imports
      if grep -q "^import " "$file"; then
        # Find last import line and add after it
        lastImport=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)
        sed -i '' "${lastImport}a\\
import { getErrorDetails } from '@/lib/utils';
" "$file"
      fi
    fi
  fi

  # Fix error.message patterns to use getErrorDetails(error).message
  sed -i '' "s/\([a-zA-Z][a-zA-Z0-9_]*\)\.message/getErrorDetails(\1).message/g" "$file"

  # Also fix error.stack patterns
  sed -i '' "s/getErrorDetails(\([a-zA-Z][a-zA-Z0-9_]*\))\.stack/getErrorDetails(\1).stack/g" "$file"

done

echo "Unknown error fixes complete!"