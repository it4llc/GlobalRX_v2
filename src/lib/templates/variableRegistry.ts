// /GlobalRX_v2/src/lib/templates/variableRegistry.ts

/**
 * Template Variable Registry — single source of truth for which variables
 * the {{placeholder}} system recognizes, what each one displays, and which
 * category it belongs to.
 *
 * Consumers:
 *   - `replaceTemplateVariables` (validation — only recognized names are
 *     replaced; unrecognized names render as empty string per spec BR 4).
 *   - The admin reference panel (`WorkflowSectionVariableReference`) which
 *     displays the list to internal admins editing workflow section content.
 *
 * Adding a new variable: append an entry below AND add its translation key
 * to every file in `src/translations/` (en-US first, then mirror). The
 * unit tests in `variableRegistry.test.ts` will fail if the new entry's
 * shape is wrong or if its name conflicts with an existing one.
 *
 * NOTE: `inviteLink` is intentionally not in v1 — a candidate viewing a
 * workflow section has already clicked the invite link, so the variable
 * is not useful at workflow-section render time. When email-send code is
 * built, `inviteLink` can be added here and the workflow-dialog email
 * template hint list migrated to read from this registry.
 */

export type TemplateVariableCategory = 'candidate' | 'company' | 'invitation';

export type TemplateVariableName =
  | 'candidateFirstName'
  | 'candidateLastName'
  | 'candidateEmail'
  | 'candidatePhone'
  | 'companyName'
  | 'expirationDate';

export interface TemplateVariableRegistryEntry {
  name: TemplateVariableName;
  descriptionKey: string;
  category: TemplateVariableCategory;
}

export const TEMPLATE_VARIABLE_REGISTRY: readonly TemplateVariableRegistryEntry[] = [
  {
    name: 'candidateFirstName',
    descriptionKey: 'admin.workflowSection.variable.candidateFirstName.desc',
    category: 'candidate',
  },
  {
    name: 'candidateLastName',
    descriptionKey: 'admin.workflowSection.variable.candidateLastName.desc',
    category: 'candidate',
  },
  {
    name: 'candidateEmail',
    descriptionKey: 'admin.workflowSection.variable.candidateEmail.desc',
    category: 'candidate',
  },
  {
    name: 'candidatePhone',
    descriptionKey: 'admin.workflowSection.variable.candidatePhone.desc',
    category: 'candidate',
  },
  {
    name: 'companyName',
    descriptionKey: 'admin.workflowSection.variable.companyName.desc',
    category: 'company',
  },
  {
    name: 'expirationDate',
    descriptionKey: 'admin.workflowSection.variable.expirationDate.desc',
    category: 'invitation',
  },
] as const;

// Derived list of names in the same order as the registry. Kept separately
// so callers iterating over names (e.g., for fast Set construction) do not
// have to project the registry every time.
export const TEMPLATE_VARIABLE_NAMES: readonly TemplateVariableName[] =
  TEMPLATE_VARIABLE_REGISTRY.map((entry) => entry.name);

// Memoised lookup set for the replacement function. Built lazily so the
// registry is the source of truth; subsequent calls return the same Set
// without re-iterating.
let cachedNameSet: Set<string> | null = null;

export function getTemplateVariableNameSet(): Set<string> {
  if (cachedNameSet === null) {
    cachedNameSet = new Set<string>(TEMPLATE_VARIABLE_NAMES);
  }
  return cachedNameSet;
}
