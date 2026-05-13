// /GlobalRX_v2/src/types/templateVariables.ts

/**
 * Public TypeScript types for the template variable system.
 *
 * Consumers should import from this module rather than reaching into
 * /src/lib/templates/* directly — that keeps the public surface area in
 * /src/types/ per CODING_STANDARDS.md Section 3.3.
 */

export type {
  TemplateVariableName,
  TemplateVariableCategory,
  TemplateVariableRegistryEntry,
} from '@/lib/templates/variableRegistry';

export type { TemplateVariableValues } from '@/lib/templates/replaceTemplateVariables';
