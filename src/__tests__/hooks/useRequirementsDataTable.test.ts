// src/__tests__/hooks/useRequirementsDataTable.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRequirementsDataTable } from '@/hooks/useRequirementsDataTable';
import { Requirement } from '@/types';

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: vi.fn(),
  }),
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe.skip('useRequirementsDataTable', () => {
  // Test data
  const mockLocations = [
    {
      id: 'usa',
      name: 'United States',
      countryName: 'United States',
      parentId: null,
    },
    {
      id: 'ca',
      name: 'California',
      subregion1: 'California',
      parentId: 'usa',
    },
    {
      id: 'tx',
      name: 'Texas',
      subregion1: 'Texas',
      parentId: 'usa',
    },
    {
      id: 'la',
      name: 'Los Angeles',
      subregion2: 'Los Angeles',
      parentId: 'ca',
    },
    {
      id: 'sf',
      name: 'San Francisco',
      subregion2: 'San Francisco',
      parentId: 'ca',
    },
    {
      id: 'uk',
      name: 'United Kingdom',
      countryName: 'United Kingdom',
      parentId: null,
    },
  ];

  const mockRequirements: Requirement[] = [
    {
      id: 'field1',
      name: 'First Name',
      type: 'field',
      displayOrder: 1,
      description: 'Applicant first name',
    },
    {
      id: 'field2',
      name: 'Last Name',
      type: 'field',
      displayOrder: 2,
      description: 'Applicant last name',
    },
    {
      id: 'doc1',
      name: 'ID Document',
      type: 'document',
      displayOrder: 1,
      description: 'Government issued ID',
    },
    {
      id: 'doc2',
      name: 'Proof of Address',
      type: 'document',
      displayOrder: 2,
      description: 'Utility bill or bank statement',
    },
    {
      id: 'form1',
      name: 'Consent Form',
      type: 'form',
      displayOrder: 1,
      description: 'Background check consent',
    },
  ] as Requirement[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Location Hierarchy Building', () => {
    it('should create ALL as root with all locations as descendants', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      const hierarchy = result.current.hierarchicalData;
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].id).toBe('all');
      expect(hierarchy[0].name).toBe('ALL');
      expect(hierarchy[0].level).toBe(0);
    });

    it('should organize locations into correct parent-child relationships', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      const all = result.current.hierarchicalData[0];

      // ALL should have USA and UK as children
      expect(all.children).toHaveLength(2);
      const usa = all.children?.find(c => c.id === 'usa');
      const uk = all.children?.find(c => c.id === 'uk');

      expect(usa).toBeDefined();
      expect(usa?.level).toBe(1);
      expect(uk).toBeDefined();
      expect(uk?.level).toBe(1);

      // USA should have CA and TX as children
      expect(usa?.children).toHaveLength(2);
      const ca = usa?.children?.find(c => c.id === 'ca');
      const tx = usa?.children?.find(c => c.id === 'tx');

      expect(ca).toBeDefined();
      expect(ca?.level).toBe(2);
      expect(tx).toBeDefined();
      expect(tx?.level).toBe(2);

      // CA should have LA and SF as children
      expect(ca?.children).toHaveLength(2);
      const la = ca?.children?.find(c => c.id === 'la');
      const sf = ca?.children?.find(c => c.id === 'sf');

      expect(la).toBeDefined();
      expect(la?.level).toBe(3);
      expect(sf).toBeDefined();
      expect(sf?.level).toBe(3);
    });

    it('should sort countries alphabetically', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      const all = result.current.hierarchicalData[0];
      const countries = all.children || [];

      expect(countries[0].id).toBe('uk'); // United Kingdom comes before United States
      expect(countries[1].id).toBe('usa');
    });
  });

  describe('Requirement Organization', () => {
    it('should separate and sort requirements by type', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      expect(result.current.sortedFields).toHaveLength(2);
      expect(result.current.sortedFields[0].id).toBe('field1');
      expect(result.current.sortedFields[1].id).toBe('field2');

      expect(result.current.sortedDocuments).toHaveLength(2);
      expect(result.current.sortedDocuments[0].id).toBe('doc1');
      expect(result.current.sortedDocuments[1].id).toBe('doc2');

      expect(result.current.sortedForms).toHaveLength(1);
      expect(result.current.sortedForms[0].id).toBe('form1');
    });

    it('should sort requirements by displayOrder within each type', () => {
      const unorderedRequirements: Requirement[] = [
        { id: 'field3', name: 'Email', type: 'field', displayOrder: 3 },
        { id: 'field1', name: 'First Name', type: 'field', displayOrder: 1 },
        { id: 'field2', name: 'Last Name', type: 'field', displayOrder: 2 },
      ] as Requirement[];

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: unorderedRequirements,
        })
      );

      expect(result.current.sortedFields[0].displayOrder).toBe(1);
      expect(result.current.sortedFields[1].displayOrder).toBe(2);
      expect(result.current.sortedFields[2].displayOrder).toBe(3);
    });
  });

  describe('Checkbox Propagation - Requirements', () => {
    it('should check all descendants when parent is checked', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      act(() => {
        result.current.handleRequirementChange('usa', 'field1', true);
      });

      // USA and all its descendants should be checked
      expect(result.current.localMappings['usa___field1']).toBe(true);
      expect(result.current.localMappings['ca___field1']).toBe(true);
      expect(result.current.localMappings['tx___field1']).toBe(true);
      expect(result.current.localMappings['la___field1']).toBe(true);
      expect(result.current.localMappings['sf___field1']).toBe(true);

      // UK should not be affected
      expect(result.current.localMappings['uk___field1']).toBeUndefined();
    });

    it('should uncheck all ancestors when child is unchecked', () => {
      const initialMappings = {
        'all___field1': true,
        'usa___field1': true,
        'ca___field1': true,
        'la___field1': true,
        'sf___field1': true,
        'tx___field1': true,
        'uk___field1': true,
      };

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          initialMappings,
        })
      );

      act(() => {
        result.current.handleRequirementChange('la', 'field1', false);
      });

      // LA should be unchecked
      expect(result.current.localMappings['la___field1']).toBe(false);

      // All ancestors should be unchecked
      expect(result.current.localMappings['ca___field1']).toBe(false);
      expect(result.current.localMappings['usa___field1']).toBe(false);
      expect(result.current.localMappings['all___field1']).toBe(false);

      // Siblings should remain checked
      expect(result.current.localMappings['sf___field1']).toBe(true);
      expect(result.current.localMappings['tx___field1']).toBe(true);
      expect(result.current.localMappings['uk___field1']).toBe(true);
    });

    it('should compute ALL checkbox state based on all children', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      // Initially ALL should not be checked
      const all = result.current.hierarchicalData[0];
      expect(all.requirements?.['field1']).toBeFalsy();

      // Check all countries
      act(() => {
        result.current.handleRequirementChange('usa', 'field1', true);
      });
      act(() => {
        result.current.handleRequirementChange('uk', 'field1', true);
      });

      // Re-render to get updated hierarchy
      const { result: result2 } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          initialMappings: result.current.localMappings,
        })
      );

      // Now ALL should be checked
      const all2 = result2.current.hierarchicalData[0];
      expect(all2.requirements?.['field1']).toBe(true);
    });
  });

  describe('Checkbox Propagation - Availability', () => {
    it('should enable all descendants when parent is enabled', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      act(() => {
        result.current.handleAvailabilityChange('usa', true);
      });

      // USA and all its descendants should be available
      expect(result.current.localAvailability['usa']).toBe(true);
      expect(result.current.localAvailability['ca']).toBe(true);
      expect(result.current.localAvailability['tx']).toBe(true);
      expect(result.current.localAvailability['la']).toBe(true);
      expect(result.current.localAvailability['sf']).toBe(true);

      // UK should not be affected
      expect(result.current.localAvailability['uk']).toBeUndefined();
    });

    it('should disable all ancestors when child is disabled', () => {
      const initialAvailability = {
        'all': true,
        'usa': true,
        'ca': true,
        'la': true,
        'sf': true,
        'tx': true,
        'uk': true,
      };

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          initialAvailability,
        })
      );

      act(() => {
        result.current.handleAvailabilityChange('la', false);
      });

      // LA should be disabled
      expect(result.current.localAvailability['la']).toBe(false);

      // All ancestors should be disabled
      expect(result.current.localAvailability['ca']).toBe(false);
      expect(result.current.localAvailability['usa']).toBe(false);
      expect(result.current.localAvailability['all']).toBe(false);

      // Siblings should remain enabled
      expect(result.current.localAvailability['sf']).toBe(true);
      expect(result.current.localAvailability['tx']).toBe(true);
      expect(result.current.localAvailability['uk']).toBe(true);
    });

    it('should compute ALL availability based on all children', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      // Initially ALL should be available (default)
      const all = result.current.hierarchicalData[0];
      expect(all.available).toBe(true);

      // Disable one country
      act(() => {
        result.current.handleAvailabilityChange('usa', false);
      });

      // Re-render to get updated hierarchy
      const { result: result2 } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          initialAvailability: result.current.localAvailability,
        })
      );

      // ALL should now be disabled
      const all2 = result2.current.hierarchicalData[0];
      expect(all2.available).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should track changes and provide save/cancel functionality', () => {
      const onMappingChange = vi.fn();
      const onAvailabilityChange = vi.fn();

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          onMappingChange,
          onAvailabilityChange,
        })
      );

      // Initially no changes
      expect(result.current.hasChanges).toBe(false);

      // Make a change
      act(() => {
        result.current.handleRequirementChange('usa', 'field1', true);
      });

      expect(result.current.hasChanges).toBe(true);

      // Save changes
      act(() => {
        result.current.handleSave();
      });

      expect(onMappingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'usa___field1': true,
          'ca___field1': true,
          'tx___field1': true,
          'la___field1': true,
          'sf___field1': true,
        })
      );
      expect(result.current.hasChanges).toBe(false);
    });

    it('should exclude ALL location from saved state', () => {
      const onMappingChange = vi.fn();
      const onAvailabilityChange = vi.fn();

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          onMappingChange,
          onAvailabilityChange,
        })
      );

      // Check ALL which should check everything
      act(() => {
        result.current.handleRequirementChange('all', 'field1', true);
      });

      act(() => {
        result.current.handleAvailabilityChange('all', true);
      });

      // Save changes
      act(() => {
        result.current.handleSave();
      });

      // Verify ALL is not in saved mappings
      const savedMappings = onMappingChange.mock.calls[0][0];
      const allMappings = Object.keys(savedMappings).filter(key => key.startsWith('all___'));
      expect(allMappings).toHaveLength(0);

      // Verify ALL is not in saved availability
      const savedAvailability = onAvailabilityChange.mock.calls[0][0];
      expect(savedAvailability['all']).toBeUndefined();
    });

    it('should revert changes on cancel', () => {
      const initialMappings = {
        'usa___field1': true,
      };

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
          initialMappings,
        })
      );

      // Make a change
      act(() => {
        result.current.handleRequirementChange('uk', 'field2', true);
      });

      expect(result.current.localMappings['uk___field2']).toBe(true);
      expect(result.current.hasChanges).toBe(true);

      // Cancel changes
      act(() => {
        result.current.handleCancel();
      });

      expect(result.current.localMappings).toEqual(initialMappings);
      expect(result.current.hasChanges).toBe(false);
    });
  });

  describe('Row Expansion Management', () => {
    it('should manage expanded state with ALL expanded by default', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      expect(result.current.expandedState['all']).toBe(true);
    });

    it('should flatten locations based on expansion state', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      // With only ALL expanded
      const flattened1 = result.current.flattenedLocations;
      expect(flattened1).toHaveLength(3); // ALL, UK, USA

      // Expand USA
      act(() => {
        result.current.setExpandedState(prev => ({ ...prev, usa: true }));
      });

      const flattened2 = result.current.flattenedLocations;
      expect(flattened2).toHaveLength(5); // ALL, UK, USA, CA, TX
    });
  });

  describe('Performance Optimizations', () => {
    it('should provide data for virtualization', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: mockRequirements,
        })
      );

      expect(result.current.flattenedLocations).toBeDefined();
      expect(Array.isArray(result.current.flattenedLocations)).toBe(true);

      // Check that flattened locations maintain hierarchy info
      const flattened = result.current.flattenedLocations;
      const all = flattened.find(l => l.id === 'all');
      expect(all?.level).toBe(0);
    });

    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeLocations = [];
      for (let i = 0; i < 100; i++) {
        largeLocations.push({
          id: `country${i}`,
          name: `Country ${i}`,
          countryName: `Country ${i}`,
          parentId: null,
        });

        for (let j = 0; j < 10; j++) {
          largeLocations.push({
            id: `region${i}_${j}`,
            name: `Region ${j}`,
            subregion1: `Region ${j}`,
            parentId: `country${i}`,
          });
        }
      }

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: largeLocations,
          requirements: mockRequirements,
        })
      );

      expect(result.current.hierarchicalData).toHaveLength(1); // Just ALL
      expect(result.current.hierarchicalData[0].children).toHaveLength(100); // 100 countries
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty locations array', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: [],
          requirements: mockRequirements,
        })
      );

      expect(result.current.hierarchicalData).toHaveLength(1);
      expect(result.current.hierarchicalData[0].id).toBe('all');
      expect(result.current.hierarchicalData[0].children).toHaveLength(0);
    });

    it('should handle empty requirements array', () => {
      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: [],
        })
      );

      expect(result.current.sortedFields).toHaveLength(0);
      expect(result.current.sortedDocuments).toHaveLength(0);
      expect(result.current.sortedForms).toHaveLength(0);
    });

    it('should handle requirements without displayOrder', () => {
      const requirementsNoOrder: Requirement[] = [
        { id: 'field1', name: 'Field 1', type: 'field' },
        { id: 'field2', name: 'Field 2', type: 'field', displayOrder: 1 },
        { id: 'field3', name: 'Field 3', type: 'field' },
      ] as Requirement[];

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: mockLocations,
          requirements: requirementsNoOrder,
        })
      );

      // Should place items without order at the end
      expect(result.current.sortedFields[0].displayOrder).toBe(1);
      expect(result.current.sortedFields[1].displayOrder).toBeUndefined();
      expect(result.current.sortedFields[2].displayOrder).toBeUndefined();
    });

    it('should handle locations without proper name fields', () => {
      const malformedLocations = [
        { id: 'loc1', parentId: null },
        { id: 'loc2', countryName: 'Country 2', parentId: null },
        { id: 'loc3', name: 'Location 3', parentId: null },
      ];

      const { result } = renderHook(() =>
        useRequirementsDataTable({
          locations: malformedLocations,
          requirements: mockRequirements,
        })
      );

      const all = result.current.hierarchicalData[0];
      expect(all.children).toHaveLength(3);

      // Should use fallback empty string for missing names
      const loc1 = all.children?.find(c => c.id === 'loc1');
      expect(loc1?.name).toBe('');
    });
  });
});