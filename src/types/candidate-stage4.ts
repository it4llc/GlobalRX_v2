// /GlobalRX_v2/src/types/candidate-stage4.ts
//
// TypeScript types specific to Phase 6 Stage 4: Workflow sections, document
// uploads, section progress, and the cross-section requirement registry.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// All status values use lowercase strings per BR 22.

/**
 * Section progress status. The three lowercase values per Business Rule 14
 * and Business Rule 22. Source of truth for Stage 4.
 */
export type SectionStatus = 'not_started' | 'incomplete' | 'complete';

/**
 * Workflow section payload returned by the structure endpoint per the spec's
 * "Structure endpoint additions — workflow section payload" Data Requirements
 * table. Drives the WorkflowSectionRenderer component.
 */
export interface WorkflowSectionPayload {
  id: string;
  name: string;
  type: 'text' | 'document';
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  placement: 'before_services' | 'after_services';
  displayOrder: number;
  isRequired: boolean;
}

/**
 * Document scope literal values per Business Rule 11. The `null`/missing case
 * from Business Rule 23 is handled at read sites (treated as `per_search`),
 * not represented in the type.
 */
export type DocumentScope = 'per_entry' | 'per_search' | 'per_order';

/**
 * Saved metadata record for an uploaded document. Matches both the upload
 * endpoint response shape and the saved metadata persisted via auto-save into
 * `order_data`/`formData`.
 */
export interface UploadedDocumentMetadata {
  documentId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

/**
 * Cross-section target keys. Stage 4 supports `subject` only per Business
 * Rule 17. May be widened in a future stage when other targets become valid.
 */
export type CrossSectionTarget = 'subject';

/**
 * Cross-section requirement registry entry — represents a single DSX
 * requirement triggered by one section that must be evaluated as required by
 * another section's progress check. See spec Data Requirements:
 * "Cross-section requirement registry — entry shape".
 */
export interface CrossSectionRequirementEntry {
  fieldId: string;
  fieldKey: string;
  fieldName: string;
  isRequired: boolean;
  triggeredBy: string;
  triggeredByContext?: string;
  triggeredByEntryIndex?: number;
}

/**
 * Cross-section requirement registry. Keyed by the target section identifier;
 * Stage 4 supports `subject` only (BR 17). The `Partial` shape lets callers
 * write to or read from any subset of targets without pre-initialising every
 * key.
 */
export type CrossSectionRegistry = Partial<
  Record<CrossSectionTarget, CrossSectionRequirementEntry[]>
>;

/**
 * Saved acknowledgment record returned by the saved-data endpoint when a
 * section is a workflow section. Per Business Rule 8, the bucket key is the
 * `workflow_sections.id` and the shape is `{ type: 'workflow_section',
 * acknowledged: boolean }`.
 */
export interface WorkflowSectionAcknowledgment {
  type: 'workflow_section';
  acknowledged: boolean;
}
