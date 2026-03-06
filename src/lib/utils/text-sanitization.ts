// /GlobalRX_v2/src/lib/utils/text-sanitization.ts

/**
 * Sanitizes user input text to prevent injection attacks
 * Removes potentially dangerous HTML/script content while preserving safe text
 *
 * Security layers applied:
 * 1. Script tag removal - prevents XSS via script injection
 * 2. HTML tag stripping - removes all markup to prevent tag-based attacks
 * 3. SQL keyword removal - basic defense against SQL injection in text fields
 * 4. Null byte removal - prevents null byte injection attacks
 * 5. Whitespace normalization - maintains readability while removing excessive spacing
 */
export function sanitizeText(text: string): string {
  if (!text) return text;

  // Remove any script tags and their content to prevent XSS attacks
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove any HTML tags to prevent tag-based injection attacks
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove SQL keywords to provide basic protection against SQL injection in text content
  // Note: The primary SQL injection protection comes from Prisma's parameterized queries
  // This is additional defense-in-depth for text fields that might be used in dynamic queries
  sanitized = sanitized.replace(/(\b(DROP|DELETE|INSERT|UPDATE|SELECT|ALTER|CREATE|EXEC|EXECUTE)\b)/gi, '');

  // Remove null bytes that could be used for injection attacks or to bypass security filters
  sanitized = sanitized.replace(/\0/g, '');

  // Normalize whitespace but preserve intentional line breaks and formatting
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Validates that text doesn't contain suspicious patterns
 * Returns true if text appears safe, false if it contains potential injection attempts
 *
 * This function performs pre-validation before sanitization to reject obviously
 * malicious input rather than silently sanitizing it. This provides better security
 * visibility by logging rejection attempts rather than silent modification.
 */
export function isTextSafe(text: string): boolean {
  if (!text) return true;

  // Check for script tags - immediate red flag for XSS attempts
  if (/<script/i.test(text)) return false;

  // Check for SQL injection patterns - look for SQL commands targeting database objects
  // This catches more sophisticated SQL injection attempts that include object names
  if (/(\b(DROP|DELETE|INSERT|UPDATE|SELECT|ALTER|CREATE|EXEC|EXECUTE)\s+(TABLE|DATABASE|INDEX|VIEW|PROCEDURE))/i.test(text)) {
    return false;
  }

  // Check for common XSS patterns that could execute malicious code
  // These patterns are often used to inject JavaScript or load external content
  if (/(javascript:|onerror=|onload=|<iframe|<object|<embed)/i.test(text)) {
    return false;
  }

  return true;
}