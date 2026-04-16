// src/lib/services/__tests__/order-data-resolvers.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveDocumentValue,
  resolveAddressValue,
  collectGeographicUuids,
} from '../order-data-resolvers';

// Mock the logger so we can verify warnings are logged
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import logger from '@/lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Document Resolver
// ===========================================================================

describe('resolveDocumentValue', () => {
  it('extracts originalName as the display filename', () => {
    const json = JSON.stringify({
      documentId: '86d871fe-1234-5678-9abc-def012345678',
      filename: 'NPC-100PointChecklist-18042019.pdf',
      originalName: 'NPC-100PointChecklist-18042019.pdf',
      storagePath: 'uploads/draft-documents/abc/NPC-100PointChecklist-18042019.pdf',
      mimeType: 'application/pdf',
      size: 276740,
      uploadedAt: '2026-03-25T20:03:56.049Z',
      uploadedBy: 'f7b3085b-1234-5678-9abc-def012345678',
    });

    const result = resolveDocumentValue(json);

    expect(result.displayValue).toBe('NPC-100PointChecklist-18042019.pdf');
    expect(result.document.filename).toBe('NPC-100PointChecklist-18042019.pdf');
    expect(result.document.storagePath).toBe(
      'uploads/draft-documents/abc/NPC-100PointChecklist-18042019.pdf'
    );
    expect(result.document.mimeType).toBe('application/pdf');
    expect(result.document.size).toBe(276740);
  });

  it('falls back to filename when originalName is missing', () => {
    const json = JSON.stringify({
      filename: 'backup-name.pdf',
      storagePath: 'uploads/backup-name.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    });

    const result = resolveDocumentValue(json);

    expect(result.displayValue).toBe('backup-name.pdf');
    expect(result.document.filename).toBe('backup-name.pdf');
  });

  it('falls back to "Unknown document" when both name fields are missing', () => {
    const json = JSON.stringify({
      storagePath: 'uploads/mystery-file',
      mimeType: 'application/octet-stream',
      size: 500,
    });

    const result = resolveDocumentValue(json);

    expect(result.displayValue).toBe('Unknown document');
    expect(result.document.filename).toBe('Unknown document');
  });

  it('provides safe defaults for missing metadata fields', () => {
    const json = JSON.stringify({
      originalName: 'report.pdf',
    });

    const result = resolveDocumentValue(json);

    expect(result.document.storagePath).toBe('');
    expect(result.document.mimeType).toBe('');
    expect(result.document.size).toBe(0);
  });

  it('returns raw value and logs warning when JSON is invalid', () => {
    const badJson = 'not-valid-json{{{';

    const result = resolveDocumentValue(badJson);

    expect(result.displayValue).toBe(badJson);
    expect(result.document.filename).toBe('Unknown document');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to parse document JSON, returning raw value',
      expect.objectContaining({
        rawValuePreview: expect.any(String),
      })
    );
  });

  it('falls back to "Unknown document" when originalName is empty string', () => {
    const json = JSON.stringify({
      originalName: '',
      filename: '',
    });

    const result = resolveDocumentValue(json);

    expect(result.displayValue).toBe('Unknown document');
  });
});

// ===========================================================================
// Address Resolver
// ===========================================================================

describe('resolveAddressValue', () => {
  // A realistic addressConfig matching what comes from dsx_requirements.fieldData
  const standardConfig = {
    street1: { enabled: true, label: 'Street Address', required: true },
    street2: { enabled: true, label: 'Apt/Suite', required: false },
    city: { enabled: true, label: 'City', required: true },
    state: { enabled: true, label: 'State/Province', required: true },
    county: { enabled: false, label: 'County', required: false },
    postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
  };

  const queenslandUuid = 'f53e7f72-8bbe-4017-994a-499b681bfc70';

  // Pre-built map simulating what the hydration service provides
  // after its batch query to the countries table
  const geoNameMap = new Map<string, string>([
    [queenslandUuid, 'Queensland'],
  ]);

  it('resolves a complete address with geographic UUID lookup', () => {
    const json = JSON.stringify({
      street1: '123 Main St',
      city: 'Brisbane',
      state: queenslandUuid,
      postalCode: '4000',
    });

    const result = resolveAddressValue(json, standardConfig, geoNameMap);

    expect(result.addressPieces).toEqual([
      { key: 'street1', label: 'Street Address', value: '123 Main St' },
      { key: 'city', label: 'City', value: 'Brisbane' },
      { key: 'state', label: 'State/Province', value: 'Queensland' },
      { key: 'postalCode', label: 'ZIP/Postal Code', value: '4000' },
    ]);
    expect(result.displayValue).toBe('123 Main St, Brisbane, Queensland, 4000');
  });

  it('skips disabled pieces from addressConfig', () => {
    const json = JSON.stringify({
      street1: '456 Oak Ave',
      city: 'Sydney',
      county: 'some-county-uuid',
      postalCode: '2000',
    });

    const result = resolveAddressValue(json, standardConfig, geoNameMap);

    // county is disabled in standardConfig, so it should not appear
    const keys = result.addressPieces.map(p => p.key);
    expect(keys).not.toContain('county');
    expect(keys).toContain('street1');
    expect(keys).toContain('city');
    expect(keys).toContain('postalCode');
  });

  it('skips empty or whitespace-only values', () => {
    const json = JSON.stringify({
      street1: '789 Pine Rd',
      street2: '',
      city: '   ',
      postalCode: '3000',
    });

    const result = resolveAddressValue(json, standardConfig, geoNameMap);

    const keys = result.addressPieces.map(p => p.key);
    expect(keys).toContain('street1');
    expect(keys).not.toContain('street2');
    expect(keys).not.toContain('city');
    expect(keys).toContain('postalCode');
  });

  it('uses default labels when addressConfig is null', () => {
    const json = JSON.stringify({
      street1: '10 Default St',
      city: 'Melbourne',
      postalCode: '3000',
    });

    const result = resolveAddressValue(json, null, geoNameMap);

    expect(result.addressPieces).toEqual([
      { key: 'street1', label: 'Street Address', value: '10 Default St' },
      { key: 'city', label: 'City', value: 'Melbourne' },
      { key: 'postalCode', label: 'ZIP/Postal Code', value: '3000' },
    ]);
  });

  it('returns raw UUID and logs warning when geographic lookup fails', () => {
    const unknownUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const json = JSON.stringify({
      street1: '1 Mystery Lane',
      state: unknownUuid,
    });

    const result = resolveAddressValue(json, standardConfig, geoNameMap);

    const statePiece = result.addressPieces.find(p => p.key === 'state');
    expect(statePiece?.value).toBe(unknownUuid);
    expect(logger.warn).toHaveBeenCalledWith(
      'Geographic UUID not found in countries lookup',
      expect.objectContaining({ key: 'state', uuid: unknownUuid })
    );
  });

  it('returns raw value and logs warning when JSON is invalid', () => {
    const badJson = '{broken json!!!';

    const result = resolveAddressValue(badJson, standardConfig, geoNameMap);

    expect(result.displayValue).toBe(badJson);
    expect(result.addressPieces).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to parse address JSON, returning raw value',
      expect.objectContaining({
        rawValuePreview: expect.any(String),
      })
    );
  });

  it('handles address with all pieces populated including county', () => {
    const countyUuid = 'cccccccc-1111-2222-3333-444444444444';
    const configWithCounty = {
      ...standardConfig,
      county: { enabled: true, label: 'County', required: false },
    };
    const extendedGeoMap = new Map([
      ...geoNameMap,
      [countyUuid, 'Cook County'],
    ]);
    const json = JSON.stringify({
      street1: '100 Lake Shore Dr',
      street2: 'Unit 5A',
      city: 'Chicago',
      state: queenslandUuid,
      county: countyUuid,
      postalCode: '60601',
    });

    const result = resolveAddressValue(json, configWithCounty, extendedGeoMap);

    expect(result.addressPieces).toHaveLength(6);
    const countyPiece = result.addressPieces.find(p => p.key === 'county');
    expect(countyPiece?.value).toBe('Cook County');
    expect(countyPiece?.label).toBe('County');
  });
});

