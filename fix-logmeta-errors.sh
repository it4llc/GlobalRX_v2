#!/bin/bash

# Script to fix LogMeta type errors in clientLogger calls
cd "/Users/andyhellman/Library/CloudStorage/Dropbox/9-REALi Data Solutions/GlobalRx_v2"

# Find all files with clientLogger.error calls that need fixing
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "clientLogger\.error.*\(error\|err\|e\)[^a-zA-Z]" {} \;)

for file in $files; do
  echo "Processing $file..."

  # Check if file already imports errorToLogMeta
  if ! grep -q "import.*errorToLogMeta" "$file"; then
    # Check if file imports clientLogger
    if grep -q "import clientLogger from '@/lib/client-logger'" "$file"; then
      # Add errorToLogMeta to existing import
      sed -i '' "s/import clientLogger from '@\/lib\/client-logger'/import clientLogger, { errorToLogMeta } from '@\/lib\/client-logger'/" "$file"
    elif grep -q "import.*clientLogger" "$file"; then
      # Add errorToLogMeta to existing named import
      sed -i '' "s/import { \(.*\)clientLogger\(.*\) } from '@\/lib\/client-logger'/import { \1clientLogger, errorToLogMeta\2 } from '@\/lib\/client-logger'/" "$file"
      sed -i '' "s/import { clientLogger } from '@\/lib\/client-logger'/import { clientLogger, errorToLogMeta } from '@\/lib\/client-logger'/" "$file"
    fi
  fi

  # Fix clientLogger.error calls to wrap error variables with errorToLogMeta()
  sed -i '' "s/clientLogger\.error('\([^']*\)', \(error\|err\|e\))/clientLogger.error('\1', errorToLogMeta(\2))/g" "$file"
  sed -i '' "s/clientLogger\.error(\"\([^\"]*\)\", \(error\|err\|e\))/clientLogger.error(\"\1\", errorToLogMeta(\2))/g" "$file"

  # Also handle cases with template literals
  sed -i '' "s/clientLogger\.error(\`\([^\`]*\)\`, \(error\|err\|e\))/clientLogger.error(\`\1\`, errorToLogMeta(\2))/g" "$file"
done

echo "LogMeta fixes complete!"