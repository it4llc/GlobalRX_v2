// /GlobalRX_v2/src/types/candidate-repeatable-form.ts
// Types for repeatable entry sections (Education, Employment, Address History)

// Field value union mirrors what the repeatableSaveRequestSchema accepts in
// /api/candidate/application/[token]/save: a string, number, boolean, null,
// string[] (multi-select), or — for address_block fields added in Phase 6
// Stage 3 — a JSON object whose values are JSON primitives. Keep this in sync
// with both repeatableSaveRequestSchema and addressHistorySaveRequestSchema
// in src/app/api/candidate/application/[token]/save/route.ts.
//
// The record case is intentionally restricted to one level deep (primitive
// values only) — this matches the Zod schema and prevents accidentally
// nesting full sub-forms inside a single field's value.
export type RepeatableFieldValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | { [k: string]: string | number | boolean | null | undefined };

export interface EntryData {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{
    requirementId: string;
    value: RepeatableFieldValue;
  }>;
}

export interface RepeatableSection {
  entries: EntryData[];
}

export interface ScopeInfo {
  functionalityType: string;
  serviceId: string;
  scopeType: 'count_exact' | 'count_specific' | 'time_based' | 'all' | 'highest_degree' | 'highest_degree_inc_hs' | 'all_degrees';
  scopeValue: number | null;
  scopeDescription: string;
}

export interface EntryManagerProps {
  entries: EntryData[];
  onAddEntry: () => void;
  onRemoveEntry: (entryId: string) => void;
  onEntryChange: (entryId: string, data: Partial<EntryData>) => void;
  renderEntry: (entry: EntryData, index: number) => React.ReactNode;
  entryLabelKey: string; // Translation key for entry labels
  // Optional minimum entry count. When entries.length <= minimumEntries the
  // per-entry remove control is hidden (per Phase 6 Stage 3 Business Rule #3
  // — Address History always has at least one entry). Defaults to 0, which
  // preserves the Stage 2 behavior for Education and Employment.
  minimumEntries?: number;
  // Optional maximum entry count. When entries.length >= maxEntries the
  // Add button is hidden — used by Address History to enforce count-based
  // scopes (current-address → 1, last-x-addresses → x). Undefined means
  // unlimited, which preserves Stage 2 behavior for Education and Employment.
  maxEntries?: number;
  // Task 9.2 (Accessibility) — translation keys used to compute the
  // descriptive aria-labels on the Add / Remove buttons. The keys vary by
  // section ("Add another address entry", "Add another education entry",
  // "Add another employment entry") so the caller passes the section-
  // specific keys here. The Remove key receives a {{number}} placeholder
  // and the addLabelKey is used as-is. Both are optional with sensible
  // fallbacks for callers that don't yet opt in.
  addButtonAriaLabelKey?: string;
  removeButtonAriaLabelKey?: string;
}