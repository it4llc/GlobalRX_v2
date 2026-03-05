const { normalizePermissions } = require('./src/lib/permission-utils.ts');

// Test with array format (what UserForm saves)
const arrayPermissions = {
  comment_management: ['*']
};

console.log('Array format input:', JSON.stringify(arrayPermissions));
console.log('Normalized output:', JSON.stringify(normalizePermissions(arrayPermissions)));
console.log('');

// Test what gets normalized
const normalized = normalizePermissions(arrayPermissions);
console.log('Has comment_management property:', 'comment_management' in normalized);
console.log('comment_management value:', normalized.comment_management);
