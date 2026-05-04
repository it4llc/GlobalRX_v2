// src/lib/services/order-data-resolvers.ts
//
// Value resolvers for the OrderData hydration system.
// These handle the type-specific parsing of OrderData.fieldValue
// for address blocks and document entries.
//
// Called by: src/lib/services/order-data-hydration.service.ts
// Types:    src/types/order-data-hydration.ts

import logger from '@/lib/logger';
import type { AddressPiece, DocumentMetadata } from '@/types/order-data-hydration';

// ---------------------------------------------------------------------------
// Address Resolver
// ---------------------------------------------------------------------------

/**
 * The six possible address piece keys, in display order.
 * Matches the keys in AddressBlockConfig from address-block-configurator.tsx.
 */
const ADDRESS_PIECE_KEYS = [
  'street1',
  'street2',
  'city',
  'state',
  'county',
  'postalCode',
] as const;

/**
 * Keys whose values may be UUIDs pointing to the countries table.
 * These need to be resolved to human-readable names (e.g., UUID → "Queensland").
 */
const GEOGRAPHIC_KEYS = new Set(['state', 'county']);

/**
 * Default labels used when addressConfig is missing from the dsx_requirements
 * fieldData. This shouldn't normally happen, but we degrade gracefully.
 *
 * Phase 6 Stage 3 added `fromDate` / `toDate` defaults for Address History
 * date pieces, which are stored nested inside the address_block JSON value
 * (per spec Business Rule #5) rather than as separate DSX requirements.
 * The hydration service appends these pieces to the display output after
 * the standard address pieces.
 */
const DEFAULT_ADDRESS_LABELS: Record<string, string> = {
  street1: 'Street Address',
  street2: 'Apt/Suite',
  city: 'City',
  state: 'State/Province',
  county: 'County',
  postalCode: 'ZIP/Postal Code',
  fromDate: 'From',
  toDate: 'To',
};

/**
 * Standard UUID v4-shaped pattern. Used by the address resolver to decide
 * whether a `state` or `county` value should be looked up in the geoNameMap
 * (UUID — older saved data and dropdown selections from countries with
 * subdivisions) or displayed as-is (Phase 6 Stage 3 — free-text typed by the
 * candidate when no subdivisions exist for the country).
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format an ISO date string (YYYY-MM-DD or full ISO) into a human-readable
 * "Month D, YYYY" string for display on the Order Details page. Falls back
 * to the raw value if parsing fails so we never lose information.
 */
function formatAddressDate(rawDate: string): string {
  // Accept "YYYY-MM-DD" by appending T00:00:00 so JS doesn't treat the
  // bare date as UTC midnight (which can render as the previous day in
  // negative UTC offsets). For full ISO strings the appended suffix is
  // ignored because Date.parse stops at the first valid format match.
  const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
  const candidate = isBareDate ? `${rawDate}T00:00:00` : rawDate;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }
  // Use the en-US locale so we get a stable display format regardless of
  // server locale. The Order Details page is internal-user-facing today
  // and the existing labels in this file are already English-only constants.
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Shape of one piece within an addressConfig object from dsx_requirements.fieldData.
 * Example: { enabled: true, label: "State/Province", required: true }
 */
interface AddressConfigPiece {
  enabled: boolean;
  label: string;
  required: boolean;
}

/**
 * The addressConfig object from dsx_requirements.fieldData.
 * Each key maps to its configuration.
 */
type AddressConfig = Record<string, AddressConfigPiece>;

/**
 * Result returned by resolveAddressValue.
 */
interface AddressResolverResult {
  /** Comma-separated summary of all resolved values (fallback display) */
  displayValue: string;
  /** Individual address pieces with labels, for labeled-line display */
  addressPieces: AddressPiece[];
}

/**
 * Resolve an address_block value into display-ready pieces.
 *
 * @param rawJson       - The raw JSON string from OrderData.fieldValue
 * @param addressConfig - The addressConfig object from dsx_requirements.fieldData.
 *                        May be null/undefined if the config is missing.
 * @param geoNameMap    - Pre-fetched map of geographic UUID → human-readable name.
 *                        Built by the hydration service from a batch countries query.
 *                        Example: { "f53e7f72-...": "Queensland" }
 * @returns Resolved address pieces and a summary display value
 */
