// /GlobalRX_v2/src/lib/templates/__tests__/replaceTemplateVariables.test.ts

import { describe, it, expect } from 'vitest';
import { replaceTemplateVariables } from '@/lib/templates/replaceTemplateVariables';

/**
 * Pass 1 unit tests for the shared template variable replacement function.
 *
 * Source of truth for these expectations:
 * - docs/specs/template-variable-system.md Business Rules, Supported Variables table,
 *   Edge Cases and Error Scenarios table, Definition of Done items 1–4, 7, 10, 11.
 * - docs/plans/template-variable-system-plan.md New Files to Create #2 (replaceTemplateVariables.ts)
 *
 * These tests will fail-on-import until the implementer creates
 * /src/lib/templates/replaceTemplateVariables.ts — this is the correct TDD behavior
 * for Pass 1.
 */

describe('replaceTemplateVariables', () => {
  describe('recognized variables are replaced with their values', () => {
    it('replaces {{candidateFirstName}} with the supplied first name', () => {
      const result = replaceTemplateVariables('Hi {{candidateFirstName}}', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('Hi Sarah');
    });

    it('replaces {{candidateLastName}} with the supplied last name', () => {
      const result = replaceTemplateVariables('Last name: {{candidateLastName}}', {
        candidateLastName: 'Connor',
      });
      expect(result).toBe('Last name: Connor');
    });

    it('replaces {{candidateEmail}} with the supplied email', () => {
      const result = replaceTemplateVariables('Email: {{candidateEmail}}', {
        candidateEmail: 'sarah@example.com',
      });
      expect(result).toBe('Email: sarah@example.com');
    });

    it('replaces {{candidatePhone}} with the supplied phone', () => {
      const result = replaceTemplateVariables('Phone: {{candidatePhone}}', {
        candidatePhone: '+1 5551234567',
      });
      expect(result).toBe('Phone: +1 5551234567');
    });

    it('replaces {{companyName}} with the supplied company name', () => {
      const result = replaceTemplateVariables('Welcome to {{companyName}}', {
        companyName: 'Acme Corp',
      });
      expect(result).toBe('Welcome to Acme Corp');
    });

    it('replaces {{expirationDate}} with the supplied expiration date string', () => {
      const result = replaceTemplateVariables('Expires {{expirationDate}}', {
        expirationDate: '15 Jan 2026',
      });
      expect(result).toBe('Expires 15 Jan 2026');
    });

    it('replaces multiple different recognized variables in the same content', () => {
      const result = replaceTemplateVariables(
        'Hi {{candidateFirstName}} {{candidateLastName}}, welcome to {{companyName}}.',
        {
          candidateFirstName: 'Sarah',
          candidateLastName: 'Connor',
          companyName: 'Acme Corp',
        }
      );
      expect(result).toBe('Hi Sarah Connor, welcome to Acme Corp.');
    });

    it('replaces all occurrences when the same variable appears multiple times', () => {
      // Spec Edge Cases row: "Same variable used multiple times in one section → All occurrences are replaced"
      const result = replaceTemplateVariables(
        '{{candidateFirstName}}, hello {{candidateFirstName}}! Goodbye {{candidateFirstName}}.',
        { candidateFirstName: 'Sarah' }
      );
      expect(result).toBe('Sarah, hello Sarah! Goodbye Sarah.');
    });
  });

  describe('recognized variables with missing values are replaced with blank', () => {
    // Spec Business Rule 3: "If a variable has no value ... the system displays nothing (a blank)
    // — it must never show the raw {{variableName}} text to the candidate"
    // Spec Definition of Done item 4: "Variables with no value are replaced with blank"

    it('replaces with empty string when the value is undefined (not supplied in values object)', () => {
      const result = replaceTemplateVariables('Phone: {{candidatePhone}}', {});
      expect(result).toBe('Phone: ');
    });

    it('replaces with empty string when the value is explicitly undefined', () => {
      const result = replaceTemplateVariables('Phone: {{candidatePhone}}', {
        candidatePhone: undefined,
      });
      expect(result).toBe('Phone: ');
    });

    it('replaces with empty string when the value is null', () => {
      const result = replaceTemplateVariables('Phone: {{candidatePhone}}', {
        candidatePhone: null,
      });
      expect(result).toBe('Phone: ');
    });

    it('replaces with empty string when the value is the empty string', () => {
      const result = replaceTemplateVariables('Phone: {{candidatePhone}}', {
        candidatePhone: '',
      });
      expect(result).toBe('Phone: ');
    });

    it('never leaves the raw {{variableName}} text visible when the value is missing', () => {
      // Definition of Done item 10
      const result = replaceTemplateVariables(
        'Hi {{candidateFirstName}}',
        { candidateFirstName: null }
      );
      expect(result).not.toContain('{{candidateFirstName}}');
      expect(result).not.toContain('candidateFirstName');
    });
  });

  describe('unrecognized variables are replaced with blank', () => {
    // Spec Business Rule 4 and Edge Cases row 2:
    // "Any text that looks like a variable but isn't a recognized variable name is also replaced with blank"
    // Spec Definition of Done item 3.

    it('replaces an unknown variable name with empty string', () => {
      const result = replaceTemplateVariables('Hello {{someRandomThing}}', {});
      expect(result).toBe('Hello ');
    });

    it('replaces a typo variable name with empty string (admin protection)', () => {
      // Spec Edge Cases row 7: typo like {{candidatFirstName}} missing the 'e'
      const result = replaceTemplateVariables('Hi {{candidatFirstName}}', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('Hi ');
    });

    it('does not leave raw {{...}} text visible for an unrecognized variable', () => {
      const result = replaceTemplateVariables('Hello {{notAVariable}} there', {});
      expect(result).not.toContain('{{notAVariable}}');
      expect(result).not.toContain('notAVariable');
    });

    it('still replaces recognized variables in the same content even when an unrecognized one is also present', () => {
      const result = replaceTemplateVariables(
        'Hi {{candidateFirstName}}, {{unknownVar}} please review.',
        { candidateFirstName: 'Sarah' }
      );
      expect(result).toBe('Hi Sarah,  please review.');
    });

    it('does not promote a value supplied under an unknown key into the output', () => {
      // If the caller passes a value under a name that is NOT in the registry, the function
      // must not accidentally use it. The registry is the source of truth.
      const result = replaceTemplateVariables('Hi {{someRandomThing}}', {
        // @ts-expect-error — intentionally passing an extra key the type does not allow
        someRandomThing: 'should not appear',
      });
      expect(result).toBe('Hi ');
      expect(result).not.toContain('should not appear');
    });
  });

  describe('malformed syntax is left untouched', () => {
    // Spec Edge Cases row 3: "Malformed syntax (e.g., {{candidateFirstName} with only one
    // closing brace) → Leave as-is — the pattern only matches proper {{...}} syntax,
    // so partial syntax is treated as regular text and goes through normal sanitization"

    it('leaves {{name} (single closing brace) unchanged', () => {
      const result = replaceTemplateVariables('Hi {{candidateFirstName}', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('Hi {{candidateFirstName}');
    });

    it('leaves {name}} (single opening brace) unchanged', () => {
      const result = replaceTemplateVariables('Hi {candidateFirstName}}', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('Hi {candidateFirstName}}');
    });

    it('leaves a single set of braces {name} unchanged', () => {
      const result = replaceTemplateVariables('Hi {candidateFirstName}', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('Hi {candidateFirstName}');
    });

    it('does not match {{ }} (empty placeholder) as a recognized variable', () => {
      // The regex /\{\{(\w+)\}\}/g requires at least one word character.
      const result = replaceTemplateVariables('Empty: {{}}', {});
      expect(result).toBe('Empty: {{}}');
    });
  });

  describe('content with no variables', () => {
    // Spec Edge Cases row: "Content has no variables at all → No problem —
    // the replacement function finds nothing to replace and returns the content unchanged"

    it('returns plain text content unchanged', () => {
      const result = replaceTemplateVariables('Plain text with no placeholders.', {});
      expect(result).toBe('Plain text with no placeholders.');
    });

    it('returns HTML content unchanged when there are no placeholders', () => {
      const html = '<p>Please review the following:</p><ul><li>Item</li></ul>';
      const result = replaceTemplateVariables(html, {});
      expect(result).toBe(html);
    });
  });

  describe('null / undefined / empty input', () => {
    // Spec Edge Cases row: "Database field for the section content is null or empty →
    // Renderer handles this the same as today — shows nothing"
    // Plan New Files #2 step 1: "If content is null/undefined/empty, return ''"

    it('returns empty string when content is null', () => {
      const result = replaceTemplateVariables(null, { candidateFirstName: 'Sarah' });
      expect(result).toBe('');
    });

    it('returns empty string when content is undefined', () => {
      const result = replaceTemplateVariables(undefined, { candidateFirstName: 'Sarah' });
      expect(result).toBe('');
    });

    it('returns empty string when content is an empty string', () => {
      const result = replaceTemplateVariables('', { candidateFirstName: 'Sarah' });
      expect(result).toBe('');
    });
  });

  describe('values containing HTML / scripts pass through unchanged', () => {
    // Spec Business Rule 2: "Variable replacement happens before the content is cleaned/sanitized
    // for security — this ensures the replaced values go through the same security cleaning
    // as everything else"
    // Spec Edge Cases row: "Variable value contains HTML or script tags → Safe —
    // the replacement happens before DOMPurify sanitization, so any dangerous content
    // in the values gets cleaned out"
    // The replacement function itself MUST NOT escape or strip — that is the caller's job.

    it('inserts an HTML tag from the value into the output verbatim', () => {
      const result = replaceTemplateVariables('Hello {{candidateFirstName}}', {
        candidateFirstName: '<b>Sarah</b>',
      });
      expect(result).toBe('Hello <b>Sarah</b>');
    });

    it('inserts a <script> tag from the value into the output verbatim (sanitization is the caller\'s job)', () => {
      const result = replaceTemplateVariables('Hi {{candidateFirstName}}', {
        candidateFirstName: '<script>alert(1)</script>',
      });
      expect(result).toBe('Hi <script>alert(1)</script>');
    });

    it('does not double-encode angle brackets that appear in the source content', () => {
      const result = replaceTemplateVariables('<p>{{candidateFirstName}}</p>', {
        candidateFirstName: 'Sarah',
      });
      expect(result).toBe('<p>Sarah</p>');
    });
  });

  describe('no code execution: the function is strictly text-in / text-out', () => {
    // Spec Business Rule 7: "Template variables must not allow any kind of code execution —
    // they are simple text replacement only"
    // Spec Definition of Done item 11.

    it('does not evaluate ${...} template-literal-like syntax inside values', () => {
      const result = replaceTemplateVariables('Result: {{candidateFirstName}}', {
        candidateFirstName: '${alert(1)}',
      });
      expect(result).toBe('Result: ${alert(1)}');
    });

    it('does not evaluate ${...} template-literal-like syntax inside content', () => {
      const result = replaceTemplateVariables('Result: ${alert(1)}', {});
      expect(result).toBe('Result: ${alert(1)}');
    });

    it('does not execute or interpret JavaScript expressions inside a variable name', () => {
      // {{1+1}} is not a valid \w+ word, AND even if it were, the registry does not list it.
      const result = replaceTemplateVariables('Math: {{1+1}}', {});
      // Either left as-is (regex did not match) or replaced with empty (regex matched the
      // word portion). Both are acceptable; the critical assertion is that "2" never appears.
      expect(result).not.toContain('2');
      expect(result).not.toContain('alert');
    });
  });

  describe('purity / determinism', () => {
    it('does not mutate the input values object', () => {
      const values = { candidateFirstName: 'Sarah', candidateLastName: 'Connor' };
      const snapshot = { ...values };
      replaceTemplateVariables('Hi {{candidateFirstName}}', values);
      expect(values).toEqual(snapshot);
    });

    it('produces the same output for the same inputs every time', () => {
      const a = replaceTemplateVariables('Hi {{candidateFirstName}}', {
        candidateFirstName: 'Sarah',
      });
      const b = replaceTemplateVariables('Hi {{candidateFirstName}}', {
        candidateFirstName: 'Sarah',
      });
      expect(a).toBe(b);
    });
  });
});
