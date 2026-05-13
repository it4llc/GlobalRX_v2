// /GlobalRX_v2/src/types/candidate-address.ts
//
// Types for the Phase 6 Stage 3 Address History section and the reusable
// address block input. These shapes are shared between the candidate UI,
// the candidate save/saved-data API routes, and the order-data hydration
// service that renders submitted addresses on the Order Details page.
//
// New types here are defined explicitly (not via z.infer) because the
// canonical Zod schemas live next to their route handlers per the project's
// existing convention (see src/app/api/candidate/application/[token]/save/route.ts).
// The route-local schemas mirror these shapes one-for-one.

import type { FieldMetadata, DocumentMetadata } from '@/types/candidate-portal';
import type { RepeatableFieldValue } from '@/types/candidate-repeatable-form';

/**
 * The six possible address piece keys, in display order.
 * Matches the keys in AddressBlockConfig from address-block-configurator.tsx
 * and the ADDRESS_PIECE_KEYS constant in order-data-resolvers.ts.
 */
export type AddressPieceKey =
  | 'street1'
  | 'street2'
  | 'city'
  | 'state'
  | 'county'
  | 'postalCode';

/**
 * One piece's configuration inside a DSX address_block field's addressConfig.
 *
 * `enabled` controls whether the piece renders at all.
 * `required` controls whether the asterisk indicator shows AND whether
 *   non-empty validation runs.
 * `label` overrides the default translation-driven label for the piece.
 */
export interface AddressConfigPiece {
  enabled: boolean;
  label: string;
  required: boolean;
}

/**
 * The full addressConfig blob from dsx_requirements.fieldData.addressConfig.
 * Each of the six pieces has its own configuration. When the blob is missing
 * entirely from a DSX field, the AddressBlockInput component falls back to
 * the safe defaults documented in the Stage 3 spec (Default addressConfig
 * Fallback section): street1 required, street2 optional, city required,
 * state required, postalCode required, county disabled.
 */
export type AddressConfig = Record<AddressPieceKey, AddressConfigPiece>;

/**
 * The JSON object stored as the value of an address_block field on a
 * candidate's saved entry. Address-history entries also include the
 * fromDate/toDate/isCurrent properties nested inside this same object —
 * dates are NOT stored as separate DSX requirements (per spec Business
 * Rule #5). Education and Employment address blocks do not include dates.
 *
 * For state and county:
 *   - When the candidate selected from a subdivision dropdown, the value
 *     is a UUID pointing at the corresponding `countries` row.
 *   - When no subdivisions exist for the country/state and the candidate
 *     typed a free-text value, the value is the raw string. The hydration
 *     layer detects which case applies via UUID format check.
 *
 * Date strings are ISO YYYY-MM-DD when present.
 */
export interface AddressBlockValue {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  county?: string;
  postalCode?: string;
  fromDate?: string | null;
  toDate?: string | null;
  isCurrent?: boolean;
}

/**
 * Shape of one row returned by the new GET /subdivisions endpoint.
 * Mirrors the candidate-side /countries response shape — both endpoints
 * read from the same `countries` table.
 */
export interface SubdivisionItem {
  id: string;
  name: string;
  code2: string | null;
}

/**
 * One item rendered inside the AggregatedRequirements area below the
 * address entries. Built client-side in AddressHistorySection by walking
 * every entry's loaded fields, deduplicating by `requirementId`, and
 * OR-merging `isRequired` across entries (most restrictive wins, per spec
 * Business Rule #20).
 *
 * The `serviceTypeOrder` and `displayOrder` fields are sort keys only —
 * neither is shown to the candidate. `serviceTypeOrder` uses the same
 * fixed ordering as the structure endpoint
 * (['verification-idv', 'record', 'verification-edu', 'verification-emp']).
 */
export interface AggregatedRequirementItem {
  requirementId: string;
  name: string;
  dataType: string;
  type: 'field' | 'document';
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata | null;
  documentData?: DocumentMetadata | null;
  serviceTypeOrder: number;
  displayOrder: number;
}

/**
 * Per-entry shape inside the address-history entries array. Matches the
 * existing EntryData shape used by Education / Employment in Stage 2;
 * the only difference is that address_block field values may be
 * AddressBlockValue JSON objects (covered by the widened
 * RepeatableFieldValue union).
 */
export interface AddressHistoryEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{
    requirementId: string;
    value: RepeatableFieldValue;
  }>;
}

/**
 * The full saved-section shape for address_history. Keys mirror the spec's
 * Auto-Save Data Shape section. `aggregatedFields` is keyed by
 * dsx_requirements.id (UUID). Document requirements have NO entries here
 * in Stage 3 — they are tracked only as "which are required" until Stage 4
 * delivers the upload UI.
 */
export interface AddressHistorySectionSavedData {
  sectionType: 'address_history';
  entries: AddressHistoryEntry[];
  aggregatedFields: Record<string, RepeatableFieldValue>;
}
