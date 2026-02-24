#!/usr/bin/env node

/**
 * Script to replace console statements with Winston logger in API routes
 * This script processes all API route files and replaces:
 * - console.log with logger.info/logger.debug
 * - console.error with logger.error
 * - console.warn with logger.warn
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns for replacement
const replacements = [
  {
    // Import statement replacement
    pattern: /(import.*from\s+['"]@\/lib\/auth['"];?)\s*$/m,
    replacement: "$1\nimport logger, { logDatabaseError } from '@/lib/logger';"
  },
  {
    // console.log with template literals containing sensitive data
    pattern: /console\.log\(`([^`]+)`\);?/g,
    replacement: (match, message) => {
      // Simple heuristic to determine if it's debug or info level
      if (message.includes('Fetching') || message.includes('Found') || message.includes('Retrieved')) {
        return `logger.debug('${message.split('${')[0].trim()}');`;
      }
      return `logger.info('${message.split('${')[0].trim()}');`;
    }
  },
  {
    // console.log with string literals
    pattern: /console\.log\(['"]([^'"]+)['"]\);?/g,
    replacement: "logger.info('$1');"
  },
  {
    // console.log with objects
    pattern: /console\.log\(['"]([^'"]+)['"], ([^)]+)\);?/g,
    replacement: "logger.info('$1', { data: $2 });"
  },
  {
    // console.error in catch blocks for database errors
    pattern: /console\.error\(['"]Database error[^'"]*['"], ([^)]+)\);?/g,
    replacement: "logDatabaseError('database_operation', $1 as Error, session?.user?.id);"
  },
  {
    // console.error in catch blocks
    pattern: /console\.error\(['"]Error[^'"]*['"], ([^)]+)\);?/g,
    replacement: "logger.error('Operation failed', { error: $1 instanceof Error ? $1.message : 'Unknown error' });"
  },
  {
    // console.error with message
    pattern: /console\.error\(['"]([^'"]+)['"], ([^)]+)\);?/g,
    replacement: "logger.error('$1', { error: $2 instanceof Error ? $2.message : 'Unknown error' });"
  },
  {
    // console.warn
    pattern: /console\.warn\(['"]([^'"]+)['"]([^)]*)\);?/g,
    replacement: "logger.warn('$1'$2);"
  },
  {
    // Development mode bypassing
    pattern: /console\.log\(["']Development mode - bypassing permission check["']\);?/g,
    replacement: "logger.debug('Development mode - bypassing permission check');"
  }
];

// Function to process a single file
function processFile(filePath) {
  console.log(`Processing ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let hasImport = content.includes("import logger");
  let changesMade = false;

  // Check if file has console statements
  if (!content.includes('console.')) {
    return { processed: false, changes: 0 };
  }

  // Add import if not already present
  if (!hasImport) {
    const importMatch = content.match(/(import.*from\s+['"]@\/lib\/auth['"];?\n)/);
    if (importMatch) {
      content = content.replace(
        importMatch[1],
        importMatch[1] + "import logger, { logDatabaseError } from '@/lib/logger';\n"
      );
      changesMade = true;
    }
  }

  // Apply replacements
  let consoleCounts = {
    log: (content.match(/console\.log/g) || []).length,
    error: (content.match(/console\.error/g) || []).length,
    warn: (content.match(/console\.warn/g) || []).length
  };

  // Simple replacements for common patterns
  content = content
    // Development mode
    .replace(/console\.log\(["']Development mode - bypassing permission check["']\)/g,
             "logger.debug('Development mode - bypassing permission check')")
    // Template literal patterns
    .replace(/console\.log\(`([^`]*\$\{[^}]+\}[^`]*)`\)/g,
             (match, template) => {
               const message = template.split('${')[0].trim();
               return `logger.info('${message}', { /* structured data */ })`;
             })
    // Simple string patterns
    .replace(/console\.log\(['"]([^'"]+)['"]\)/g, "logger.info('$1')")
    .replace(/console\.error\(['"]([^'"]+)['"]\)/g, "logger.error('$1')")
    .replace(/console\.warn\(['"]([^'"]+)['"]\)/g, "logger.warn('$1')")
    // Database error patterns
    .replace(/console\.error\(['"]Database error[^'"]*['"], ([^)]+)\)/g,
             "logDatabaseError('database_operation', $1 as Error, session?.user?.id)")
    .replace(/console\.error\(['"]Error[^'"]*['"], ([^)]+)\)/g,
             "logger.error('Operation failed', { error: $1 instanceof Error ? $1.message : 'Unknown error' })");

  if (content !== originalContent) {
    changesMade = true;
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return {
    processed: changesMade,
    changes: consoleCounts.log + consoleCounts.error + consoleCounts.warn,
    consoleCounts
  };
}

// Main execution
function main() {
  const apiDir = '/Users/andyhellman/Library/CloudStorage/Dropbox/9-REALi Data Solutions/GlobalRx_v2/src/app/api';

  // Find all API route files
  const pattern = path.join(apiDir, '**/route.ts');
  const files = glob.sync(pattern);

  console.log(`Found ${files.length} API route files`);

  let totalProcessed = 0;
  let totalChanges = 0;
  const results = [];

  files.forEach(file => {
    const result = processFile(file);
    if (result.processed) {
      totalProcessed++;
      totalChanges += result.changes;
      results.push({ file: path.relative(apiDir, file), ...result });
    }
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Files processed: ${totalProcessed}`);
  console.log(`Total console statements replaced: ${totalChanges}`);

  if (results.length > 0) {
    console.log('\nDetailed results:');
    results.forEach(r => {
      console.log(`  ${r.file}: ${r.changes} console statements`);
    });
  }
}

// Check if running as script
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Script failed:', error.message);
    process.exit(1);
  }
}