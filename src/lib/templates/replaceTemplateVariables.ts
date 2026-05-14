// /GlobalRX_v2/src/lib/templates/replaceTemplateVariables.ts

/**
 * Shared template-variable replacement function.
 *
 * Replaces {{variableName}} placeholders in a string with values from the
 * supplied `values` object. Used by both:
 *   - `WorkflowSectionRenderer` (called BEFORE DOMPurify sanitization, so a
 *     value that contains HTML or a <script> tag is cleaned by the
 *     downstream sanitizer along with the rest of the merged content; see
 *     spec Business Rule 2 and Definition of Done item 5).
 *   - Future email-send code (no email send call sites exist today — the
 *     candidate-invitation service explicitly defers sending — but this
 *     function is the contract the future code must use, per the spec's
 *     "one set of code so behavior is consistent everywhere" requirement).
 *
 * Behavior summary:
 *   - Recognized variable with a non-empty string value → replaced with the value.
 *   - Recognized variable with null / undefined / empty value → replaced with ''.
 *   - Unrecognized variable name (any {{word}} not in the registry) → replaced with ''.
 *     Spec Business Rule 4: candidates must NEVER see raw {{placeholder}} text.
 *   - Malformed syntax like `{{name}` or `{name}}` does not match the regex
 *     and is left untouched (spec Edge Cases row 3).
 *   - Null / undefined / empty content → returns ''.
 *
 * Security notes (spec Business Rule 7, Definition of Done item 11):
 *   - The function is strictly text-in / text-out. No eval, no Function(),
 *     no template-literal evaluation, no DOM access, no logging.
 *   - Values are inserted verbatim — escaping/sanitization is the caller's
 *     responsibility. For the workflow section renderer, DOMPurify runs
 *     after this function on the merged string, so any HTML/script content
 *     in a value gets cleaned along with the rest of the content.
 */

import {
  getTemplateVariableNameSet,
  type TemplateVariableName,
} from '@/lib/templates/variableRegistry';

// Partial map from variable name → optional nullable string value. A name
// missing from the object, or present with null/undefined/empty string,
// renders as '' in the output (spec Definition of Done item 4).
export type TemplateVariableValues = {
  [K in TemplateVariableName]?: string | null;
};

// Only matches proper {{word}} placeholders. \w+ guarantees a non-empty
// identifier, so {{ }} and {{!@#}} are left as literal text. The double
// brace anchors prevent partial matches like {{name} from being captured.
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function replaceTemplateVariables(
  content: string | null | undefined,
  values: TemplateVariableValues,
): string {
  if (content === null || content === undefined || content === '') {
    return '';
  }

  const recognizedNames = getTemplateVariableNameSet();

  return content.replace(VARIABLE_PATTERN, (_match, capturedName: string) => {
    // The registry is the sole authority for "is this name recognized?".
    // A caller cannot promote an arbitrary key into the output by passing
    // it under an unknown name — even if `values` carries it, the regex
    // capture is checked against the registry first.
    if (!recognizedNames.has(capturedName)) {
      return '';
    }

    const value = values[capturedName as TemplateVariableName];

    // Treat null, undefined, and the empty string as "no value". The
    // spec's edge case table is explicit: never leave a raw {{name}}
    // visible to the candidate, and never display the literal word
    // "candidatePhone" (etc.) when the underlying data is absent.
    if (value === null || value === undefined || value === '') {
      return '';
    }

    return value;
  });
}
