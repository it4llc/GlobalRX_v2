// /GlobalRX_v2/src/types/candidate-repeatable-form.ts
// Types for repeatable entry sections (Education & Employment)

export interface EntryData {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{
    requirementId: string;
    value: any;
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
}