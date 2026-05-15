// /GlobalRX_v2/src/components/candidate/form-engine/IdvSection.tsx

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { SectionErrorBanner } from '@/components/candidate/SectionErrorBanner';
import { FieldErrorMessage } from '@/components/candidate/FieldErrorMessage';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import { computeIdvStatus } from '@/lib/candidate/sectionProgress';
import type { FieldMetadata, DocumentMetadata, FieldValue } from '@/types/candidate-portal';
import type { SectionStatus } from '@/types/candidate-stage4';
import type { SectionValidationResult } from '@/lib/candidate/validation/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IdvField {
  requirementId: string;
  name: string;
  fieldKey: string;
  type: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata | null;
  documentData?: DocumentMetadata | null;
  displayOrder: number;
}

// Shape of an entry returned by /api/candidate/application/[token]/countries.
// The API returns id (UUID), name, and code2; we only need id and name here,
// but allow code2 to be present so this matches the API contract.
interface CountryApiResponse {
  id: string;
  name: string;
  code2?: string;
}

interface IdvSectionProps {
  token: string;
  serviceIds: string[];
  // Phase 6 Stage 4 — pushed up to the shell on every progress recalculation.
  // The shell uses this to render the IDV progress indicator. IDV is not a
  // cross-section target in Stage 4 (BR 17 — only `subject` is) so no banner
  // or registry wiring is required here.
  onProgressUpdate?: (status: SectionStatus) => void;
  // Phase 7 Stage 1 — server-derived validation state. IDV has no scope/gap
  // checks (Rule 18) but document errors are possible if the DSX requirement
  // configuration includes any.
  sectionValidation?: SectionValidationResult | null;
  errorsVisible?: boolean;
  onSaveSuccess?: () => void;
}

/**
 * IDV Section Component
 *
 * A self-contained component that replaces the IDV placeholder.
 * Includes country selector and dynamic field loading based on country.
 *
 * This component is intentionally self-contained to allow future replacement
 * with third-party IDV provider integrations (embedded widgets, external redirects, etc.)
 * without affecting the rest of the application. The parent only needs to know
 * whether IDV is started/complete, not the internal field details.
 */
