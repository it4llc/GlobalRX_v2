// src/lib/services/__tests__/order-data-hydration.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hydrateOrderData } from '../order-data-hydration.service';
import type { RawOrderDataRecord } from '@/types/order-data-hydration';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXRequirement: {
      findMany: vi.fn(),
    },
    country: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/i18n/translations', () => ({
  getTranslations: vi.fn(),
}));

vi.mock('@/lib/i18n/config', () => ({
  defaultLocale: 'en-US',
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { getTranslations } from '@/lib/i18n/translations';
import logger from '@/lib/logger';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const REQ_COMPANY_NAME_ID = '007a7957-92c0-4ec4-9a93-f5cd56260f10';
const REQ_COMPANY_ADDRESS_ID = '11111111-1111-1111-1111-111111111111';
const REQ_DOCUMENT_ID = '22222222-2222-2222-2222-222222222222';
const QUEENSLAND_UUID = 'f53e7f72-8bbe-4017-994a-499b681bfc70';

function makeRawRecord(overrides: Partial<RawOrderDataRecord> & { fieldName: string; fieldValue: string }): RawOrderDataRecord {
  return {
    id: 'record-' + Math.random().toString(36).substring(7),
    orderItemId: 'order-item-001',
    fieldType: 'text',
    createdAt: new Date('2026-04-16'),
    ...overrides,
  };
}

/** dsx_requirements rows returned by the mock */
function makeDsxRequirements() {
  return [
    {
      id: REQ_COMPANY_NAME_ID,
      name: 'Company Name',
      type: 'field',
      fieldKey: 'companyName',
      fieldData: { dataType: 'text', shortName: 'Company' },
      documentData: null,
    },
    {
      id: REQ_COMPANY_ADDRESS_ID,
      name: 'Company Address',
      type: 'field',
      fieldKey: 'companyAddress',
      fieldData: {
        dataType: 'address_block',
        addressConfig: {
          street1: { enabled: true, label: 'Street Address', required: true },
          street2: { enabled: true, label: 'Apt/Suite', required: false },
          city: { enabled: true, label: 'City', required: true },
          state: { enabled: true, label: 'State/Province', required: true },
          county: { enabled: false, label: 'County', required: false },
          postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
        },
      },
      documentData: null,
    },
    {
      id: REQ_DOCUMENT_ID,
      name: 'Copy of degree',
      type: 'document',
      fieldKey: '86d871feeb2142e0',
      fieldData: null,
      documentData: { scope: 'per_search', instructions: 'Upload a copy' },
    },
  ];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: dsx_requirements returns our test data
  vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValue(makeDsxRequirements() as any);

  // Default: countries table returns Queensland
  vi.mocked(prisma.country.findMany).mockResolvedValue([
    { id: QUEENSLAND_UUID, name: 'Queensland' },
  ] as any);

  // Default: translations with a key for companyName but NOT for the hex fieldKey
  vi.mocked(getTranslations).mockResolvedValue({
    'module.fulfillment.companyName': 'Company Name (translated)',
    'module.fulfillment.companyAddress': 'Company Address (translated)',
  });
});

// ===========================================================================
// Label Resolution
// ===========================================================================

describe('label resolution fallback chain', () => {
  it('uses translation when available', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Acme Corp' }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Company Name (translated)');
  });

  it('falls back to dsx_requirements.name when no translation exists', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_DOCUMENT_ID, fieldValue: '{}' }),
    ];

    // The hex fieldKey '86d871feeb2142e0' has no translation entry
    const result = await hydrateOrderData(records, 'en-US');

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Copy of degree');
  });

  it('falls back to "Unknown field" when dsx_requirement is not found', async () => {
    const orphanedUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const records = [
      makeRawRecord({ fieldName: orphanedUuid, fieldValue: 'some data' }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Unknown field');
    expect(result[0].displayValue).toBe('some data');
    expect(logger.warn).toHaveBeenCalledWith(
      'OrderData references unknown dsx_requirement',
      expect.objectContaining({ fieldName: orphanedUuid })
    );
  });

  it('passes the requested language code to getTranslations', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Test' }),
    ];

    await hydrateOrderData(records, 'ja-JP');

    expect(getTranslations).toHaveBeenCalledWith('ja-JP');
  });

  it('defaults to en-US when no language code is provided', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Test' }),
    ];

    await hydrateOrderData(records);

    expect(getTranslations).toHaveBeenCalledWith('en-US');
  });
});

