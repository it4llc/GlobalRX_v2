// /GlobalRX_v2/src/components/candidate/form-engine/AddressBlockInput.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import type {
  AddressBlockValue,
  AddressConfig,
  AddressConfigPiece,
  AddressPieceKey,
  SubdivisionItem,
} from '@/types/candidate-address';

// Default piece configuration applied when the DSX field has no addressConfig
// at all. Per spec "Default addressConfig When None Is Configured":
//   street1 required, street2 optional, city required, state required,
//   postalCode required, county disabled.
const DEFAULT_ADDRESS_CONFIG: AddressConfig = {
  street1: { enabled: true, label: 'Street Address', required: true },
  street2: { enabled: true, label: 'Apt/Suite', required: false },
  city: { enabled: true, label: 'City', required: true },
  state: { enabled: true, label: 'State/Province', required: true },
  county: { enabled: false, label: 'County', required: false },
  postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
};

const PIECE_TRANSLATION_KEYS: Record<AddressPieceKey, string> = {
  street1: 'candidate.addressBlock.street1',
  street2: 'candidate.addressBlock.street2',
  city: 'candidate.addressBlock.city',
  state: 'candidate.addressBlock.state',
  county: 'candidate.addressBlock.county',
  postalCode: 'candidate.addressBlock.postalCode',
};

export interface AddressBlockInputProps {
  /**
   * The DSX requirement UUID for the address_block field. Used as a stable
   * scope key for in-flight stale-response invalidation across multiple
   * address blocks rendered in the same section.
   */
  requirementId: string;
  /** Configuration from DSXRequirement.fieldData.addressConfig — may be null */
  addressConfig?: AddressConfig | null;
  /** Currently selected country UUID for this entry. Drives state dropdown. */
  countryId: string | null;
  /** The current value object for this address block */
  value: AddressBlockValue;
  /** Called when any piece changes */
  onChange: (value: AddressBlockValue) => void;
  /** Called when the candidate moves out of the block (auto-save trigger) */
  onBlur?: () => void;
  /** Whether the entire address block is locked (read-only) */
  locked?: boolean;
  /** Whether to render fromDate/toDate/isCurrent (Address History only) */
  showDates?: boolean;
  /**
   * Whether the parent address_block field is required, per DSX. Used in
   * combination with addressConfig[piece].required to decide which pieces
   * show the asterisk indicator (per COMPONENT_STANDARDS.md Section 3.3 —
   * only show asterisks when BOTH the parent field AND the individual
   * sub-field are required).
   */
  isRequired?: boolean;
  /**
   * Optional fetch override for tests so they can inject deterministic
   * responses without hitting the global fetch mock. Defaults to global fetch.
   */
  fetchSubdivisions?: (parentId: string) => Promise<SubdivisionItem[]>;
  /**
   * Required: the candidate's invitation token. Used to call the
   * subdivisions endpoint. Optional only so callers can pass undefined
   * during transient unauthenticated states.
   */
  token?: string;
  /**
   * Phase 6 Stage 3 Critical #1 — fired when the candidate has made their
   * most-specific geographic selection (per spec Business Rule #10 and
   * DoD #24). The callback receives the deepest UUID-shaped subregion
   * (county UUID > state UUID > null). Free-text values, which appear when
   * a country has no subdivisions for the level, are passed as null so the
   * downstream fields loader falls back to country-level requirements only.
   */
  onAddressComplete?: (mostSpecificSubregionId: string | null) => void;
}

/**
 * AddressBlockInput
 *
 * Reusable address-block input. Renders pieces (street1, street2, city,
 * state, county, postalCode) from the supplied addressConfig (falling back
 * to a safe default when none is configured). When showDates={true},
 * additionally renders fromDate, toDate, and an isCurrent checkbox; the
 * toDate field is hidden while isCurrent is checked.
 *
 * Used in three places:
 *   1. Address History entries (showDates=true)
 *   2. Education entries — School Address (showDates=false, via DynamicFieldRenderer)
 *   3. Employment entries — Company Address (showDates=false, via DynamicFieldRenderer)
 *
 * Subdivision behavior: state and county pieces render as dropdowns when
 * the parent geographic level has children in the `countries` table.
 * When no children exist, they fall back to free-text inputs and the
 * stored value is the typed string rather than a UUID. The hydration
 * service (order-data-resolvers.ts) detects which case applies via UUID
 * format check.
 *
 * Stale-response handling: every fetch captures the current "context"
 * (countryId for state, state value for county) so responses for outdated
 * geographic selections are discarded.
 */
