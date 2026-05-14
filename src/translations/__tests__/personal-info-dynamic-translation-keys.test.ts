// /GlobalRX_v2/src/translations/__tests__/personal-info-dynamic-translation-keys.test.ts
// Pass 1 schema/value tests for Task 8.3 — Personal Info 100% Dynamic.
// Spec: docs/specs/personal-info-dynamic.md
// Plan: docs/plans/personal-info-dynamic-technical-plan.md
//
// These tests verify the two translation keys whose VALUES change as part
// of Task 8.3:
//   - candidate.portal.personalInfo.noFieldsRequired
//   - candidate.portal.personalInfo.instructions
//
// Both keys must exist in all 5 supported languages (en-US, en-GB, es-ES,
// es, ja-JP) per Definition of Done item 10. The en-US / en-GB value of
// noFieldsRequired must match the spec's verbatim wording. The technical
// plan supplies the localized values for the other three languages.
//
// These tests will FAIL on first run (RED phase of TDD) because the
// current translation files still hold the pre-Task-8.3 values. The
// implementer updates the JSON values and these tests go green.

import { describe, it, expect } from 'vitest';

import enUSTranslations from '../en-US.json';
import enGBTranslations from '../en-GB.json';
import esESTranslations from '../es-ES.json';
import esTranslations from '../es.json';
import jaJPTranslations from '../ja-JP.json';

const NO_FIELDS_REQUIRED_KEY = 'candidate.portal.personalInfo.noFieldsRequired';
const INSTRUCTIONS_KEY = 'candidate.portal.personalInfo.instructions';

// Per the technical plan Section "Translation Keys" — verbatim values.
const EXPECTED_NO_FIELDS_REQUIRED = {
  'en-US': 'No additional information is required.',
  'en-GB': 'No additional information is required.',
  'es-ES': 'No se requiere información adicional.',
  es: 'No se requiere información adicional.',
  'ja-JP': '追加の情報は必要ありません。',
};

const EXPECTED_INSTRUCTIONS = {
  'en-US':
    'Please fill in the information below. Fields marked with a red asterisk (*) are required.',
  'en-GB':
    'Please fill in the information below. Fields marked with a red asterisk (*) are required.',
  'es-ES':
    'Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios.',
  es: 'Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios.',
  'ja-JP':
    '以下の情報をご記入ください。赤いアスタリスク（*）でマークされたフィールドは必須です。',
};

const ALL_TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-US': enUSTranslations as unknown as Record<string, string>,
  'en-GB': enGBTranslations as unknown as Record<string, string>,
  'es-ES': esESTranslations as unknown as Record<string, string>,
  es: esTranslations as unknown as Record<string, string>,
  'ja-JP': jaJPTranslations as unknown as Record<string, string>,
};

