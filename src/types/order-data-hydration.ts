// src/types/order-data-hydration.ts
//
// Type definitions for the OrderData hydration system.
// These define the shape of display-ready order data after
// raw database records are resolved through the hydration service.
//
// Used by:
//   - src/lib/services/order-data-hydration.service.ts (produces these)
//   - API routes returning order details (passes these to the client)
//   - Display components like OrderDetailsView.tsx (consumes these)

// ---------------------------------------------------------------------------
// Address Types
// ---------------------------------------------------------------------------

/**
 * One line of a resolved address.
 *
 * Example:
 *   { key: "city", label: "City", value: "Brisbane" }
 *
 * - `key`   — the address piece identifier (street1, city, state, etc.)
 * - `label` — the display label from addressConfig (e.g., "State/Province")
 * - `value` — the resolved human-readable value
 *             (for state/county, this is the name from the countries table,
 *              not the raw UUID)
 */
export interface AddressPiece {
  key: string;
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Document Types
// ---------------------------------------------------------------------------

/**
 * Parsed metadata for a document-type OrderData entry.
 *
 * Extracted from the JSON stored in OrderData.fieldValue.
 * Used to display a readable filename and (optionally) a download link.
 */
export interface DocumentMetadata {
  /** Human-readable filename (from originalName in the JSON) */
  filename: string;
  /** Server path for building a download link */
  storagePath: string;
  /** MIME type for icon display (e.g., "application/pdf") */
  mimeType: string;
  /** File size in bytes — display as "271 KB" etc. in the UI */
  size: number;
}

// ---------------------------------------------------------------------------
// Hydrated Record Types
// ---------------------------------------------------------------------------

/**
 * Base hydrated record — the common shape for every OrderData entry
 * after it has been resolved through the hydration service.
 *
 * Every hydrated record has these fields regardless of data type.
 */
export interface HydratedOrderDataRecord {
  /** The dsx_requirements UUID (original OrderData.fieldName value) */
  requirementId: string;
  /** Resolved display label via fallback chain:
   *  translation → dsx_requirements.name → "Unknown field" */
  label: string;
  /** The immutable fieldKey from dsx_requirements (e.g., "companyName") */
  fieldKey: string;
  /** Data type from fieldData.dataType (e.g., "text", "address_block", "date") */
  dataType: string;
  /** Whether this is a "field" or "document" in dsx_requirements.type */
  requirementType: 'field' | 'document';
  /** The original unmodified OrderData.fieldValue */
  rawValue: string;
  /** Formatted value ready for display:
   *  - text fields: same as rawValue
   *  - addresses: comma-joined summary of resolved pieces
   *  - documents: the filename (originalName) */
  displayValue: string;
  /** Present only for address_block fields — each enabled address piece
   *  with its label and resolved value, displayed as labeled lines */
  addressPieces?: AddressPiece[];
  /** Present only for document fields — parsed file metadata
   *  for display and download link */
  document?: DocumentMetadata;
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Check if a hydrated record is an address type (has addressPieces).
 *
 * Usage in components:
 *   if (isAddressRecord(record)) {
 *     // record.addressPieces is available
 *   }
 */
export function isAddressRecord(
  record: HydratedOrderDataRecord
): record is HydratedOrderDataRecord & { addressPieces: AddressPiece[] } {
  return record.dataType === 'address_block' && Array.isArray(record.addressPieces);
}

/**
 * Check if a hydrated record is a document type (has document metadata).
 *
 * Usage in components:
 *   if (isDocumentRecord(record)) {
 *     // record.document is available
 *   }
 */
export function isDocumentRecord(
  record: HydratedOrderDataRecord
): record is HydratedOrderDataRecord & { document: DocumentMetadata } {
  return record.requirementType === 'document' && record.document != null;
}

// ---------------------------------------------------------------------------
// Raw Input Type (what the hydration service receives)
// ---------------------------------------------------------------------------

/**
 * Shape of a raw OrderData row from Prisma, as input to the hydration service.
 * Matches the Prisma model exactly.
 */
export interface RawOrderDataRecord {
  id: string;
  orderItemId: string;
  fieldName: string;
  fieldValue: string;
  fieldType: string;
  createdAt: Date;
}