export function AddressBlockInput({
  requirementId,
  addressConfig,
  countryId,
  value,
  onChange,
  onBlur,
  locked = false,
  showDates = false,
  isRequired = false,
  fetchSubdivisions,
  token,
  onAddressComplete,
}: AddressBlockInputProps) {
  const { t } = useTranslation();

  // Resolve the effective config — fall back to the safe default when none
  // is supplied (Definition of Done #4 / spec "Default addressConfig When
  // None Is Configured").
  const config: AddressConfig = addressConfig ?? DEFAULT_ADDRESS_CONFIG;

  // Subdivision lists per geographic level. Empty arrays are valid (means
  // "no subdivisions exist; render as free-text"). null means "not loaded
  // yet" so we can distinguish from "loaded, empty".
  const [stateSubdivisions, setStateSubdivisions] = useState<SubdivisionItem[] | null>(null);
  const [countySubdivisions, setCountySubdivisions] = useState<SubdivisionItem[] | null>(null);

  // Stale-response invalidation: each fetch records the context it was fired
  // for. When a response returns we compare against the latest context and
  // discard the response if the candidate has changed selections in between.
  const stateFetchContext = useRef<string | null>(null);
  const countyFetchContext = useRef<string | null>(null);

  // Default fetcher uses the candidate-side subdivisions endpoint. Tests can
  // inject `fetchSubdivisions` to bypass network.
  const doFetchSubdivisions = async (parentId: string): Promise<SubdivisionItem[]> => {
    if (fetchSubdivisions) {
      return fetchSubdivisions(parentId);
    }
    if (!token) {
      return [];
    }
    const response = await fetch(
      `/api/candidate/application/${token}/subdivisions?parentId=${parentId}`
    );
    if (!response.ok) {
      throw new Error(`Subdivisions request failed (${response.status})`);
    }
    const data = await response.json();
    return Array.isArray(data) ? (data as SubdivisionItem[]) : [];
  };

  // Load state subdivisions whenever the country changes.
  useEffect(() => {
    if (!countryId) {
      setStateSubdivisions(null);
      return;
    }
    const context = countryId;
    stateFetchContext.current = context;
    let cancelled = false;
    (async () => {
      try {
        const subs = await doFetchSubdivisions(context);
        // Discard if the candidate changed country before the response arrived.
        if (cancelled || stateFetchContext.current !== context) {
          return;
        }
        setStateSubdivisions(subs);
      } catch (error) {
        if (cancelled || stateFetchContext.current !== context) {
          return;
        }
        logger.error('Failed to load state subdivisions', {
          event: 'address_block_state_load_error',
          countryId: context,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Empty list → fall back to free-text input
        setStateSubdivisions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, token]);

  // Load county subdivisions whenever the state changes (and only when the
  // county piece is enabled and the current state value is a UUID).
  useEffect(() => {
    const stateValue = value.state;
    const countyConfig = config.county;
    if (!countyConfig?.enabled || !stateValue || !isUuid(stateValue)) {
      setCountySubdivisions(null);
      return;
    }
    const context = stateValue;
    countyFetchContext.current = context;
    let cancelled = false;
    (async () => {
      try {
        const subs = await doFetchSubdivisions(context);
        if (cancelled || countyFetchContext.current !== context) {
          return;
        }
        setCountySubdivisions(subs);
      } catch (error) {
        if (cancelled || countyFetchContext.current !== context) {
          return;
        }
        logger.error('Failed to load county subdivisions', {
          event: 'address_block_county_load_error',
          stateId: context,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        setCountySubdivisions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.state, config.county?.enabled, token]);

  // Address-completion detection (Phase 6 Stage 3 Critical #1, spec Business
  // Rule #10 + DoD #24). The block is "complete" when each enabled subdivision
  // level either has a value or has no further subdivisions to choose from.
  // The most-specific subregion id is the deepest UUID-shaped value (county >
  // state > null). We dedupe firings against `lastAddressCompleteFire` so we
  // don't re-fire on every re-render once the candidate has reached completion.
  const lastAddressCompleteFire = useRef<string | null>(null);
  useEffect(() => {
    if (!onAddressComplete || !countryId) return;
    const stateValue = value.state;
    const countyValue = value.county;
    // Wait until the state-subdivisions list has loaded — null means we
    // haven't heard back from the server yet, so we don't know whether the
    // country has subdivisions.
    if (stateSubdivisions === null) return;
    const stateHasSubdivisions = stateSubdivisions.length > 0;
    // State piece readiness: either subdivisions don't exist (free-text mode,
    // any value or none counts as resolved at the country level), or a value
    // has been chosen.
    const stateReady = !stateHasSubdivisions || (typeof stateValue === 'string' && stateValue.length > 0);
    if (!stateReady) return;

    const countyConfig = config.county;
    let countyReady = true;
    let mostSpecific: string | null = null;
    if (stateHasSubdivisions && isUuid(stateValue)) {
      mostSpecific = stateValue;
    }
    if (countyConfig?.enabled && isUuid(stateValue)) {
      // County is meaningful only when state is a UUID (the county lookup
      // hangs off the state row). When state is free-text we treat county as
      // not applicable.
      if (countySubdivisions === null) {
        // County subdivisions still loading — wait.
        return;
      }
      const countyHasSubdivisions = countySubdivisions.length > 0;
      countyReady = !countyHasSubdivisions || (typeof countyValue === 'string' && countyValue.length > 0);
      if (countyReady && countyHasSubdivisions && isUuid(countyValue)) {
        mostSpecific = countyValue;
      }
    }
    if (!countyReady) return;

    // Dedupe: only fire when the most-specific value has changed since last fire.
    const fireKey = mostSpecific ?? '<null>';
    if (lastAddressCompleteFire.current === fireKey) return;
    lastAddressCompleteFire.current = fireKey;
    onAddressComplete(mostSpecific);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    countryId,
    value.state,
    value.county,
    stateSubdivisions,
    countySubdivisions,
    config.county?.enabled,
  ]);

  const setPiece = (piece: keyof AddressBlockValue, next: AddressBlockValue[keyof AddressBlockValue]) => {
    onChange({ ...value, [piece]: next });
  };

  // Resolve the label for a piece: addressConfig label > translation key > piece name.
  const labelFor = (piece: AddressPieceKey, pieceConfig: AddressConfigPiece): string => {
    if (pieceConfig.label) return pieceConfig.label;
    const translated = t(PIECE_TRANSLATION_KEYS[piece]);
    if (translated && translated !== PIECE_TRANSLATION_KEYS[piece]) return translated;
    return piece;
  };

  // Asterisk shown only when BOTH the parent address_block field is required
  // (`isRequired`) AND the sub-piece is required (`addressConfig[piece].required`),
  // per COMPONENT_STANDARDS.md Section 3.3. Phase 6 Stage 3 rework Critical #2:
  // the prior expression `pieceRequired && (isRequired || true)` was a tautology
  // (the right-hand side always evaluates to true). Phase 6 Stage 2 (commit
  // be894bf) wired the `isRequired` flag through DSX uniformly, so the original
  // intent — respect the parent flag — is now safe to restore.
  const renderAsterisk = (pieceRequired: boolean) =>
    pieceRequired && isRequired ? (
      <span className="text-red-500 ml-1 required-indicator">*</span>
    ) : null;

  // Build the list of pieces to render, in display order, filtered by enabled.
  const pieceOrder: AddressPieceKey[] = [
    'street1',
    'street2',
    'city',
    'state',
    'county',
    'postalCode',
  ];

  return (
    <div className="space-y-3 address-block">
      {pieceOrder.map((piece) => {
        const pieceConfig = config[piece];
        if (!pieceConfig?.enabled) return null;

        const label = labelFor(piece, pieceConfig);
        const fieldId = `address-${requirementId}-${piece}`;
        const required = pieceConfig.required;

        if (piece === 'state') {
          // Dropdown when subdivisions exist; free-text when they don't.
          const hasSubdivisions = stateSubdivisions !== null && stateSubdivisions.length > 0;
          if (hasSubdivisions && stateSubdivisions) {
            return (
              <div key={piece} className="space-y-2">
                <Label htmlFor={fieldId}>
                  {label}
                  {renderAsterisk(required)}
                </Label>
                <Select
                  value={typeof value.state === 'string' ? value.state : ''}
                  onValueChange={(next) => {
                    // Changing state clears any county selection because the
                    // available counties depend on the chosen state.
                    onChange({ ...value, state: next, county: undefined });
                  }}
                  disabled={locked}
                >
                  <SelectTrigger
                    id={fieldId}
                    className="min-h-[44px] text-base"
                    onBlur={onBlur}
                    data-testid={fieldId}
                  >
                    <SelectValue placeholder={t('candidate.addressBlock.selectState')} />
                  </SelectTrigger>
                  <SelectContent>
                    {stateSubdivisions.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          // Free-text fallback (no subdivisions in DB or country not selected yet)
          return (
            <div key={piece} className="space-y-2">
              <Label htmlFor={fieldId}>
                {label}
                {renderAsterisk(required)}
              </Label>
              <Input
                id={fieldId}
                type="text"
                value={typeof value.state === 'string' ? value.state : ''}
                onChange={(e) => setPiece('state', e.target.value)}
                onBlur={onBlur}
                disabled={locked}
                className="min-h-[44px] text-base"
                data-testid={fieldId}
              />
            </div>
          );
        }

        if (piece === 'county') {
          const hasSubdivisions = countySubdivisions !== null && countySubdivisions.length > 0;
          if (hasSubdivisions && countySubdivisions) {
            return (
              <div key={piece} className="space-y-2">
                <Label htmlFor={fieldId}>
                  {label}
                  {renderAsterisk(required)}
                </Label>
                <Select
                  value={typeof value.county === 'string' ? value.county : ''}
                  onValueChange={(next) => setPiece('county', next)}
                  disabled={locked}
                >
                  <SelectTrigger
                    id={fieldId}
                    className="min-h-[44px] text-base"
                    onBlur={onBlur}
                    data-testid={fieldId}
                  >
                    <SelectValue placeholder={t('candidate.addressBlock.selectCounty')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countySubdivisions.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          return (
            <div key={piece} className="space-y-2">
              <Label htmlFor={fieldId}>
                {label}
                {renderAsterisk(required)}
              </Label>
              <Input
                id={fieldId}
                type="text"
                value={typeof value.county === 'string' ? value.county : ''}
                onChange={(e) => setPiece('county', e.target.value)}
                onBlur={onBlur}
                disabled={locked}
                className="min-h-[44px] text-base"
                data-testid={fieldId}
              />
            </div>
          );
        }

        // street1, street2, city, postalCode — plain text inputs
        const stringValue = typeof value[piece] === 'string' ? (value[piece] as string) : '';
        return (
          <div key={piece} className="space-y-2">
            <Label htmlFor={fieldId}>
              {label}
              {renderAsterisk(required)}
            </Label>
            <Input
              id={fieldId}
              type="text"
              value={stringValue}
              onChange={(e) => setPiece(piece, e.target.value)}
              onBlur={onBlur}
              disabled={locked}
              className="min-h-[44px] text-base"
              data-testid={fieldId}
            />
          </div>
        );
      })}

      {/* Date pieces — Address History only (showDates=true). Stored nested
          inside the address_block JSON value per spec Business Rule #5. */}
      {showDates && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`address-${requirementId}-fromDate`}>
              {t('candidate.addressHistory.fromDate')}
              <span className="text-red-500 ml-1 required-indicator">*</span>
            </Label>
            <Input
              id={`address-${requirementId}-fromDate`}
              type="date"
              value={typeof value.fromDate === 'string' ? value.fromDate : ''}
              onChange={(e) => setPiece('fromDate', e.target.value || null)}
              onBlur={onBlur}
              disabled={locked}
              className="min-h-[44px] text-base"
              data-testid={`address-${requirementId}-fromDate`}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id={`address-${requirementId}-isCurrent`}
              checked={value.isCurrent === true}
              onCheckedChange={(checked) => {
                // When the candidate marks this as their current address,
                // clear any toDate (the section enforces only one current
                // address; that's handled by the parent in handleEntryChange).
                if (checked === true) {
                  onChange({ ...value, isCurrent: true, toDate: null });
                } else {
                  onChange({ ...value, isCurrent: false });
                }
                onBlur?.();
              }}
              disabled={locked}
              className="min-w-[44px] min-h-[44px]"
            />
            <Label
              htmlFor={`address-${requirementId}-isCurrent`}
              className="cursor-pointer"
            >
              {t('candidate.addressHistory.currentAddress')}
            </Label>
          </div>

          {value.isCurrent !== true && (
            <div className="space-y-2">
              <Label htmlFor={`address-${requirementId}-toDate`}>
                {t('candidate.addressHistory.toDate')}
                <span className="text-red-500 ml-1 required-indicator">*</span>
              </Label>
              <Input
                id={`address-${requirementId}-toDate`}
                type="date"
                value={typeof value.toDate === 'string' ? value.toDate : ''}
                onChange={(e) => setPiece('toDate', e.target.value || null)}
                onBlur={onBlur}
                disabled={locked}
                className="min-h-[44px] text-base"
                data-testid={`address-${requirementId}-toDate`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
