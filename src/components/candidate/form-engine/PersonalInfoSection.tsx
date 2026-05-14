// /GlobalRX_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx

'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import CrossSectionRequirementBanner from '@/components/candidate/CrossSectionRequirementBanner';
import { SectionErrorBanner } from '@/components/candidate/SectionErrorBanner';
import { FieldErrorMessage } from '@/components/candidate/FieldErrorMessage';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import { computePersonalInfoStatus } from '@/lib/candidate/sectionProgress';
import type { FieldValue, PersonalInfoField } from '@/types/candidate-portal';
import type { CrossSectionRequirementEntry, SectionStatus } from '@/types/candidate-stage4';
import type { SectionValidationResult } from '@/lib/candidate/validation/types';

// Phase 7 Stage 1 fix-up — local "is value present" helper. Mirrors the same
// rule used in lib/candidate/sectionProgress.ts so the in-section red-border
// state stays consistent with the section status the shell already computes
// (cross-section-required field empty → status incomplete → red border + inline
// error). Empty strings (post-trim) and empty arrays count as missing.
function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

interface PersonalInfoSectionProps {
  token: string;
  // TD-059 — field definitions are now owned by the shell (portal-layout.tsx)
  // and pushed in as a prop, instead of being fetched inside this component.
  // This is what allows the shell to recompute Personal Info's progress when
  // the cross-section registry changes even while this component is unmounted.
  fields: PersonalInfoField[];
  // TD-059 — saved values for personal-info fields keyed by requirementId,
  // hydrated by the shell from /saved-data on mount. Locked prefilled values
  // are merged in during hydration without overriding their prefill (see
  // handleFieldBlur — saving is also blocked for locked fields).
  initialSavedValues?: Record<string, unknown>;
  // Phase 6 Stage 4 — registry entries posted by other sections (e.g., Address
  // History) under the `subject` target. Drives both the banner at the top of
  // this section and the progress calculation, so cross-section-required
  // fields gate `complete` status here.
  crossSectionRequirements?: CrossSectionRequirementEntry[];
  // Phase 6 Stage 4 — pushed up to the shell on every progress recalculation.
  // The shell uses these statuses to render section progress indicators.
  onProgressUpdate?: (status: SectionStatus) => void;
  // TD-059 — push saved values back up to the shell after a successful
  // auto-save so the shell's lifted progress effect always sees fresh values.
  // Avoids a /saved-data refetch round-trip on every save.
  onSavedValuesChange?: (next: Record<string, unknown>) => void;
  // Phase 7 Stage 1 — server-derived validation state. Errors are emitted
  // for every section regardless of visit status (the engine doesn't gate);
  // `errorsVisible` is the gate the shell computes from sectionVisits +
  // reviewPageVisitedAt. We pass both so the section can render the banner
  // and per-field messages only when appropriate.
  sectionValidation?: SectionValidationResult | null;
  errorsVisible?: boolean;
  // Phase 7 Stage 1 — invoked after a successful auto-save so the shell can
  // re-fetch /validate. Kept optional so older callers / tests don't break.
  onSaveSuccess?: () => void;
}

/**
 * Personal Information Section
 *
 * Sits at Step 6 of the candidate flow (Task 8.2 reorder). As of Task 8.3 the
 * section is 100% driven by the cross-section subject-targeted field registry
 * plus the (non-locked) DSX field requirements pushed in via the `fields`
 * prop — name, email, and phone are now shown on the Welcome page (Task 8.1)
 * and are no longer rendered here (spec docs/specs/personal-info-dynamic.md
 * Business Rule 1). When the candidate's country selections do not require
 * any subject-targeted fields, the empty-state branch renders the
 * `candidate.portal.personalInfo.noFieldsRequired` message and the section is
 * considered complete (DoD items 3 + 4).
 */
