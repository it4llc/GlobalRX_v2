// src/lib/services/order-data-hydration.service.ts
//
// Central hydration service for OrderData records.
// Takes raw database rows and returns display-ready objects with
// resolved labels, formatted addresses, and parsed document metadata.
//
// This is the single source of truth for transforming OrderData
// into something a UI component can render. No display component
// should perform its own lookups, joins, or UUID resolution.
//
// Called by: API routes that return order details
// Uses:     src/lib/services/order-data-resolvers.ts
// Types:    src/types/order-data-hydration.ts
//
// MULTI-FORMAT SUPPORT (Phase 1):
// OrderData.fieldName can store three formats depending on when the
// order was created:
//   1. UUID  → references dsx_requirements.id  (newest orders)
//   2. fieldKey → matches dsx_requirements.fieldKey (e.g. "firstName", "ddfba175abf341c4")
//   3. Plain label → already human-readable (e.g. "Company Address") (oldest orders)
// The hydration service detects the format and routes the lookup accordingly.

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { getTranslations } from '@/lib/i18n/translations';
import { defaultLocale } from '@/lib/i18n/config';
import {
  resolveAddressValue,
  resolveDocumentValue,
  collectGeographicUuids,
} from './order-data-resolvers';
import type {
  RawOrderDataRecord,
  HydratedOrderDataRecord,
} from '@/types/order-data-hydration';

// ---------------------------------------------------------------------------
// UUID detection helper
// ---------------------------------------------------------------------------

/** Standard UUID v4 pattern used to distinguish fieldName formats. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the string is a standard UUID (v4 with dashes).
 * Used to decide whether to look up by dsx_requirements.id or .fieldKey.
 */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Translation key pattern
// ---------------------------------------------------------------------------

/**
 * Build the translation key for a given fieldKey.
 * Pattern: module.fulfillment.{fieldKey}
 *
 * Example: fieldKey "middleName" → key "module.fulfillment.middleName"
 */
function buildTranslationKey(fieldKey: string): string {
  return `module.fulfillment.${fieldKey}`;
}

// ---------------------------------------------------------------------------
// Main Hydration Function
// ---------------------------------------------------------------------------

/**
 * Hydrate raw OrderData records into display-ready objects.
 *
 * This is the main entry point. It:
 *   1. Batch-fetches all referenced dsx_requirements in one or two queries
 *      (by id for UUID fieldNames, by fieldKey for non-UUID fieldNames)
 *   2. Loads the translation file for the requested language
 *   3. Batch-fetches all geographic UUIDs from address fields in one query
 *   4. Resolves each record through the label fallback chain and
 *      the appropriate value resolver
 *
 * @param records      - Raw OrderData rows from the database
 * @param languageCode - The user's language preference (defaults to en-US)
 * @returns Array of hydrated records ready for display
 */
