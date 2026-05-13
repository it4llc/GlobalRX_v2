// /GlobalRX_v2/src/lib/templates/__tests__/variableRegistry.test.ts

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_VARIABLE_REGISTRY,
  TEMPLATE_VARIABLE_NAMES,
  getTemplateVariableNameSet,
} from '@/lib/templates/variableRegistry';

/**
 * Pass 1 unit tests for the template variable registry.
 *
 * Source of truth for these expectations:
 * - docs/specs/template-variable-system.md "Supported Variables (v1)" table
 * - docs/plans/template-variable-system-plan.md New Files to Create #1 (variableRegistry.ts)
 *
 * These tests will fail-on-import until the implementer creates
 * /src/lib/templates/variableRegistry.ts — this is the correct TDD behavior for Pass 1.
 */

describe('Template Variable Registry', () => {
  describe('TEMPLATE_VARIABLE_REGISTRY shape', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(TEMPLATE_VARIABLE_REGISTRY)).toBe(true);
      expect(TEMPLATE_VARIABLE_REGISTRY.length).toBeGreaterThan(0);
    });

    it('should contain exactly the 6 v1 entries (no more, no fewer)', () => {
      expect(TEMPLATE_VARIABLE_REGISTRY.length).toBe(6);
    });

    it('should give every entry the three required fields: name, descriptionKey, category', () => {
      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('descriptionKey');
        expect(entry).toHaveProperty('category');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.descriptionKey).toBe('string');
        expect(typeof entry.category).toBe('string');
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.descriptionKey.length).toBeGreaterThan(0);
        expect(entry.category.length).toBeGreaterThan(0);
      }
    });

    it('should not contain duplicate variable names', () => {
      const names = TEMPLATE_VARIABLE_REGISTRY.map((e) => e.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe('v1 variable names match the spec exactly', () => {
    it('should include candidateFirstName', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'candidateFirstName');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('candidate');
    });

    it('should include candidateLastName', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'candidateLastName');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('candidate');
    });

    it('should include candidateEmail', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'candidateEmail');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('candidate');
    });

    it('should include candidatePhone', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'candidatePhone');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('candidate');
    });

    it('should include companyName', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'companyName');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('company');
    });

    it('should include expirationDate', () => {
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'expirationDate');
      expect(entry).toBeDefined();
      expect(entry?.category).toBe('invitation');
    });

    it('should NOT include any variable name outside the v1 supported list', () => {
      const allowedNames = new Set([
        'candidateFirstName',
        'candidateLastName',
        'candidateEmail',
        'candidatePhone',
        'companyName',
        'expirationDate',
      ]);
      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        expect(allowedNames.has(entry.name)).toBe(true);
      }
    });

    it('should NOT include inviteLink in the v1 workflow-section registry', () => {
      // Spec "Supported Variables (v1)" table does not list inviteLink.
      // Architect plan Risks section item 2 and item 8 explicitly call this out.
      const entry = TEMPLATE_VARIABLE_REGISTRY.find((e) => e.name === 'inviteLink');
      expect(entry).toBeUndefined();
    });
  });

  describe('descriptionKey values point at admin.workflowSection.variable.*.desc translation keys', () => {
    it('should use the agreed translation-key prefix for every entry', () => {
      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        expect(entry.descriptionKey).toMatch(
          /^admin\.workflowSection\.variable\.[a-zA-Z]+\.desc$/
        );
      }
    });

    it('should embed the entry name inside its descriptionKey', () => {
      // Per plan: descriptionKey is admin.workflowSection.variable.<name>.desc
      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        expect(entry.descriptionKey).toBe(
          `admin.workflowSection.variable.${entry.name}.desc`
        );
      }
    });
  });

  describe('category values are constrained to the documented union', () => {
    it('should only use candidate, company, or invitation as category values', () => {
      const allowedCategories = new Set(['candidate', 'company', 'invitation']);
      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        expect(allowedCategories.has(entry.category)).toBe(true);
      }
    });
  });

  describe('TEMPLATE_VARIABLE_NAMES is derived from the registry', () => {
    it('should contain one entry per registry entry, in the same order', () => {
      const namesFromRegistry = TEMPLATE_VARIABLE_REGISTRY.map((e) => e.name);
      expect(TEMPLATE_VARIABLE_NAMES).toEqual(namesFromRegistry);
    });

    it('should contain all six v1 names', () => {
      expect(TEMPLATE_VARIABLE_NAMES).toContain('candidateFirstName');
      expect(TEMPLATE_VARIABLE_NAMES).toContain('candidateLastName');
      expect(TEMPLATE_VARIABLE_NAMES).toContain('candidateEmail');
      expect(TEMPLATE_VARIABLE_NAMES).toContain('candidatePhone');
      expect(TEMPLATE_VARIABLE_NAMES).toContain('companyName');
      expect(TEMPLATE_VARIABLE_NAMES).toContain('expirationDate');
    });
  });

  describe('getTemplateVariableNameSet', () => {
    it('should return a Set containing every v1 variable name', () => {
      const set = getTemplateVariableNameSet();
      expect(set instanceof Set).toBe(true);
      expect(set.has('candidateFirstName')).toBe(true);
      expect(set.has('candidateLastName')).toBe(true);
      expect(set.has('candidateEmail')).toBe(true);
      expect(set.has('candidatePhone')).toBe(true);
      expect(set.has('companyName')).toBe(true);
      expect(set.has('expirationDate')).toBe(true);
      expect(set.size).toBe(6);
    });

    it('should NOT contain unrecognized or future names', () => {
      const set = getTemplateVariableNameSet();
      expect(set.has('inviteLink')).toBe(false);
      expect(set.has('someRandomThing')).toBe(false);
      expect(set.has('')).toBe(false);
    });

    it('should be safe to call multiple times (memoization must return equivalent contents)', () => {
      const first = getTemplateVariableNameSet();
      const second = getTemplateVariableNameSet();
      // Both calls return Sets with the same contents; we do not assert identity
      // because the implementer is free to memoize or not.
      expect(Array.from(first).sort()).toEqual(Array.from(second).sort());
    });
  });
});