export function PersonalInfoSection({
  token,
  fields,
  initialSavedValues,
  crossSectionRequirements,
  onProgressUpdate,
  onSavedValuesChange,
  sectionValidation,
  errorsVisible,
  onSaveSuccess,
}: PersonalInfoSectionProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, FieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  // Debounce the pending saves to batch them
  const debouncedPendingSaves = useDebounce(pendingSaves, 300);

  // Bug fix (smoke testing — infinite loop on Personal Info): the auto-save
  // effect previously listed `formData` in its dependency array. After a
  // successful save we push formData up to the shell via
  // onSavedValuesChange, which re-renders the shell, which passes a new
  // initialSavedValues prop, which causes the hydration effect to call
  // setFormData(...) with a fresh object reference. Because debouncedPendingSaves
  // takes 300ms to catch up to the cleared pendingSaves Set, the new formData
  // reference re-triggered the save effect with stale `debouncedPendingSaves` —
  // looping forever. Per COMPONENT_STANDARDS Section 2.2 the fix is to read
  // formData via a ref inside the effect so reference changes do not retrigger
  // it.
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // TD-059 — hydrate formData from shell-provided fields and saved values.
  // The shell fetches /personal-info-fields and /saved-data once on mount;
  // we merge those into a single requirementId-keyed map here. Locked
  // prefilled values keep their prefill — handleFieldBlur additionally
  // blocks saves for locked fields so they cannot be overwritten. We do
  // not refetch on every render; the shell pushes new values via the
  // initialSavedValues prop after auto-save round-trips.
  useEffect(() => {
    const initial: Record<string, FieldValue> = {};
    for (const field of fields) {
      if (field.prefilledValue !== null && field.prefilledValue !== undefined) {
        initial[field.requirementId] = field.prefilledValue as FieldValue;
      }
    }
    if (initialSavedValues) {
      for (const [requirementId, value] of Object.entries(initialSavedValues)) {
        const fieldDef = fields.find(f => f.requirementId === requirementId);
        if (!fieldDef?.locked) {
          initial[requirementId] = value as FieldValue;
        }
      }
    }
    setFormData(initial);
    setLoading(false);
  }, [fields, initialSavedValues]);

  // Handle field value change
  const handleFieldChange = useCallback((requirementId: string, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [requirementId]: value
    }));
  }, []);

  // Handle field blur - trigger save
  const handleFieldBlur = useCallback((requirementId: string) => {
    // Don't save locked fields. As of Task 8.3 the API filters the locked
    // invitation fieldKeys out before they reach this component, so in normal
    // flow no field arriving here has `locked=true`. The guard is retained as
    // defense in depth: a future regression in the API filter would otherwise
    // re-introduce the dropped-on-save behavior silently.
    const field = fields.find(f => f.requirementId === requirementId);
    if (field?.locked) {
      return;
    }

    // Add to pending saves
    setPendingSaves(prev => new Set(prev).add(requirementId));
  }, [fields]);

  // Save data when debounced pending saves changes
  useEffect(() => {
    if (debouncedPendingSaves.size === 0) {
      return;
    }

    const saveData = async () => {
      setSaveStatus('saving');

      try {
        // Read formData via the ref (see Bug fix note above). The ref is
        // updated synchronously after every render, so this reflects the
        // latest committed values without making the effect depend on the
        // formData reference itself.
        const currentFormData = formDataRef.current;
        const fieldsToSave = Array.from(debouncedPendingSaves).map(requirementId => ({
          requirementId,
          value: currentFormData[requirementId]
        }));

        const response = await fetch(
          `/api/candidate/application/${token}/save`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionType: 'personal_info',
              sectionId: 'personal_info',
              fields: fieldsToSave
            })
          }
        );

        if (!response.ok) {
          throw new Error('Save failed');
        }

        setSaveStatus('saved');
        setPendingSaves(new Set());

        // TD-059 — push the freshly saved values up to the shell so the
        // shell's lifted progress effect recomputes from the newest values.
        // This avoids a /saved-data refetch on every save (the shell would
        // otherwise be one round-trip behind on registry-change recomputes
        // that fire while another tab is active).
        onSavedValuesChange?.(currentFormData);
        // Phase 7 Stage 1 — re-fetch /validate after the save lands so
        // banner / field error visibility tracks the new saved values.
        onSaveSuccess?.();

        // Clear saved indicator after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);

      } catch (error) {
        logger.error('Failed to save personal info', {
          event: 'personal_info_save_error',
          sectionType: 'personal_info',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        setSaveStatus('error');

        // Retry after 2 seconds
        setTimeout(() => {
          setPendingSaves(prev => new Set([...prev, ...debouncedPendingSaves]));
        }, 2000);
      }
    };

    saveData();
    // formData is intentionally NOT a dependency — it is read via formDataRef
    // to break the auto-save → onSavedValuesChange → setFormData → re-fire
    // loop documented above.
  }, [debouncedPendingSaves, token, onSavedValuesChange, onSaveSuccess]);

  // Phase 6 Stage 4 — recompute and report progress whenever fields, values,
  // or the cross-section registry change. The helper is pure; we translate
  // the requirementId-keyed formData into a fieldKey-keyed map because the
  // helper looks up by fieldKey (matching the DSX requirement.fieldKey, which
  // is also the key used by cross-section registry entries).
  useEffect(() => {
    if (loading || !onProgressUpdate) return;
    const valuesByFieldKey: Record<string, unknown> = {};
    for (const field of fields) {
      valuesByFieldKey[field.fieldKey] = formData[field.requirementId];
    }
    // The helper expects a FieldLike shape with `id`; PersonalInfoField uses
    // `requirementId` as the canonical id everywhere else in the component, so
    // we adapt here without restructuring the local field type.
    const fieldLikes = fields.map(field => ({
      id: field.requirementId,
      fieldKey: field.fieldKey,
      isRequired: field.isRequired,
    }));
    const status = computePersonalInfoStatus(
      fieldLikes,
      valuesByFieldKey,
      crossSectionRequirements ?? [],
    );
    onProgressUpdate(status);
  }, [loading, fields, formData, crossSectionRequirements, onProgressUpdate]);

  const crossSectionRequiredKeys = useMemo(() => {
    const set = new Set<string>();
    for (const cs of crossSectionRequirements ?? []) {
      if (cs.isRequired) set.add(cs.fieldKey);
    }
    return set;
  }, [crossSectionRequirements]);

  // Phase 7 Stage 1 — index field-level errors by fieldName for O(1) lookup
  // when rendering each input. We use fieldName because the validation engine
  // emits FieldError.fieldName matching the section's fieldKey/name pair.
  const fieldErrorsByName = useMemo(() => {
    const map: Record<string, { messageKey: string; placeholders?: Record<string, string | number> }> = {};
    if (!sectionValidation || !errorsVisible) return map;
    for (const fe of sectionValidation.fieldErrors) {
      map[fe.fieldName] = { messageKey: fe.messageKey, placeholders: fe.placeholders };
    }
    return map;
  }, [sectionValidation, errorsVisible]);

  // Phase 7 Stage 1 fix-up — synthesize field-level errors locally for fields
  // that are required ONLY because of a cross-section requirement (e.g.,
  // Address History country forces Middle Name to be required for the
  // subject). The /validate engine has no visibility into cross-section
  // requirements (those live in browser memory), so without this local
  // synthesis the empty cross-section-required field would never trigger
  // the red-border / inline-error UI. Gated by errorsVisible to respect the
  // "no errors until visit-and-departure" rule (Rule 4).
  const fieldKeysWithCrossSectionRequiredEmpty = useMemo(() => {
    const set = new Set<string>();
    if (!errorsVisible) return set;
    for (const field of fields) {
      // Only synthesize for fields that are cross-section-required AND empty.
      // If the field is locally required and empty, the validate engine still
      // won't emit a FieldError today (the engine doesn't generate field
      // errors for personal_info), but the same path catches that case too —
      // we're conservative on the cross-section flag rather than always-on
      // because a locally-required field is already shown with the red
      // asterisk via the original isRequired prop.
      if (!crossSectionRequiredKeys.has(field.fieldKey)) continue;
      if (!hasFieldValue(formData[field.requirementId])) {
        set.add(field.fieldKey);
      }
    }
    return set;
  }, [errorsVisible, fields, formData, crossSectionRequiredKeys]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">{t('candidate.portal.personalInfo.loading')}</div>
      </div>
    );
  }

  if (fields.length === 0) {
    // Task 8.3 — this empty-state branch now also covers the case where the
    // candidate's country selections don't trigger any subject-targeted
    // fields (spec User Flow paragraph 3 / Edge Case 1). The translation key
    // value was updated to the spec-mandated wording "No additional
    // information is required." in all 5 languages.
    return (
      <div className="p-8 text-center text-gray-600">
        {/* Even when no local fields exist, we still render the cross-section
            banner above so candidates see why other tabs may have flagged
            them. The banner is the only UI in this branch. */}
        <CrossSectionRequirementBanner requirements={crossSectionRequirements ?? []} />
        {t('candidate.portal.personalInfo.noFieldsRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Phase 6 Stage 4 — cross-section requirement banner. Hidden when the
          requirements array is empty (the component handles that internally).
          Per the technical-plan resolved decision, the banner renders inside
          this section rather than the shell so it lives next to the heading
          area it describes. */}
      <CrossSectionRequirementBanner requirements={crossSectionRequirements ?? []} />

      {/* Phase 7 Stage 1 — section-level error banner (Rule 8). Renders only
          when errors are gated visible AND the section has scope/gap/document
          errors. Personal Info has no scope/gap/document errors per Rule 18,
          so the banner self-hides; we still pass the props in case future
          DSX configuration introduces document requirements here. */}
      {errorsVisible && sectionValidation && (
        <SectionErrorBanner
          scopeErrors={sectionValidation.scopeErrors}
          gapErrors={sectionValidation.gapErrors}
          documentErrors={sectionValidation.documentErrors}
        />
      )}

      {/* Section header with save indicator */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{t('candidate.portal.sections.personalInformation')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600">
        {t('candidate.portal.personalInfo.instructions')}
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(field => {
            const validationFieldError = fieldErrorsByName[field.name];
            // Phase 7 Stage 1 fix-up — when the field is cross-section-required
            // but empty, synthesize a "this field is required" error locally
            // so the candidate sees both the red border (via hasError) AND the
            // inline error message. Validation-engine field errors take
            // precedence when present, since they may carry richer data
            // (e.g., format errors with placeholders).
            const isCrossSectionEmptyRequired =
              fieldKeysWithCrossSectionRequiredEmpty.has(field.fieldKey);
            const fieldError =
              validationFieldError ??
              (isCrossSectionEmptyRequired
                ? { messageKey: 'candidate.validation.field.required', placeholders: undefined }
                : undefined);
            return (
              <div key={field.requirementId}>
                <DynamicFieldRenderer
                  requirementId={field.requirementId}
                  name={field.name}
                  fieldKey={field.fieldKey}
                  dataType={field.dataType}
                  // Cross-section requirements registered for the `subject` target can mark a
                  // field as required even when its baseline DSX isRequired is false. Overlay
                  // here so the red-star indicator matches what computePersonalInfoStatus is
                  // already accounting for (Bug 2, surfaced in smoke testing of TD-059).
                  isRequired={field.isRequired || crossSectionRequiredKeys.has(field.fieldKey)}
                  instructions={field.instructions}
                  fieldData={field.fieldData}
                  value={formData[field.requirementId] || ''}
                  onChange={(value) => handleFieldChange(field.requirementId, value)}
                  onBlur={() => handleFieldBlur(field.requirementId)}
                  locked={field.locked}
                  // Phase 7 Stage 1 fix-up — drive aria-invalid (red border) when
                  // the validate engine reported a field error OR when the field
                  // is cross-section-required and currently empty (the engine
                  // doesn't see cross-section reqs, so we synthesize locally).
                  hasError={Boolean(validationFieldError) || isCrossSectionEmptyRequired}
                  // Phase 6 Stage 3: Personal Information is location-independent
                  // (Stage 1 spec Business Rule #10) and should never receive an
                  // address_block field. Passing null is defensive — if a
                  // misconfigured DSX field ever did appear here, the address
                  // block would fall back to free-text inputs (no country
                  // context, no subdivisions to load).
                  countryId={null}
                  token={token}
                />
                {/* Phase 7 Stage 1 — Rule 4 / Rule 5 — required + format
                    errors only render when the section's errors are visible. */}
                {fieldError && (
                  <FieldErrorMessage
                    messageKey={fieldError.messageKey}
                    placeholders={fieldError.placeholders}
                    fieldName={field.name}
                  />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}