export function resolveAddressValue(
  rawJson: string,
  addressConfig: AddressConfig | null | undefined,
  geoNameMap: Map<string, string>
): AddressResolverResult {
  // Step 1: Parse the JSON.
  // The piece values (street1/city/state/county/postalCode) are strings, but
  // Phase 6 Stage 3 added optional dates (string) and isCurrent (boolean)
  // nested inside the same object for Address History entries. We type the
  // parsed record loosely to accept all three primitive shapes and narrow at
  // the use site.
  let parsed: Record<string, string | boolean | null | undefined>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    logger.warn('Failed to parse address JSON, returning raw value', {
      error: error instanceof Error ? error.message : 'Unknown error',
      rawValuePreview: rawJson.substring(0, 100),
    });
    return {
      displayValue: rawJson,
      addressPieces: [],
    };
  }

  // Step 2: Walk through each address piece in display order
  const pieces: AddressPiece[] = [];
  const summaryParts: string[] = [];

  for (const key of ADDRESS_PIECE_KEYS) {
    // Check if this piece is enabled in the config
    // If no config exists, include all pieces that have values
    const config = addressConfig?.[key];
    if (config && !config.enabled) {
      continue; // Skip disabled pieces
    }

    // Get the raw value for this piece. We only render strings as address
    // pieces — the other primitive shapes (boolean isCurrent, null, etc.)
    // are handled separately in the date block below.
    const rawValueAny = parsed[key];
    if (typeof rawValueAny !== 'string') {
      continue;
    }
    const rawValue = rawValueAny;
    if (!rawValue || rawValue.trim() === '') {
      continue; // Skip empty pieces
    }

    // Resolve the display value
    let resolvedValue: string;
    if (GEOGRAPHIC_KEYS.has(key)) {
      // Phase 6 Stage 3: detect free-text vs UUID values. When a country has
      // no subdivisions in the database, the AddressBlockInput component
      // falls back to a text input and the candidate types a plain string.
      // That string is NOT a UUID and should be displayed as-is — looking it
      // up in the geoNameMap and warning on miss would be noisy and
      // misleading. Only when the value matches the UUID format do we
      // attempt the lookup (and log on miss as before).
      if (UUID_PATTERN.test(rawValue)) {
        const lookedUp = geoNameMap.get(rawValue);
        if (lookedUp) {
          resolvedValue = lookedUp;
        } else {
          // UUID-shaped value not found in our map — use raw value and log
          // a warning. This catches stale references (a subdivision row
          // renamed or disabled after the candidate saved their data).
          logger.warn('Geographic UUID not found in countries lookup', {
            key,
            uuid: rawValue,
          });
          resolvedValue = rawValue;
        }
      } else {
        // Free-text value (e.g., "Pyongyang Province" entered by the
        // candidate in a country with no subdivisions). Display as-is.
        resolvedValue = rawValue;
      }
    } else {
      resolvedValue = rawValue;
    }

    // Get the label for this piece
    const label = config?.label
      ?? DEFAULT_ADDRESS_LABELS[key]
      ?? key;

    pieces.push({ key, label, value: resolvedValue });
    summaryParts.push(resolvedValue);
  }

  // Phase 6 Stage 3: append date pieces (fromDate / toDate / "Present") if
  // present in the stored value. These are NOT part of the addressConfig —
  // they are stored nested inside the address_block JSON for Address History
  // entries (per spec Business Rule #5). Education / Employment address
  // blocks have no date properties and skip this block entirely.
  const fromDateRaw = parsed.fromDate;
  const toDateRaw = parsed.toDate;
  const isCurrentRaw = parsed.isCurrent;
  // isCurrent may arrive as a real boolean (from current saves) or as a
  // string "true" / "false" if any older code path stringified it. Normalize.
  const isCurrent =
    isCurrentRaw === true ||
    (typeof isCurrentRaw === 'string' && isCurrentRaw === 'true');

  if (typeof fromDateRaw === 'string' && fromDateRaw.trim() !== '') {
    const formatted = formatAddressDate(fromDateRaw);
    pieces.push({ key: 'fromDate', label: DEFAULT_ADDRESS_LABELS.fromDate, value: formatted });
    summaryParts.push(formatted);
  }

  // toDate logic: show the actual date when present (even if isCurrent is
  // also set — if the candidate filled both, the actual date wins so we
  // never silently drop user-entered data). Show "Present" only when
  // isCurrent is true AND no toDate is set. Show nothing otherwise.
  if (typeof toDateRaw === 'string' && toDateRaw.trim() !== '') {
    const formatted = formatAddressDate(toDateRaw);
    pieces.push({ key: 'toDate', label: DEFAULT_ADDRESS_LABELS.toDate, value: formatted });
    summaryParts.push(formatted);
  } else if (isCurrent) {
    pieces.push({ key: 'toDate', label: DEFAULT_ADDRESS_LABELS.toDate, value: 'Present' });
    summaryParts.push('Present');
  }

  return {
    displayValue: summaryParts.join(', '),
    addressPieces: pieces,
  };
}

