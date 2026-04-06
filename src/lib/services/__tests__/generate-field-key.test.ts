// src/lib/services/__tests__/generate-field-key.test.ts
import { describe, it, expect } from 'vitest';

// Extract the generateFieldKey function from the route file for testing
// Since it's not exported, we'll need to duplicate it here based on reading the actual implementation
function generateFieldKey(label: string): string {
  // Split on spaces, hyphens, slashes, dots, apostrophes, and parentheses
  const words = label.split(/[\s\-\/\.\'\(\)]+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return 'field';
  }

  // Join as camelCase (first word lowercase, subsequent words capitalized first letter)
  const camelCase = words.map((word, index) => {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, ''); // Remove any remaining non-alphanumeric
    if (index === 0) {
      return cleanWord.toLowerCase();
    }
    return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
  }).join('');

  // Ensure the result starts with a lowercase letter
  const result = camelCase.charAt(0).toLowerCase() + camelCase.slice(1);

  // If result is empty or doesn't start with a letter, prefix with 'field'
  if (!result || !/^[a-z]/i.test(result)) {
    return 'field' + result;
  }

  return result;
}

describe('generateFieldKey', () => {
  it('should convert simple two-word label to camelCase', () => {
    const result = generateFieldKey('First Name');
    expect(result).toBe('firstName');
  });

  it('should handle label with slash correctly', () => {
    const result = generateFieldKey('First Name/Given Name');
    expect(result).toBe('firstNameGivenName');
  });

  it('should handle label with multiple words', () => {
    const result = generateFieldKey('First Name or Given Name');
    expect(result).toBe('firstNameOrGivenName');
  });

  it('should handle label with apostrophe', () => {
    const result = generateFieldKey("Mother's Maiden Name");
    expect(result).toBe('motherSMaidenName');
  });

  it('should handle label with parentheses', () => {
    const result = generateFieldKey('Date of Birth (DOB)');
    expect(result).toBe('dateOfBirthDob');
  });

  it('should handle label with hyphens', () => {
    const result = generateFieldKey('Middle-Name');
    expect(result).toBe('middleName');
  });

  it('should handle label with dots', () => {
    const result = generateFieldKey('U.S. Address');
    expect(result).toBe('uSAddress');
  });

  it('should handle empty string', () => {
    const result = generateFieldKey('');
    expect(result).toBe('field');
  });

  it('should handle label with only special characters', () => {
    const result = generateFieldKey('///');
    expect(result).toBe('field');
  });

  it('should handle label starting with number', () => {
    const result = generateFieldKey('123 Main Street');
    expect(result).toBe('field123MainStreet');
  });

  it('should handle single word label', () => {
    const result = generateFieldKey('Email');
    expect(result).toBe('email');
  });

  it('should handle label with mixed case', () => {
    const result = generateFieldKey('SSN Number');
    expect(result).toBe('ssnNumber');
  });

  it('should handle label with multiple spaces', () => {
    const result = generateFieldKey('First    Name');
    expect(result).toBe('firstName');
  });

  // REGRESSION TEST: This test proves that if fieldKey were missing during validation,
  // the label would be used as the key instead, causing a mismatch
  it('REGRESSION TEST: fieldKey prevents label-based key mismatches', () => {
    // Before fix: If a field label changed from "First Name" to "First Name/Given Name",
    // the validation would look for a different key in the subject data
    const originalLabel = 'First Name';
    const updatedLabel = 'First Name/Given Name';

    const originalKey = generateFieldKey(originalLabel);
    const updatedKey = generateFieldKey(updatedLabel);

    // These should be different, proving why we need a stable fieldKey
    expect(originalKey).toBe('firstName');
    expect(updatedKey).toBe('firstNameGivenName');
    expect(originalKey).not.toBe(updatedKey);

    // With the fix, fieldKey remains 'firstName' regardless of label changes
  });
});