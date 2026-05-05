// /GlobalRX_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx

'use client';

import React from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import CandidateDocumentUpload from '../CandidateDocumentUpload';
import { useTranslation } from '@/contexts/TranslationContext';
import type { AggregatedRequirementItem } from '@/types/candidate-address';
import type { FieldValue } from '@/types/candidate-portal';
import type { RepeatableFieldValue } from '@/types/candidate-repeatable-form';
import type { UploadedDocumentMetadata } from '@/types/candidate-stage4';

export interface AggregatedRequirementsProps {
  /**
   * The deduplicated, OR-merged requirement items computed by the parent
   * AddressHistorySection. The parent owns the dedup logic; this component
   * is purely presentational. Both data fields and document requirements
   * arrive in the same array — this component splits them into the two
   * subsections.
   */
  items: AggregatedRequirementItem[];
  /** Current values for aggregated additional fields, keyed by requirement UUID. */
  values: Record<string, RepeatableFieldValue>;
  /** Called when a data field's value changes. */
  onAggregatedFieldChange: (requirementId: string, value: FieldValue) => void;
  /** Called on field blur (auto-save trigger). */
  onAggregatedFieldBlur?: () => void;
  // Phase 6 Stage 4 — document upload pass-through. The parent owns the
  // metadata storage decision (per BR 11 routing) and supplies the
  // already-resolved uploadedDocuments map keyed by requirement UUID. This
  // component only renders one CandidateDocumentUpload per document item and
  // forwards the upload/remove callbacks back to the parent.
  uploadedDocuments?: Record<string, UploadedDocumentMetadata | undefined>;
  onDocumentUploadComplete?: (
    requirementId: string,
    metadata: UploadedDocumentMetadata,
  ) => void;
  onDocumentRemove?: (requirementId: string) => void;
  /** Candidate auth token — passed through to the upload component. */
  token?: string;
}

/**
 * AggregatedRequirements
 *
 * Renders the deduplicated additional fields and document requirements
 * triggered by the candidate's address entries. Hidden entirely when no
 * items exist (per spec: "This area is completely hidden when no addresses
 * triggered any extra requirements").
 *
 * Data field requirements appear under "Additional Information" and use
 * DynamicFieldRenderer (which now supports address_block via this stage's
 * changes — though aggregated fields are unlikely to be address_block in
 * practice).
 *
 * Document requirements appear under "Required Documents" as informational
 * line items showing only the document name and instructions. The actual
 * file upload UI is delivered in Stage 4.
 */
export function AggregatedRequirements({
  items,
  values,
  onAggregatedFieldChange,
  onAggregatedFieldBlur,
  uploadedDocuments,
  onDocumentUploadComplete,
  onDocumentRemove,
  token,
}: AggregatedRequirementsProps) {
  const { t } = useTranslation();

  // Split into the two subsections. Document type takes precedence: anything
  // marked type === 'document' is rendered in the documents list, everything
  // else is treated as a data field.
  const dataFields = items.filter((i) => i.type !== 'document');
  const documents = items.filter((i) => i.type === 'document');

  // Hidden when no items at all. The parent could also gate render but doing
  // it here makes the component safe to drop into any layout.
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="aggregated-requirements mt-8 space-y-6">
      <h3 className="text-lg font-semibold">
        {t('candidate.aggregatedRequirements.heading')}
      </h3>

      {dataFields.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">
            {t('candidate.aggregatedRequirements.additionalInformation')}
          </h4>
          <div className="space-y-4">
            {dataFields.map((item) => {
              const stored = values[item.requirementId];
              // DynamicFieldRenderer accepts FieldValue (which includes the
              // widened address_block JSON object case via Phase 6 Stage 3),
              // but the aggregated map is typed as RepeatableFieldValue.
              // The two unions overlap on every element except Date, which
              // doesn't show up in saved data, so we coerce safely.
              const fieldValue: FieldValue =
                stored === undefined ? null : (stored as FieldValue);
              return (
                <DynamicFieldRenderer
                  key={item.requirementId}
                  requirementId={item.requirementId}
                  name={item.name}
                  fieldKey={item.requirementId}
                  dataType={item.dataType}
                  isRequired={item.isRequired}
                  instructions={item.instructions ?? null}
                  fieldData={item.fieldData ?? undefined}
                  value={fieldValue}
                  onChange={(v) => onAggregatedFieldChange(item.requirementId, v)}
                  onBlur={onAggregatedFieldBlur}
                />
              );
            })}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium">
            {t('candidate.aggregatedRequirements.requiredDocuments')}
          </h4>
          <ul className="space-y-3">
            {documents.map((doc) => {
              // Per Stage 3 spec Data Requirements: document instructions live
              // on `documentData.instructions`, with a legacy fallback to the
              // top-level `instructions`.
              const documentInstructions =
                doc.documentData?.instructions ?? doc.instructions ?? null;
              // Phase 6 Stage 4 — render the live upload component when the
              // parent has wired the callbacks. If the parent didn't (token
              // missing, callbacks omitted), fall back to the Stage 3
              // informational display so this component can still be used in
              // read-only contexts.
              const liveUpload =
                token !== undefined &&
                onDocumentUploadComplete !== undefined &&
                onDocumentRemove !== undefined;
              const uploaded = uploadedDocuments?.[doc.requirementId] ?? null;
              return (
                <li
                  key={doc.requirementId}
                  className="border border-gray-200 rounded-md p-3 bg-gray-50"
                  data-testid={`aggregated-document-${doc.requirementId}`}
                >
                  {liveUpload ? (
                    <CandidateDocumentUpload
                      requirement={{
                        id: doc.requirementId,
                        name: doc.name,
                        instructions: documentInstructions,
                        isRequired: doc.isRequired,
                        scope:
                          typeof doc.documentData?.scope === 'string'
                            ? (doc.documentData.scope as string)
                            : 'per_search',
                      }}
                      uploadedDocument={uploaded}
                      onUploadComplete={(metadata) =>
                        onDocumentUploadComplete!(doc.requirementId, metadata)
                      }
                      onRemove={() => onDocumentRemove!(doc.requirementId)}
                      token={token!}
                    />
                  ) : (
                    <>
                      <div className="font-medium">
                        {doc.name}
                        {doc.isRequired && (
                          <span className="text-red-500 ml-1 required-indicator">*</span>
                        )}
                      </div>
                      {documentInstructions && (
                        <p className="text-sm text-gray-600 mt-1">{documentInstructions}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2 italic">
                        {t('candidate.aggregatedRequirements.documentUploadPending')}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
