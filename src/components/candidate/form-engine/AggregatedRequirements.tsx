// /GlobalRX_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx

'use client';

import React from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { useTranslation } from '@/contexts/TranslationContext';
import type { AggregatedRequirementItem } from '@/types/candidate-address';
import type { FieldValue } from '@/types/candidate-portal';
import type { RepeatableFieldValue } from '@/types/candidate-repeatable-form';

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
              // Per Stage 3 spec Data Requirements (line 716, "Document
              // Requirement Display"): document instructions live on
              // `documentData.instructions`. We fall back to the legacy
              // top-level `instructions` for callers that haven't been
              // updated yet, then to null. This is a read-only fix — the
              // upstream item-builder in AddressHistorySection still copies
              // both fields onto the item.
              const documentInstructions =
                doc.documentData?.instructions ?? doc.instructions ?? null;
              return (
              <li
                key={doc.requirementId}
                className="border border-gray-200 rounded-md p-3 bg-gray-50"
                data-testid={`aggregated-document-${doc.requirementId}`}
              >
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
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