export function IdvSection({
  token,
  serviceIds,
  onProgressUpdate,
  sectionValidation,
  errorsVisible,
  onSaveSuccess,
}: IdvSectionProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [countriesError, setCountriesError] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [fields, setFields] = useState<IdvField[]>([]);
  // Slots are either a FieldValue (per-requirement value) or, under synthetic
  // `country_<id>` keys, a snapshot of that country's prior field values.
  const [formData, setFormData] = useState<Record<string, FieldValue | Record<string, FieldValue>>>({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  // Debounce the pending saves to batch them
  const debouncedPendingSaves = useDebounce(pendingSaves, 300);

  // Load countries on mount
  useEffect(() => {
    loadCountries();
    loadSavedData();
  }, [token]);

  const loadCountries = async () => {
    // Load countries from candidate-specific API.
    // We do NOT fall back to a hardcoded list here: the database stores Country.id
    // as a UUID, so any non-UUID stand-in (e.g. "US") would be rejected at submission
    // when OrderItem.locationId is set from this value (FK to Country.id), and would
    // also be rejected by other save endpoints' Zod schemas. If the API call fails
    // we surface a clear error to the candidate instead.
    try {
      const countriesResponse = await fetch(
        `/api/candidate/application/${token}/countries`
      );
      if (countriesResponse.ok) {
        const countriesData: CountryApiResponse[] = await countriesResponse.json();
        const countryList = countriesData.map((country) => ({
          id: country.id,
          name: country.name,
        }));
        setCountries(countryList);
        setCountriesError(false);
      } else {
        logger.error('Failed to load countries', {
          event: 'idv_countries_load_error',
          status: countriesResponse.status,
        });
        setCountries([]);
        setCountriesError(true);
      }
    } catch (error) {
      logger.error('Failed to load countries', {
        event: 'idv_countries_load_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setCountries([]);
      setCountriesError(true);
    }
  };

  const loadSavedData = async () => {
    try {
      const savedDataResponse = await fetch(
        `/api/candidate/application/${token}/saved-data`
      );

      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const idvData = savedData.sections?.idv?.fields || [];

        // Build form data map and extract the saved country.
        //
        // The country selection is persisted as a synthetic flat field row with
        // requirementId === 'idv_country' (see handleCountryChange / save handler
        // below). The submission code reads from this same row (see
        // submitApplication.ts readIdvCountryId and orderItemGeneration.ts), so
        // we hydrate from it here too. We do NOT read from a top-level
        // sections.idv.country key — the save handler does not write one, and
        // relying on that would silently break country persistence on reload.
        const dataMap: Record<string, FieldValue> = {};
        let savedCountry: string | null = null;
        for (const field of idvData) {
          if (field.requirementId === 'idv_country') {
            if (typeof field.value === 'string' && field.value.length > 0) {
              savedCountry = field.value;
            }
            continue;
          }
          dataMap[field.requirementId] = field.value;
        }

        if (savedCountry) {
          setSelectedCountry(savedCountry);
        }

        setFormData(dataMap);
      }
    } catch (error) {
      logger.error('Failed to load saved IDV data', {
        event: 'idv_saved_data_load_error',
        token,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Load fields when country changes
  useEffect(() => {
    if (selectedCountry && serviceIds.length > 0) {
      loadFieldsForCountry(selectedCountry);
    } else if (selectedCountry) {
      setFields([]);
    }
  }, [selectedCountry, serviceIds]);

  const loadFieldsForCountry = async (countryId: string) => {
    setLoading(true);
    try {
      // TD-084 — single package-aware fetch (was one fetch per service).
      // The /fields route OR-merges `isRequired` across every service in
      // `serviceIds` so the response carries one entry per requirement with
      // the cross-service-aggregated required-state already applied. The
      // local per-requirement dedup loop stays as a defensive guard.
      const fieldMap = new Map<string, IdvField>();

      if (serviceIds.length === 0) {
        setFields([]);
        return;
      }

      const serviceIdsQuery = serviceIds
        .map((id) => `serviceIds=${encodeURIComponent(id)}`)
        .join('&');
      const response = await fetch(
        `/api/candidate/application/${token}/fields?${serviceIdsQuery}&countryId=${countryId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load fields');
      }

      const data = await response.json();

      // Filter out personal info fields. The personal-info-tab filter
      // stays unchanged: IDV still excludes fields whose collectionTab
      // marks them as belonging to the Personal Information section.
      for (const field of data.fields || []) {
        const fieldData = field.fieldData || {};
        const collectionTab = fieldData.collectionTab || fieldData.collection_tab || '';

        const isPersonalInfoField =
          collectionTab.toLowerCase().includes('personal') ||
          collectionTab.toLowerCase().includes('subject') ||
          ['firstName', 'lastName', 'middleName', 'email', 'phone', 'phoneNumber',
           'dateOfBirth', 'birthDate', 'dob'].includes(field.fieldKey);

        if (!isPersonalInfoField && !fieldMap.has(field.requirementId)) {
          fieldMap.set(field.requirementId, field);
        }
      }

      // Convert map to array and sort
      const uniqueFields = Array.from(fieldMap.values())
        .sort((a, b) => a.displayOrder - b.displayOrder);

      setFields(uniqueFields);

      // Preserve existing form data for this country. The snapshot under the
      // synthetic country_<id> key is always a Record<string, FieldValue>;
      // narrow before spreading so the union type can be widened back out.
      const countrySnapshot = formData[`country_${countryId}`];
      if (countrySnapshot && typeof countrySnapshot === 'object' && !Array.isArray(countrySnapshot) && !(countrySnapshot instanceof Date)) {
        setFormData(prev => ({
          ...prev,
          ...(countrySnapshot as Record<string, FieldValue>)
        }));
      }

    } catch (error) {
      logger.error('Failed to load IDV fields', {
        event: 'idv_fields_load_error',
        token,
        countryCode: selectedCountry,
        serviceIds: serviceIds.join(','),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle country change
  //
  // Phase 7 Stage 3b — TD-072 fix. The previous implementation snapshot-
  // stashed the active per-requirement slot values under
  // `country_<previousCountryId>` but left the active slots in `formData`
  // unchanged. The next debounced save then included those orphan
  // requirementId keys in its payload — a save attempt against the new
  // country whose values belonged to the previous country.
  //
  // The fix folds the snapshot AND the cleanup into a single setFormData
  // callback so React applies both atomically:
  //   1. Read the previous-country values from `prev` (not the closure-
  //      captured `formData`) — keeps rapid X→Y→X switches consistent
  //      (Spec Edge Case 12).
  //   2. Drop those requirementId keys from the cloned object.
  //   3. Attach the snapshot under `country_<previousCountryId>` so a
  //      return to the previous country re-hydrates per `loadFieldsForCountry`
  //      lines 240–246 (Spec Rule 15).
  //
  // The dependency array drops `formData` because the callback now reads
  // its previous-country values from `prev` inside `setFormData`. This is
  // the standard React state-callback pattern and is correct for rapid
  // switches.
  const handleCountryChange = useCallback((countryId: string) => {
    if (selectedCountry && fields.length > 0) {
      setFormData(prev => {
        const currentCountryData: Record<string, FieldValue> = {};
        for (const field of fields) {
          // field.requirementId is a UUID — never collides with the
          // synthetic country_<id> snapshot keys, so the slot is always a
          // FieldValue.
          const value = prev[field.requirementId] as FieldValue | undefined;
          if (value !== undefined) {
            currentCountryData[field.requirementId] = value;
          }
        }
        const next: typeof prev = { ...prev };
        for (const field of fields) {
          delete next[field.requirementId];
        }
        next[`country_${selectedCountry}`] = currentCountryData;
        return next;
      });
    }

    setSelectedCountry(countryId);

    // Save country selection
    setPendingSaves(prev => new Set(prev).add('country'));
  }, [selectedCountry, fields]);

  // Handle field value change
  const handleFieldChange = useCallback((requirementId: string, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [requirementId]: value
    }));
  }, []);

  // Handle field blur - trigger save
  const handleFieldBlur = useCallback((requirementId: string) => {
    setPendingSaves(prev => new Set(prev).add(requirementId));
  }, []);

  // Save data when debounced pending saves changes
  useEffect(() => {
    if (debouncedPendingSaves.size === 0 || !selectedCountry) {
      return;
    }

    const saveData = async () => {
      setSaveStatus('saving');

      try {
        const fieldsToSave = Array.from(debouncedPendingSaves)
          .filter(id => id !== 'country')
          .map(requirementId => ({
            requirementId,
            value: formData[requirementId]
          }));

        // Add country to save data
        if (debouncedPendingSaves.has('country')) {
          fieldsToSave.push({
            requirementId: 'idv_country',
            value: selectedCountry
          });
        }

        const response = await fetch(
          `/api/candidate/application/${token}/save`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionType: 'idv',
              sectionId: 'idv',
              fields: fieldsToSave
            })
          }
        );

        if (!response.ok) {
          throw new Error('Save failed');
        }

        setSaveStatus('saved');
        setPendingSaves(new Set());

        // Phase 7 Stage 1 — re-fetch /validate after the save lands.
        onSaveSuccess?.();

        // Clear saved indicator after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);

      } catch (error) {
        logger.error('Failed to save IDV data', {
          event: 'idv_save_error',
          token,
          sectionId: 'idv',
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
  }, [debouncedPendingSaves, formData, selectedCountry, token]);

  // Phase 6 Stage 4 — recompute and report progress whenever fields, values,
  // or country selection change. IDV is country-gated: until the candidate
  // selects a country, no fields exist and the section is `not_started`.
  // Once fields load, the helper evaluates each required field against the
  // requirement-id-keyed values map (translated to fieldKey-keyed for the
  // helper, matching how PersonalInfoSection does the same thing).
  //
  // Note re: cross-section sourcing — IDV does not currently produce
  // subject-targeted DSX requirements, so no registry push is wired here.
  // If a future configuration introduces such a field, the existing
  // collectionTab filter would surface it on the Personal Info tab via the
  // shell's registry; the implementer can add a defensive push from IDV at
  // that point. Stage 4 leaves this out per the technical-plan section #8.
  useEffect(() => {
    if (!onProgressUpdate) return;
    if (!selectedCountry || fields.length === 0) {
      onProgressUpdate('not_started');
      return;
    }
    const valuesByFieldKey: Record<string, unknown> = {};
    for (const field of fields) {
      valuesByFieldKey[field.fieldKey] = formData[field.requirementId];
    }
    // Adapt IdvField → FieldLike (id vs requirementId — the helper expects
    // `id`). Same pattern PersonalInfoSection uses; keeps both component
    // field types stable while letting them share the pure helper.
    const fieldLikes = fields.map(field => ({
      id: field.requirementId,
      fieldKey: field.fieldKey,
      isRequired: field.isRequired,
    }));
    const status = computeIdvStatus(fieldLikes, valuesByFieldKey);
    onProgressUpdate(status);
  }, [selectedCountry, fields, formData, onProgressUpdate]);

  // Phase 7 Stage 1 — index field-level errors by fieldName for O(1) lookup
  // when rendering each input.
  const fieldErrorsByName = useMemo(() => {
    const map: Record<string, { messageKey: string; placeholders?: Record<string, string | number> }> = {};
    if (!sectionValidation || !errorsVisible) return map;
    for (const fe of sectionValidation.fieldErrors) {
      map[fe.fieldName] = { messageKey: fe.messageKey, placeholders: fe.placeholders };
    }
    return map;
  }, [sectionValidation, errorsVisible]);

  return (
    <div className="space-y-6">
      {/* Phase 7 Stage 1 — section-level error banner. IDV has no scope/gap
          checks per Rule 18; document errors render here when configured. */}
      {errorsVisible && sectionValidation && (
        <SectionErrorBanner
          scopeErrors={sectionValidation.scopeErrors}
          gapErrors={sectionValidation.gapErrors}
          documentErrors={sectionValidation.documentErrors}
        />
      )}

      {/* Section header with save indicator */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{t('candidate.portal.sections.identityVerification')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Phase 7 Stage 2 — countries load error. Mirrors EducationSection's
          countriesError alert. We surface this instead of falling back to a
          hardcoded list because the saved country must be a real Country.id
          (UUID) so submission's FK to Country can resolve. */}
      {countriesError && (
        <div
          role="alert"
          className="mb-4 p-3 border border-red-300 bg-red-50 text-red-800 rounded-md text-sm"
        >
          {t('candidate.portal.countriesLoadError')}
        </div>
      )}

      {/* Country selector */}
      <div className="space-y-2">
        <label htmlFor="country" className="block text-sm font-medium">
          {t('candidate.portal.idv.selectCountry')}
        </label>
        <Select
          value={selectedCountry}
          onValueChange={handleCountryChange}
        >
          <SelectTrigger
            id="country"
            name="country"
            className="min-h-[44px] text-base"
            data-testid="country-selector"
          >
            <SelectValue placeholder={t('candidate.portal.idv.chooseCountry')} />
          </SelectTrigger>
          <SelectContent>
            {countries.map(country => (
              <SelectItem key={country.id} value={country.id}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields container */}
      {selectedCountry && (
        <div data-testid="idv-fields-container">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-600">{t('candidate.portal.loadingFields')}</div>
            </div>
          ) : fields.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              {t('candidate.portal.idv.noFieldsRequired')}
            </div>
          ) : (
            <div className="space-y-4">
              {fields
                .filter(field => field.type === 'field') // Only show field types, not documents
                .map(field => {
                  const fieldError = fieldErrorsByName[field.name];
                  return (
                    <div key={field.requirementId}>
                      <DynamicFieldRenderer
                        requirementId={field.requirementId}
                        name={field.name}
                        fieldKey={field.fieldKey}
                        dataType={field.dataType}
                        isRequired={field.isRequired}
                        instructions={field.instructions}
                        fieldData={field.fieldData}
                        value={(formData[field.requirementId] as FieldValue | undefined) ?? ''}
                        onChange={(value) => handleFieldChange(field.requirementId, value)}
                        onBlur={() => handleFieldBlur(field.requirementId)}
                        // Phase 6 Stage 3: defensive consistency. IDV doesn't
                        // expect address_block fields today, but if a future DSX
                        // configuration adds one, this prop must be present so
                        // the embedded AddressBlockInput can populate its state
                        // dropdown.
                        countryId={selectedCountry || null}
                        token={token}
                      />
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
          )}
        </div>
      )}
    </div>
  );
}