// ---------------------------------------------------------------------------
// Document Resolver
// ---------------------------------------------------------------------------

/**
 * Result returned by resolveDocumentValue.
 */
interface DocumentResolverResult {
  /** The human-readable filename for display */
  displayValue: string;
  /** Full parsed document metadata for download links and icons */
  document: DocumentMetadata;
}

/**
 * Resolve a document-type value into display-ready metadata.
 *
 * @param rawJson - The raw JSON string from OrderData.fieldValue
 *                  containing document metadata (originalName, storagePath, etc.)
 * @returns Resolved document metadata and display filename
 */
export function resolveDocumentValue(
  rawJson: string
): DocumentResolverResult {
  // Step 1: Parse the JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    logger.warn('Failed to parse document JSON, returning raw value', {
      error: error instanceof Error ? error.message : 'Unknown error',
      rawValuePreview: rawJson.substring(0, 100),
    });
    return {
      displayValue: rawJson,
      document: {
        filename: 'Unknown document',
        storagePath: '',
        mimeType: '',
        size: 0,
      },
    };
  }

  // Step 2: Extract filename with fallback chain
  //   originalName → filename → "Unknown document"
  const filename =
    (typeof parsed.originalName === 'string' && parsed.originalName) ||
    (typeof parsed.filename === 'string' && parsed.filename) ||
    'Unknown document';

  // Step 3: Extract other metadata with safe defaults
  const storagePath =
    typeof parsed.storagePath === 'string' ? parsed.storagePath : '';
  const mimeType =
    typeof parsed.mimeType === 'string' ? parsed.mimeType : '';
  const size =
    typeof parsed.size === 'number' ? parsed.size : 0;

  return {
    displayValue: filename,
    document: {
      filename,
      storagePath,
      mimeType,
      size,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: Extract geographic UUIDs from address data
// ---------------------------------------------------------------------------

/**
 * Scan raw address JSON values and collect all geographic UUIDs
 * that need to be resolved through the countries table.
 *
 * Called by the hydration service before resolveAddressValue so it can
 * batch-fetch all geographic lookups in a single database query.
 *
 * @param rawJsonValues - Array of raw JSON strings from address_block fields
 * @returns Set of UUID strings that need countries table lookup
 */
export function collectGeographicUuids(rawJsonValues: string[]): Set<string> {
  const uuids = new Set<string>();

  for (const rawJson of rawJsonValues) {
    try {
      // Same loose typing as resolveAddressValue's parsed shape — Address
      // History entries may have boolean/null nested keys, but only string
      // values matching the UUID format contribute geographic UUIDs.
      const parsed: Record<string, unknown> = JSON.parse(rawJson);
      for (const key of GEOGRAPHIC_KEYS) {
        const value = parsed[key];
        if (typeof value === 'string' && UUID_PATTERN.test(value)) {
          uuids.add(value);
        }
      }
    } catch {
      // Skip unparseable values — resolveAddressValue will handle the error
    }
  }

  return uuids;
}