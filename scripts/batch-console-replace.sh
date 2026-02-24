#!/bin/bash

# Batch replace console statements with Winston logger
# This script processes API routes efficiently

API_DIR="/Users/andyhellman/Library/CloudStorage/Dropbox/9-REALi Data Solutions/GlobalRx_v2/src/app/api"
PROCESSED_COUNT=0
TOTAL_CHANGES=0

echo "Starting batch console statement replacement..."

# Find all TypeScript files with console statements in API directory
FILES=$(find "$API_DIR" -name "route.ts" -type f -exec grep -l "console\." {} \;)

for file in $FILES; do
    echo "Processing: $file"

    # Count console statements before
    BEFORE_COUNT=$(grep -c "console\." "$file" 2>/dev/null || echo 0)

    # Add import if not present
    if ! grep -q "import logger" "$file"; then
        if grep -q "from '@/lib/auth'" "$file"; then
            sed -i.bak "/from '@\/lib\/auth'/a\\
import logger, { logDatabaseError } from '@/lib/logger';" "$file"
        fi
    fi

    # Replace common console patterns
    sed -i.bak \
        -e "s/console\.log('Development mode - bypassing permission check')/logger.debug('Development mode - bypassing permission check')/g" \
        -e "s/console\.log(\([\"']\)\([^\"']*\)\1)/logger.info(\1\2\1)/g" \
        -e "s/console\.error(\([\"']\)Database error[^\"']*\1, \([^)]*\))/logDatabaseError('database_operation', \2 as Error, session?.user?.id)/g" \
        -e "s/console\.error(\([\"']\)Error[^\"']*\1, \([^)]*\))/logger.error('Operation failed', { error: \2 instanceof Error ? \2.message : 'Unknown error' })/g" \
        -e "s/console\.error(\([\"']\)\([^\"']*\)\1)/logger.error(\1\2\1)/g" \
        -e "s/console\.warn(\([\"']\)\([^\"']*\)\1)/logger.warn(\1\2\1)/g" \
        "$file"

    # Handle template literals (basic cases)
    sed -i.bak \
        -e "s/console\.log(\`\([^}]*\)\${[^}]*}\([^}]*\)\`)/logger.info('\1', { metadata: 'structured_data' })/g" \
        "$file"

    # Count console statements after
    AFTER_COUNT=$(grep -c "console\." "$file" 2>/dev/null || echo 0)

    CHANGES=$((BEFORE_COUNT - AFTER_COUNT))
    if [ $CHANGES -gt 0 ]; then
        echo "  Replaced $CHANGES console statements"
        PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
        TOTAL_CHANGES=$((TOTAL_CHANGES + CHANGES))
        rm "${file}.bak"  # Remove backup file if successful
    else
        mv "${file}.bak" "$file"  # Restore original if no changes
    fi
done

echo ""
echo "=== BATCH REPLACEMENT SUMMARY ==="
echo "Files processed: $PROCESSED_COUNT"
echo "Total console statements replaced: $TOTAL_CHANGES"

# Show remaining files with console statements
REMAINING=$(find "$API_DIR" -name "route.ts" -type f -exec grep -l "console\." {} \; | wc -l)
echo "Files with console statements remaining: $REMAINING"