// ===========================================================================
// Text Fields
// ===========================================================================

describe('text field hydration', () => {
  it('returns the raw value as displayValue for text fields', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Acme Corp' }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result[0].displayValue).toBe('Acme Corp');
    expect(result[0].rawValue).toBe('Acme Corp');
    expect(result[0].dataType).toBe('text');
    expect(result[0].requirementType).toBe('field');
    expect(result[0].fieldKey).toBe('companyName');
  });
});

// ===========================================================================
// Address Fields
// ===========================================================================

describe('address field hydration', () => {
  it('resolves address JSON with geographic UUID lookup', async () => {
    const addressJson = JSON.stringify({
      street1: '123 Main St',
      city: 'Brisbane',
      state: QUEENSLAND_UUID,
      postalCode: '4000',
    });
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_ADDRESS_ID, fieldValue: addressJson }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result[0].dataType).toBe('address_block');
    expect(result[0].addressPieces).toBeDefined();
    expect(result[0].addressPieces).toEqual([
      { key: 'street1', label: 'Street Address', value: '123 Main St' },
      { key: 'city', label: 'City', value: 'Brisbane' },
      { key: 'state', label: 'State/Province', value: 'Queensland' },
      { key: 'postalCode', label: 'ZIP/Postal Code', value: '4000' },
    ]);
    expect(result[0].displayValue).toBe('123 Main St, Brisbane, Queensland, 4000');
  });

  it('batch-fetches geographic UUIDs in a single query', async () => {
    const address1 = JSON.stringify({ state: QUEENSLAND_UUID });
    const address2 = JSON.stringify({ state: QUEENSLAND_UUID });
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_ADDRESS_ID, fieldValue: address1 }),
      makeRawRecord({ fieldName: REQ_COMPANY_ADDRESS_ID, fieldValue: address2 }),
    ];

    await hydrateOrderData(records, 'en-US');

    // countries.findMany should be called exactly once, not once per address
    expect(prisma.country.findMany).toHaveBeenCalledTimes(1);
  });

  it('skips countries query when no address fields exist', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Just text' }),
    ];

    await hydrateOrderData(records, 'en-US');

    expect(prisma.country.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Document Fields
// ===========================================================================

describe('document field hydration', () => {
  it('parses document JSON and extracts filename', async () => {
    const docJson = JSON.stringify({
      documentId: 'doc-uuid-123',
      filename: 'NPC-Checklist.pdf',
      originalName: 'NPC-Checklist.pdf',
      storagePath: 'uploads/draft-documents/abc/NPC-Checklist.pdf',
      mimeType: 'application/pdf',
      size: 276740,
      uploadedAt: '2026-03-25T20:03:56.049Z',
      uploadedBy: 'user-uuid-456',
    });
    const records = [
      makeRawRecord({ fieldName: REQ_DOCUMENT_ID, fieldValue: docJson }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result[0].displayValue).toBe('NPC-Checklist.pdf');
    expect(result[0].requirementType).toBe('document');
    expect(result[0].document).toBeDefined();
    expect(result[0].document?.filename).toBe('NPC-Checklist.pdf');
    expect(result[0].document?.storagePath).toBe('uploads/draft-documents/abc/NPC-Checklist.pdf');
    expect(result[0].document?.mimeType).toBe('application/pdf');
    expect(result[0].document?.size).toBe(276740);
  });
});

// ===========================================================================
// Mixed Records
// ===========================================================================

describe('mixed record types in one call', () => {
  it('handles text, address, and document records together', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Acme Corp' }),
      makeRawRecord({
        fieldName: REQ_COMPANY_ADDRESS_ID,
        fieldValue: JSON.stringify({
          street1: '123 Main St',
          city: 'Brisbane',
          state: QUEENSLAND_UUID,
          postalCode: '4000',
        }),
      }),
      makeRawRecord({
        fieldName: REQ_DOCUMENT_ID,
        fieldValue: JSON.stringify({
          originalName: 'degree.pdf',
          storagePath: 'uploads/degree.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        }),
      }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result).toHaveLength(3);
    expect(result[0].dataType).toBe('text');
    expect(result[0].displayValue).toBe('Acme Corp');
    expect(result[1].dataType).toBe('address_block');
    expect(result[1].addressPieces).toHaveLength(4);
    expect(result[2].requirementType).toBe('document');
    expect(result[2].displayValue).toBe('degree.pdf');
  });

  it('batch-fetches requirements in a single query regardless of record count', async () => {
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'A' }),
      makeRawRecord({ fieldName: REQ_COMPANY_ADDRESS_ID, fieldValue: '{}' }),
      makeRawRecord({ fieldName: REQ_DOCUMENT_ID, fieldValue: '{}' }),
    ];

    await hydrateOrderData(records, 'en-US');

    // dSXRequirement.findMany should be called exactly once
    expect(prisma.dSXRequirement.findMany).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Edge Cases
// ===========================================================================

describe('edge cases', () => {
  it('returns empty array for empty input', async () => {
    const result = await hydrateOrderData([], 'en-US');

    expect(result).toEqual([]);
    expect(prisma.dSXRequirement.findMany).not.toHaveBeenCalled();
  });

  it('returns fallback records when dsx_requirements query fails entirely', async () => {
    vi.mocked(prisma.dSXRequirement.findMany).mockRejectedValue(new Error('DB connection lost'));

    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Acme Corp' }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Unknown field');
    expect(result[0].displayValue).toBe('Acme Corp');
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to fetch dsx_requirements for hydration',
      expect.objectContaining({ error: 'DB connection lost' })
    );
  });

  it('still hydrates labels when translations fail to load', async () => {
    vi.mocked(getTranslations).mockRejectedValue(new Error('File not found'));

    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Acme Corp' }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    // Should fall back to dsx_requirements.name
    expect(result[0].label).toBe('Company Name');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to load translations for hydration, labels will use DataRx names',
      expect.any(Object)
    );
  });

  it('still hydrates addresses when countries query fails', async () => {
    vi.mocked(prisma.country.findMany).mockRejectedValue(new Error('DB timeout'));

    const addressJson = JSON.stringify({
      street1: '123 Main St',
      state: QUEENSLAND_UUID,
    });
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_ADDRESS_ID, fieldValue: addressJson }),
    ];

    const result = await hydrateOrderData(records, 'en-US');

    // Address should still resolve, but state will show raw UUID
    expect(result[0].addressPieces).toBeDefined();
    const statePiece = result[0].addressPieces?.find(p => p.key === 'state');
    expect(statePiece?.value).toBe(QUEENSLAND_UUID);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to fetch geographic names for address resolution',
      expect.any(Object)
    );
  });

  it('deduplicates requirement IDs in the batch query', async () => {
    // Two records referencing the same requirement
    const records = [
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Company A' }),
      makeRawRecord({ fieldName: REQ_COMPANY_NAME_ID, fieldValue: 'Company B' }),
    ];

    await hydrateOrderData(records, 'en-US');

    const callArgs = vi.mocked(prisma.dSXRequirement.findMany).mock.calls[0][0];
    const requestedIds = (callArgs as any).where.id.in;
    // Should only contain the UUID once, not twice
    expect(requestedIds).toHaveLength(1);
  });
});