describe('Task 8.3 — Personal Info translation key values', () => {

  describe('candidate.portal.personalInfo.noFieldsRequired exists in all 5 languages', () => {
    // Spec Definition of Done item 10.
    it.each(Object.keys(ALL_TRANSLATIONS))(
      'noFieldsRequired exists in %s',
      (locale) => {
        const translations = ALL_TRANSLATIONS[locale];
        expect(Object.prototype.hasOwnProperty.call(translations, NO_FIELDS_REQUIRED_KEY)).toBe(true);
        expect(typeof translations[NO_FIELDS_REQUIRED_KEY]).toBe('string');
        expect(translations[NO_FIELDS_REQUIRED_KEY].trim().length).toBeGreaterThan(0);
      }
    );
  });

  describe('candidate.portal.personalInfo.instructions exists in all 5 languages', () => {
    // Plan Section "Translation Keys" updates this value but does not add a
    // new key; ensure it remains present after the change.
    it.each(Object.keys(ALL_TRANSLATIONS))(
      'instructions exists in %s',
      (locale) => {
        const translations = ALL_TRANSLATIONS[locale];
        expect(Object.prototype.hasOwnProperty.call(translations, INSTRUCTIONS_KEY)).toBe(true);
        expect(typeof translations[INSTRUCTIONS_KEY]).toBe('string');
        expect(translations[INSTRUCTIONS_KEY].trim().length).toBeGreaterThan(0);
      }
    );
  });

  describe('noFieldsRequired values match the spec/plan verbatim', () => {
    // Spec Data Requirements table specifies the en-US value verbatim:
    // "No additional information is required."
    // The technical plan extends this to all 5 languages.

    it('en-US value matches the spec', () => {
      expect(enUSTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_NO_FIELDS_REQUIRED['en-US']
      );
    });

    it('en-GB value matches the plan', () => {
      expect(enGBTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_NO_FIELDS_REQUIRED['en-GB']
      );
    });

    it('es-ES value matches the plan', () => {
      expect(esESTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_NO_FIELDS_REQUIRED['es-ES']
      );
    });

    it('es value matches the plan', () => {
      expect(esTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_NO_FIELDS_REQUIRED['es']
      );
    });

    it('ja-JP value matches the plan', () => {
      expect(jaJPTranslations).toHaveProperty(
        NO_FIELDS_REQUIRED_KEY,
        EXPECTED_NO_FIELDS_REQUIRED['ja-JP']
      );
    });
  });

  describe('instructions values match the plan verbatim', () => {
    it('en-US instructions value matches the plan', () => {
      expect(enUSTranslations).toHaveProperty(
        INSTRUCTIONS_KEY,
        EXPECTED_INSTRUCTIONS['en-US']
      );
    });

    it('en-GB instructions value matches the plan', () => {
      expect(enGBTranslations).toHaveProperty(
        INSTRUCTIONS_KEY,
        EXPECTED_INSTRUCTIONS['en-GB']
      );
    });

    it('es-ES instructions value matches the plan', () => {
      expect(esESTranslations).toHaveProperty(
        INSTRUCTIONS_KEY,
        EXPECTED_INSTRUCTIONS['es-ES']
      );
    });

    it('es instructions value matches the plan', () => {
      expect(esTranslations).toHaveProperty(
        INSTRUCTIONS_KEY,
        EXPECTED_INSTRUCTIONS['es']
      );
    });

    it('ja-JP instructions value matches the plan', () => {
      expect(jaJPTranslations).toHaveProperty(
        INSTRUCTIONS_KEY,
        EXPECTED_INSTRUCTIONS['ja-JP']
      );
    });
  });

  describe('instructions no longer mentions invitation prefill in any language', () => {
    // Spec Business Rule 1: the locked invitation fields are deleted from
    // Personal Info. The pre-Task-8.3 instructions value mentioned
    // "Information from your invitation is already filled in and cannot be
    // changed." That sentence must be removed from every language so it
    // does not display alongside dynamic-only fields.

    it('en-US instructions does not mention "information from your invitation"', () => {
      const instructions = (enUSTranslations as Record<string, string>)[INSTRUCTIONS_KEY];
      expect(instructions.toLowerCase()).not.toContain('information from your invitation');
      expect(instructions.toLowerCase()).not.toContain(
        'already filled in and cannot be changed'
      );
    });

    it('en-GB instructions does not mention "information from your invitation"', () => {
      const instructions = (enGBTranslations as Record<string, string>)[INSTRUCTIONS_KEY];
      expect(instructions.toLowerCase()).not.toContain('information from your invitation');
      expect(instructions.toLowerCase()).not.toContain(
        'already filled in and cannot be changed'
      );
    });

    it('es-ES instructions does not mention "información de su invitación"', () => {
      const instructions = (esESTranslations as Record<string, string>)[INSTRUCTIONS_KEY];
      // The original ES sentence: "La información de su invitación ya está
      // completada y no se puede cambiar."
      expect(instructions.toLowerCase()).not.toContain('información de su invitación');
      expect(instructions.toLowerCase()).not.toContain('ya está completada');
    });

    it('es instructions does not mention "información de su invitación"', () => {
      const instructions = (esTranslations as Record<string, string>)[INSTRUCTIONS_KEY];
      expect(instructions.toLowerCase()).not.toContain('información de su invitación');
      expect(instructions.toLowerCase()).not.toContain('ya está completada');
    });

    it('ja-JP instructions does not mention 招待状からの情報', () => {
      const instructions = (jaJPTranslations as Record<string, string>)[INSTRUCTIONS_KEY];
      // The original JA sentence contained 招待状からの情報 ("information
      // from the invitation"). It must be removed.
      expect(instructions).not.toContain('招待状からの情報');
      expect(instructions).not.toContain('変更することはできません');
    });
  });

  describe('translation values are non-empty strings', () => {
    it('every locale has a non-empty noFieldsRequired value', () => {
      for (const [locale, translations] of Object.entries(ALL_TRANSLATIONS)) {
        const value = translations[NO_FIELDS_REQUIRED_KEY];
        expect(typeof value, `noFieldsRequired type in ${locale}`).toBe('string');
        expect(value.trim().length, `noFieldsRequired length in ${locale}`).toBeGreaterThan(0);
      }
    });

    it('every locale has a non-empty instructions value', () => {
      for (const [locale, translations] of Object.entries(ALL_TRANSLATIONS)) {
        const value = translations[INSTRUCTIONS_KEY];
        expect(typeof value, `instructions type in ${locale}`).toBe('string');
        expect(value.trim().length, `instructions length in ${locale}`).toBeGreaterThan(0);
      }
    });
  });
});
