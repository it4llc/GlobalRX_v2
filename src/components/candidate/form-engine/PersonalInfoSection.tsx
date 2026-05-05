// /GlobalRX_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import CrossSectionRequirementBanner from '@/components/candidate/CrossSectionRequirementBanner';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import { computePersonalInfoStatus } from '@/lib/candidate/sectionProgress';
import type { FieldValue, PersonalInfoField } from '@/types/candidate-portal';
import type { CrossSectionRequirementEntry, SectionStatus } from '@/types/candidate-stage4';

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
}

/**
 * Personal Information Section
 *
 * A section that appears first in the candidate's application.
 * It collects basic information about the candidate that isn't tied to any specific service.
 */
export function PersonalInfoSection({
  token,
  fields,
  initialSavedValues,
  crossSectionRequirements,
  onProgressUpdate,
  onSavedValuesChange,
}: PersonalInfoSectionProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, FieldValue>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  // Debounce the pending saves to batch them
  const debouncedPendingSaves = useDebounce(pendingSaves, 300);

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
    // Don't save locked fields
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
        const fieldsToSave = Array.from(debouncedPendingSaves).map(requirementId => ({
          requirementId,
          value: formData[requirementId]
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
        onSavedValuesChange?.(formData);

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
  }, [debouncedPendingSaves, formData, token, onSavedValuesChange]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">{t('candidate.portal.personalInfo.loading')}</div>
      </div>
    );
  }

  if (fields.length === 0) {
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
          .map(field => (
            <DynamicFieldRenderer
              key={field.requirementId}
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
              // Phase 6 Stage 3: Personal Information is location-independent
              // (Stage 1 spec Business Rule #10) and should never receive an
              // address_block field. Passing null is defensive — if a
              // misconfigured DSX field ever did appear here, the address
              // block would fall back to free-text inputs (no country
              // context, no subdivisions to load).
              countryId={null}
              token={token}
            />
          ))}
      </div>
    </div>
  );
}