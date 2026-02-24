#!/bin/bash

# Script to fix specific error.message and unknown type errors
cd "/Users/andyhellman/Library/CloudStorage/Dropbox/9-REALi Data Solutions/GlobalRx_v2"

# Get files with TS18046 and TS2339 errors related to error properties
files=$(pnpm typecheck 2>&1 | grep -E "(TS18046|TS2339.*message)" | cut -d'(' -f1 | sort -u)

for file in $files; do
  if [[ -f "$file" ]]; then
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

    # Fix specific error patterns
    # Fix error.message in logger calls
    sed -i '' "s/error: \([a-zA-Z][a-zA-Z0-9_]*\)\.message/error: getErrorDetails(\1).message/g" "$file"
    sed -i '' "s/stack: \([a-zA-Z][a-zA-Z0-9_]*\)\.stack/stack: getErrorDetails(\1).stack/g" "$file"

    # Fix error.message in return statements
    sed -i '' "s/error instanceof Error ? \([a-zA-Z][a-zA-Z0-9_]*\)\.message : 'Unknown error'/getErrorDetails(\1).message/g" "$file"

    # Fix direct property access in other contexts
    sed -i '' "s/\([a-zA-Z][a-zA-Z0-9_]*\)\.message || 'Unknown error'/getErrorDetails(\1).message/g" "$file"

  fi
done

echo "Error details fixes complete!"