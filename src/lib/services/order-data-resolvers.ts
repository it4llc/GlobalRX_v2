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
 */
const DEFAULT_ADDRESS_LABELS: Record<string, string> = {
  street1: 'Street Address',
  street2: 'Apt/Suite',
  city: 'City',
  state: 'State/Province',
  county: 'County',
  postalCode: 'ZIP/Postal Code',
};

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
  // Step 1: Parse the JSON
  let parsed: Record<string, string>;
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

    // Get the raw value for this piece
    const rawValue = parsed[key];
    if (!rawValue || rawValue.trim() === '') {
      continue; // Skip empty pieces
    }

    // Resolve the display value
    let resolvedValue: string;
    if (GEOGRAPHIC_KEYS.has(key)) {
      // WHY: Newer orders store pre-resolved names ("Northern Territory") while
      // older orders store UUIDs. We check if it's a UUID before attempting lookup
      // to handle both formats transparently. This backward compatibility was
      // discovered during Phase 1 implementation when testing with mixed-age data.
      const lookedUp = geoNameMap.get(rawValue);
      if (lookedUp) {
        resolvedValue = lookedUp;
      } else {
        // UUID not found in our map — use raw value and log a warning
        logger.warn('Geographic UUID not found in countries lookup', {
          key,
          uuid: rawValue,
        });
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
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  for (const rawJson of rawJsonValues) {
    try {
      const parsed: Record<string, string> = JSON.parse(rawJson);
      for (const key of GEOGRAPHIC_KEYS) {
        const value = parsed[key];
        if (value && UUID_PATTERN.test(value)) {
          uuids.add(value);
        }
      }
    } catch {
      // Skip unparseable values — resolveAddressValue will handle the error
    }
  }

  return uuids;
}