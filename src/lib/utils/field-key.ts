import { PrismaClient } from '@prisma/client';

/**
 * Generate a stable camelCase key from a field label
 * @param label The human-readable field label
 * @param prisma Prisma client instance for checking uniqueness
 * @returns A unique camelCase key suitable for use as a JSON property name
 */
export async function generateFieldKey(label: string, prisma: PrismaClient): Promise<string> {
  // Split on spaces, hyphens, slashes, dots, apostrophes, and parentheses
  const words = label.split(/[\s\-\/\.\'\(\)]+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return await ensureUniqueFieldKey('field', prisma);
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
  const baseKey = (!result || !/^[a-z]/i.test(result)) ? 'field' + result : result;

  // Ensure uniqueness
  return await ensureUniqueFieldKey(baseKey, prisma);
}

/**
 * Ensure a field key is unique by appending a number if necessary
 * @param baseKey The base field key to check
 * @param prisma Prisma client instance for checking uniqueness
 * @returns A unique field key
 */
async function ensureUniqueFieldKey(baseKey: string, prisma: PrismaClient): Promise<string> {
  let fieldKey = baseKey;
  let keyCounter = 2;

  // Check for existing fieldKey and append number if necessary
  while (await prisma.dSXRequirement.findFirst({ where: { fieldKey } })) {
    fieldKey = `${baseKey}${keyCounter}`;
    keyCounter++;
  }

  return fieldKey;
}