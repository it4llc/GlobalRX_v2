// /GlobalRX_v2/src/translations/__tests__/task-8.4-record-search-translation-keys.test.ts
// Pass 1 schema/value tests for Task 8.4 — Record Search Requirements
// (Split from Address History).
// Plan: docs/plans/task-8.4-record-search-requirements-technical-plan.md
//
// These tests verify the FOUR new translation keys introduced by Task 8.4:
//   - candidate.portal.sections.recordSearchRequirements
//   - candidate.recordSearch.heading
//   - candidate.recordSearch.intro
//   - candidate.recordSearch.noFieldsRequired
//
// All four keys must exist in all 5 supported languages (en-US, en-GB,
// es-ES, es, ja-JP) per the technical plan §9 "Translation Keys".
//
// The en-US values must match the plan's verbatim table values. Other
// locales may use the en-US text as a temporary placeholder per the plan
// (the localization team revises later) — so these tests only assert the
// en-US verbatim values and ensure each locale carries a non-empty string.
//
// These tests will FAIL on first run (RED phase of TDD) because the
// translation files don't yet contain the keys. The implementer adds them.

import { describe, it, expect } from 'vitest';

import enUSTranslations from '../en-US.json';
import enGBTranslations from '../en-GB.json';
import esESTranslations from '../es-ES.json';
import esTranslations from '../es.json';
import jaJPTranslations from '../ja-JP.json';

// The four new translation keys, per plan §9.
const SIDEBAR_TITLE_KEY = 'candidate.portal.sections.recordSearchRequirements';
const HEADING_KEY = 'candidate.recordSearch.heading';
const INTRO_KEY = 'candidate.recordSearch.intro';
const NO_FIELDS_REQUIRED_KEY = 'candidate.recordSearch.noFieldsRequired';

// Plan §9: en-US verbatim values.
const EXPECTED_EN_US = {
  [SIDEBAR_TITLE_KEY]: 'Record Search Requirements',
  [HEADING_KEY]: 'Additional information needed for your records search',
  [INTRO_KEY]: 'Based on the countries in your address history, please provide the information below.',
  [NO_FIELDS_REQUIRED_KEY]: 'No additional information is required for the records search.',
};

const ALL_TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-US': enUSTranslations as unknown as Record<string, string>,
  'en-GB': enGBTranslations as unknown as Record<string, string>,
  'es-ES': esESTranslations as unknown as Record<string, string>,
  es: esTranslations as unknown as Record<string, string>,
  'ja-JP': jaJPTranslations as unknown as Record<string, string>,
};

const ALL_KEYS = [SIDEBAR_TITLE_KEY, HEADING_KEY, INTRO_KEY, NO_FIELDS_REQUIRED_KEY];

describe('Task 8.4 — Record Search translation keys', () => {

  describe('all 4 keys exist in all 5 languages', () => {
    // Plan §9: "All four keys must exist in all five locale files".
    for (const key of ALL_KEYS) {
      describe(`${key}`, () => {
        it.each(Object.keys(ALL_TRANSLATIONS))(
          'exists in %s',
          (locale) => {
            const translations = ALL_TRANSLATIONS[locale];
            expect(
              Object.prototype.hasOwnProperty.call(translations, key),
              `${key} missing from ${locale}`,
            ).toBe(true);
            expect(typeof translations[key]).toBe('string');
            expect(translations[key].trim().length).toBeGreaterThan(0);
          },
        );
      });
    }
  });

  describe('en-US values match the plan §9 table verbatim', () => {
    it('candidate.portal.sections.recordSearchRequirements en-US value matches the plan', () => {
      expect(enUSTranslations).toHaveProperty(
        SIDEBAR_TITLE_KEY,
        EXPECTED_EN_US[SIDEBAR_TITLE_KEY],
      );
    });

    it('candidate.recordSearch.heading en-US value matches the plan', () => {
      expect(enUSTranslations).toHaveProperty(
        HEADING_KEY,
        EXPECTED_EN_US[HEADING_KEY],
      );
    });

    it('candidate.recordSearch.intro en-US value matches the plan', () => {
      expect(enUSTranslations).toHaveProperty(
        INTRO_KEY,
        EXPECTED_EN_US[INTRO_KEY],
      );
    });

    it('candidate.recordSearch.noFieldsRequired en-US value matches the plan', () => {
      expect(enUSTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_EN_US[NO_FIELDS_REQUIRED_KEY],
      );
    });
  });

  describe('every locale has non-empty string values for the new keys', () => {
    for (const key of ALL_KEYS) {
      it(`every locale has a non-empty value for ${key}`, () => {
        for (const [locale, translations] of Object.entries(ALL_TRANSLATIONS)) {
          const value = translations[key];
          expect(typeof value, `${key} type in ${locale}`).toBe('string');
          expect(value.trim().length, `${key} length in ${locale}`).toBeGreaterThan(0);
        }
      });
    }
  });
});
