// src/__tests__/hooks/useRequirementsTable.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRequirementsTable } from '@/hooks/useRequirementsTable';

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
  errorToLogMeta: vi.fn(),
}));

describe('useRequirementsTable', () => {
  const mockLocations = [
    {
      id: 'usa',
      name: 'United States',
      code2: 'US',
      parentId: null,
    },
    {
      id: 'ca',
      name: 'California',
      code2: 'CA',
      parentId: 'usa',
    },
    {
      id: 'tx',
      name: 'Texas',
      code2: 'TX',
      parentId: 'usa',
    },
    {
      id: 'la',
      name: 'Los Angeles',
      code2: 'LA',
      parentId: 'ca',
    },
  ];

  const mockRequirements = [
    { id: 'req1', name: 'Background Check', type: 'field' },
    { id: 'req2', name: 'Drug Test', type: 'document' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Location Hierarchy Building', () => {
    it('should build location hierarchy with ALL as root', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.hierarchicalLocations).toHaveLength(1);
      expect(result.current.hierarchicalLocations[0].id).toBe('all');
      expect(result.current.hierarchicalLocations[0].name).toBe('ALL');
    });

    it('should organize locations into parent-child relationships', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      const allLocation = result.current.hierarchicalLocations[0];
      expect(allLocation.children).toHaveLength(1); // USA

      const usa = allLocation.children?.[0];
      expect(usa?.id).toBe('usa');
      expect(usa?.children).toHaveLength(2); // CA and TX

      const california = usa?.children?.find(child => child.id === 'ca');
      expect(california?.children).toHaveLength(1); // LA
      expect(california?.children?.[0].id).toBe('la');
    });

    it('should track parent-child relationships in locationHierarchy', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.locationHierarchy['all']).toContain('usa');
      expect(result.current.locationHierarchy['usa']).toContain('ca');
      expect(result.current.locationHierarchy['usa']).toContain('tx');
      expect(result.current.locationHierarchy['ca']).toContain('la');
    });

    it('should set hierarchy levels correctly', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.hierarchyLevels['all']).toBe(0);
      expect(result.current.hierarchyLevels['usa']).toBe(1);
      expect(result.current.hierarchyLevels['ca']).toBe(2);
      expect(result.current.hierarchyLevels['tx']).toBe(2);
      expect(result.current.hierarchyLevels['la']).toBe(3);
    });

    it('should pre-expand ALL row', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.expandedRows['all']).toBe(true);
    });
  });

  describe('Checkbox State Management', () => {
    it('should handle requirement checkbox changes', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      act(() => {
        result.current.handleCheckboxChange('ca', 'req1', true);
      });

      expect(result.current.localMappings['ca-req1']).toBe(true);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should propagate checkbox changes to children', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      act(() => {
        result.current.handleCheckboxChange('ca', 'req1', true);
      });

      // Child location should also be checked
      expect(result.current.localMappings['la-req1']).toBe(true);
    });

    it('should update parent checkboxes when all children are checked', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      // Wait for hierarchy to be built
      expect(result.current.locationHierarchy['usa']).toBeDefined();

      // Check both direct children of USA (CA and TX)
      // Note: When checking CA, it will also check LA (its child)
      act(() => {
        result.current.handleCheckboxChange('ca', 'req1', true);
      });

      // Verify CA and its child LA are checked
      expect(result.current.localMappings['ca-req1']).toBe(true);
      expect(result.current.localMappings['la-req1']).toBe(true);

      act(() => {
        result.current.handleCheckboxChange('tx', 'req1', true);
      });

      // Now all children of USA are checked, so USA should be checked
      expect(result.current.localMappings['usa-req1']).toBe(true);
    });

    it('should uncheck parent when not all children are checked', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialMappings: {
            'usa-req1': true,
            'ca-req1': true,
            'tx-req1': true,
            'la-req1': true,
          },
        })
      );

      // Uncheck one child
      act(() => {
        result.current.handleCheckboxChange('tx', 'req1', false);
      });

      // Parent should be unchecked
      expect(result.current.localMappings['usa-req1']).toBe(false);
    });
  });

  describe('Availability Management', () => {
    it('should handle location availability changes', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      act(() => {
        result.current.handleAvailabilityChange('ca', true);
      });

      expect(result.current.localAvailability['ca']).toBe(true);
      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should propagate availability to children', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      act(() => {
        result.current.handleAvailabilityChange('ca', true);
      });

      // Child location should also be available
      expect(result.current.localAvailability['la']).toBe(true);
    });

    it('should clear requirement mappings when location becomes unavailable', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialMappings: {
            'ca-req1': true,
            'ca-req2': true,
            'la-req1': true,
            'la-req2': true,
          },
          initialAvailability: {
            'ca': true,
            'la': true,
          },
        })
      );

      act(() => {
        result.current.handleAvailabilityChange('ca', false);
      });

      // Requirements should be cleared
      expect(result.current.localMappings['ca-req1']).toBe(false);
      expect(result.current.localMappings['ca-req2']).toBe(false);
      expect(result.current.localMappings['la-req1']).toBe(false);
      expect(result.current.localMappings['la-req2']).toBe(false);
    });
  });

  describe('Save and Cancel Operations', () => {
    it('should save changes and filter out ALL location', () => {
      const onMappingChange = vi.fn();
      const onAvailabilityChange = vi.fn();

      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          onMappingChange,
          onAvailabilityChange,
        })
      );

      act(() => {
        result.current.handleCheckboxChange('all', 'req1', true);
        result.current.handleCheckboxChange('ca', 'req2', true);
        result.current.handleAvailabilityChange('all', true);
        result.current.handleAvailabilityChange('tx', true);
      });


      act(() => {
        result.current.handleSaveChanges();
      });

      // Should not include 'all' location in saved data
      expect(onMappingChange).toHaveBeenCalledWith(
        expect.not.objectContaining({
          'all-req1': expect.anything(),
        })
      );
      expect(onAvailabilityChange).toHaveBeenCalledWith(
        expect.not.objectContaining({
          'all': expect.anything(),
        })
      );

      // Should include other locations
      expect(onMappingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'ca-req2': true,
        })
      );
      expect(onAvailabilityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'tx': true,
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should cancel changes and revert to initial state', () => {
      const initialMappings = {
        'ca-req1': true,
        'tx-req2': true,
      };
      const initialAvailability = {
        'ca': true,
        'tx': false,
      };

      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialMappings,
          initialAvailability,
        })
      );

      // Make changes
      act(() => {
        result.current.handleCheckboxChange('ca', 'req1', false);
        result.current.handleCheckboxChange('tx', 'req1', true);
        result.current.handleAvailabilityChange('tx', true);
      });

      expect(result.current.hasUnsavedChanges).toBe(true);

      // Cancel changes
      act(() => {
        result.current.handleCancelChanges();
      });

      expect(result.current.localMappings).toEqual(initialMappings);
      expect(result.current.localAvailability).toEqual(initialAvailability);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should correctly identify if requirement is selected', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialMappings: {
            'ca-req1': true,
            'tx-req2': false,
          },
        })
      );

      expect(result.current.isRequirementSelected('ca', 'req1')).toBe(true);
      expect(result.current.isRequirementSelected('tx', 'req2')).toBe(false);
      expect(result.current.isRequirementSelected('la', 'req1')).toBe(false);
    });

    it('should correctly identify if location is available', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialAvailability: {
            'ca': true,
            'tx': false,
          },
        })
      );

      expect(result.current.isLocationAvailable('ca')).toBe(true);
      expect(result.current.isLocationAvailable('tx')).toBe(false);
      expect(result.current.isLocationAvailable('la')).toBe(false);
    });

    it('should toggle row expansion', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.expandedRows['usa']).toBeFalsy();

      act(() => {
        result.current.toggleRowExpansion('usa');
      });

      expect(result.current.expandedRows['usa']).toBe(true);

      act(() => {
        result.current.toggleRowExpansion('usa');
      });

      expect(result.current.expandedRows['usa']).toBe(false);
    });

    it('should detect if location has children', () => {
      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      const usa = result.current.hierarchicalLocations[0].children?.[0];
      const la = usa?.children?.find(c => c.id === 'ca')?.children?.[0];

      expect(result.current.hasChildren(usa!)).toBe(true);
      expect(result.current.hasChildren(la!)).toBe(false);
    });
  });

  describe('State Initialization', () => {
    it('should initialize with provided initial mappings and availability', () => {
      const initialMappings = {
        'ca-req1': true,
        'tx-req2': true,
      };
      const initialAvailability = {
        'ca': true,
        'tx': false,
      };

      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: mockLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
          initialMappings,
          initialAvailability,
        })
      );

      expect(result.current.localMappings).toEqual(initialMappings);
      expect(result.current.localAvailability).toEqual(initialAvailability);
      expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('should reinitialize when serviceId changes', () => {
      const { result, rerender } = renderHook(
        ({ serviceId }) =>
          useRequirementsTable({
            locations: mockLocations,
            requirements: mockRequirements,
            serviceId,
            initialMappings: { [`${serviceId}-req1`]: true },
            initialAvailability: { [`${serviceId}-loc`]: true },
          }),
        { initialProps: { serviceId: 'service1' } }
      );

      expect(result.current.localMappings).toEqual({ 'service1-req1': true });

      rerender({ serviceId: 'service2' });

      expect(result.current.localMappings).toEqual({ 'service2-req1': true });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid locations gracefully', () => {
      const invalidLocations = [
        ...mockLocations,
        { id: null, name: 'Invalid' } as any,
        undefined as any,
      ];

      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: invalidLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      // Should still build hierarchy with valid locations
      expect(result.current.hierarchicalLocations).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('should set error state on processing failure', () => {
      // Mock console.error to avoid test output noise
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const badLocations = [{
        id: 'bad',
        get name() {
          throw new Error('Processing error');
        },
      }] as any;

      const { result } = renderHook(() =>
        useRequirementsTable({
          locations: badLocations,
          requirements: mockRequirements,
          serviceId: 'service1',
        })
      );

      expect(result.current.error).toBe('Failed to process location data.');

      consoleError.mockRestore();
    });
  });
});