// ===========================================================================
// Geographic UUID Collector
// ===========================================================================

describe('collectGeographicUuids', () => {
  const validUuid = 'f53e7f72-8bbe-4017-994a-499b681bfc70';
  const anotherUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('collects state and county UUIDs from address JSON values', () => {
    const values = [
      JSON.stringify({ street1: '123 Main St', state: validUuid, city: 'Brisbane' }),
      JSON.stringify({ street1: '456 Oak Ave', state: anotherUuid }),
    ];

    const uuids = collectGeographicUuids(values);

    expect(uuids.size).toBe(2);
    expect(uuids.has(validUuid)).toBe(true);
    expect(uuids.has(anotherUuid)).toBe(true);
  });

  it('deduplicates the same UUID appearing in multiple addresses', () => {
    const values = [
      JSON.stringify({ state: validUuid }),
      JSON.stringify({ state: validUuid }),
    ];

    const uuids = collectGeographicUuids(values);

    expect(uuids.size).toBe(1);
  });

  it('ignores non-UUID values in state and county fields', () => {
    const values = [
      JSON.stringify({ state: 'not-a-uuid', county: 'also-not-a-uuid' }),
    ];

    const uuids = collectGeographicUuids(values);

    expect(uuids.size).toBe(0);
  });

  it('ignores non-geographic fields even if they contain UUIDs', () => {
    const values = [
      JSON.stringify({ street1: validUuid, city: anotherUuid }),
    ];

    const uuids = collectGeographicUuids(values);

    expect(uuids.size).toBe(0);
  });

  it('skips unparseable JSON without crashing', () => {
    const values = [
      'not-json',
      JSON.stringify({ state: validUuid }),
      '{broken!!!',
    ];

    const uuids = collectGeographicUuids(values);

    expect(uuids.size).toBe(1);
    expect(uuids.has(validUuid)).toBe(true);
  });

  it('returns empty set for empty input', () => {
    const uuids = collectGeographicUuids([]);

    expect(uuids.size).toBe(0);
  });
});