export async function hydrateOrderData(
  records: RawOrderDataRecord[],
  languageCode: string = defaultLocale
): Promise<HydratedOrderDataRecord[]> {
  if (records.length === 0) {
    return [];
  }

  // -------------------------------------------------------------------------
  // Step 1: Batch-fetch all referenced dsx_requirements
  // -------------------------------------------------------------------------
  // OrderData.fieldName can be a UUID (references dsx_requirements.id) or a
  // non-UUID string (matches dsx_requirements.fieldKey or is a plain label).
  // We split them and query each group appropriately.

  const uniqueFieldNames = [...new Set(records.map(r => r.fieldName))];
  const uuidFieldNames: string[] = [];
  const nonUuidFieldNames: string[] = [];

  for (const fn of uniqueFieldNames) {
    if (isUuid(fn)) {
      uuidFieldNames.push(fn);
    } else {
      nonUuidFieldNames.push(fn);
    }
  }

  // Map keyed by the original fieldName value so the main loop can do a
  // simple get(record.fieldName) regardless of which lookup found it.
  let requirementsMap: Map<string, DsxRequirementRow> = new Map();

  try {
    const selectFields = {
      id: true,
      name: true,
      type: true,
      fieldKey: true,
      fieldData: true,
      documentData: true,
    } as const;

    // Batch 1: UUID fieldNames → look up by dsx_requirements.id
    if (uuidFieldNames.length > 0) {
      const byId = await prisma.dSXRequirement.findMany({
        where: { id: { in: uuidFieldNames } },
        select: selectFields,
      });
      for (const r of byId) {
        requirementsMap.set(r.id, r);
      }
    }

    // Batch 2: Non-UUID fieldNames → look up by dsx_requirements.fieldKey
    if (nonUuidFieldNames.length > 0) {
      const byFieldKey = await prisma.dSXRequirement.findMany({
        where: { fieldKey: { in: nonUuidFieldNames } },
        select: selectFields,
      });
      for (const r of byFieldKey) {
        // Key by fieldKey since that's what record.fieldName contains
        requirementsMap.set(r.fieldKey, r);
      }
    }
  } catch (error) {
    logger.error('Failed to fetch dsx_requirements for hydration', {
      error: error instanceof Error ? error.message : 'Unknown error',
      uuidCount: uuidFieldNames.length,
      fieldKeyCount: nonUuidFieldNames.length,
    });
    // Return minimally hydrated records so the UI still shows something
    return records.map(r => buildFallbackRecord(r));
  }

  // -------------------------------------------------------------------------
  // Step 2: Load translations for the requested language
  // -------------------------------------------------------------------------

  let translations: Record<string, string>;
  try {
    translations = await getTranslations(languageCode);
  } catch (error) {
    logger.warn('Failed to load translations for hydration, labels will use DataRx names', {
      error: error instanceof Error ? error.message : 'Unknown error',
      languageCode,
    });
    translations = {};
  }

  // -------------------------------------------------------------------------
  // Step 3: Batch-fetch geographic names for address fields
  // -------------------------------------------------------------------------

  // Find all address_block records so we can collect their geographic UUIDs
  const addressRawValues: string[] = [];
  for (const record of records) {
    const req = requirementsMap.get(record.fieldName);
    if (req && getDataType(req) === 'address_block') {
      addressRawValues.push(record.fieldValue);
    }
  }

  const geoUuids = collectGeographicUuids(addressRawValues);
  const geoNameMap = new Map<string, string>();

  if (geoUuids.size > 0) {
    try {
      const geoRows = await prisma.country.findMany({
        where: { id: { in: [...geoUuids] } },
        select: { id: true, name: true },
      });
      for (const row of geoRows) {
        geoNameMap.set(row.id, row.name);
      }
    } catch (error) {
      logger.warn('Failed to fetch geographic names for address resolution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        uuidCount: geoUuids.size,
      });
      // Addresses will show raw UUIDs for state/county — not ideal but not broken
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Hydrate each record
  // -------------------------------------------------------------------------

  const hydrated: HydratedOrderDataRecord[] = [];

  for (const record of records) {
    const req = requirementsMap.get(record.fieldName);

    if (!req) {
      // Not found via id or fieldKey lookup.
      // Try translation as a last-chance label lookup using fieldName as a
      // potential fieldKey (handles edge cases where the requirement was
      // deleted but the translation still exists).
      const translationKey = buildTranslationKey(record.fieldName);
      if (translations[translationKey]) {
        hydrated.push({
          requirementId: record.fieldName,
          label: translations[translationKey],
          fieldKey: record.fieldName,
          dataType: 'unknown',
          requirementType: 'field',
          rawValue: record.fieldValue,
          displayValue: record.fieldValue,
        });
      } else {
        logger.warn('OrderData references unknown dsx_requirement', {
          orderDataId: record.id,
          fieldName: record.fieldName,
        });
        hydrated.push(buildFallbackRecord(record));
      }
      continue;
    }

    // Resolve the label through the fallback chain:
    //   1. Translation lookup → 2. DataRx name → 3. "Unknown field"
    const translationKey = buildTranslationKey(req.fieldKey);
    const label =
      translations[translationKey] ||
      req.name ||
      'Unknown field';

    const dataType = getDataType(req);
    const requirementType = (req.type === 'document' ? 'document' : 'field') as 'field' | 'document';

    // Base record fields shared by all types
    const base: HydratedOrderDataRecord = {
      requirementId: req.id,
      label,
      fieldKey: req.fieldKey,
      dataType,
      requirementType,
      rawValue: record.fieldValue,
      displayValue: record.fieldValue, // default — overridden below for special types
    };

    // Delegate to the appropriate value resolver
    if (dataType === 'address_block') {
      const addressConfig = getAddressConfig(req);
      const resolved = resolveAddressValue(record.fieldValue, addressConfig, geoNameMap);
      base.displayValue = resolved.displayValue;
      base.addressPieces = resolved.addressPieces;
    } else if (requirementType === 'document') {
      const resolved = resolveDocumentValue(record.fieldValue);
      base.displayValue = resolved.displayValue;
      base.document = resolved.document;
    }
    // For all other types (text, date, number, etc.): displayValue stays as rawValue

    hydrated.push(base);
  }

  return hydrated;
}

// ---------------------------------------------------------------------------
// Helper: Extract dataType from a dsx_requirement row
// ---------------------------------------------------------------------------

/**
 * Get the dataType string from a dsx_requirement's fieldData JSON.
 * Returns 'unknown' if fieldData is missing or doesn't have a dataType.
 */
function getDataType(req: DsxRequirementRow): string {
  if (req.type === 'document') {
    return 'document';
  }
  const fieldData = req.fieldData as Record<string, unknown> | null;
  if (fieldData && typeof fieldData.dataType === 'string') {
    return fieldData.dataType;
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helper: Extract addressConfig from a dsx_requirement row
// ---------------------------------------------------------------------------

/**
 * Get the addressConfig object from a dsx_requirement's fieldData JSON.
 * Returns null if missing — the address resolver will use default labels.
 */
function getAddressConfig(req: DsxRequirementRow): Record<string, { enabled: boolean; label: string; required: boolean }> | null {
  const fieldData = req.fieldData as Record<string, unknown> | null;
  if (fieldData && typeof fieldData.addressConfig === 'object' && fieldData.addressConfig !== null) {
    return fieldData.addressConfig as Record<string, { enabled: boolean; label: string; required: boolean }>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: Build a fallback record when dsx_requirements lookup fails
// ---------------------------------------------------------------------------

/**
 * Create a minimal hydrated record when we can't find the matching
 * dsx_requirement. The label is chosen based on the fieldName format:
 *
 *   - UUID → "Unknown field" (the UUID is meaningless to the user)
 *   - Hex-only fragment (≥8 chars) → "Unknown field" (auto-generated fieldKey, not readable)
 *   - Anything else → use fieldName itself as the label (e.g., "Company Address" from old data)
 *
 * This ensures data is never hidden from the user.
 */
function buildFallbackRecord(record: RawOrderDataRecord): HydratedOrderDataRecord {
  const fn = record.fieldName;

  // UUIDs are not readable labels
  const isUuidValue = UUID_PATTERN.test(fn);
  // Hex-only fragments like "ddfba175abf341c4" are auto-generated fieldKeys — not readable
  const isHexFragment = !isUuidValue && /^[0-9a-f]+$/i.test(fn) && fn.length >= 8;

  const label = (isUuidValue || isHexFragment) ? 'Unknown field' : fn;

  return {
    requirementId: fn,
    label,
    fieldKey: '',
    dataType: 'unknown',
    requirementType: 'field',
    rawValue: record.fieldValue,
    displayValue: record.fieldValue,
  };
}

// ---------------------------------------------------------------------------
// Internal type for dsx_requirement query results
// ---------------------------------------------------------------------------

/**
 * Shape of a dsx_requirement row as returned by our Prisma select.
 * Only includes the columns we need for hydration.
 */
interface DsxRequirementRow {
  id: string;
  name: string;
  type: string;
  fieldKey: string;
  fieldData: unknown;
  documentData: unknown;
}