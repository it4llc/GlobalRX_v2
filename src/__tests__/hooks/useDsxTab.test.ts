/**
 * Tests for useDsxTab Hook
 *
 * BUSINESS LOGIC DOCUMENTATION:
 *
 * The DSX (Data & Document Requirement Selection) tab manages a matrix of
 * requirements × locations for service configuration.
 *
 * KEY BUSINESS RULES:
 *
 * 1. SERVICE-DRIVEN WORKFLOW:
 *    - User MUST select a service first (entry point)
 *    - Service selection loads ALL system locations (not filtered)
 *    - Service selection loads requirements for that service
 *    - Service selection loads existing DSX configuration
 *
 * 2. REQUIREMENTS MATRIX TABLE STRUCTURE:
 *    - First column: "Available" checkbox for each location
 *    - Remaining columns: Requirements (one per column)
 *    - Rows: ALL locations in the system
 *    - Cells: Checkboxes for requirement selection
 *
 * 3. AVAILABILITY LOGIC:
 *    - "Available" checkbox controls if service is offered in that location
 *    - When checked: Service IS offered in that location
 *    - When unchecked: Service NOT offered (even if requirements are checked)
 *    - CRITICAL: Unchecking "Available" preserves requirement selections
 *    - This allows re-enabling a location without reconfiguring requirements
 *
 * 4. REQUIREMENT SELECTION:
 *    - Each checkbox indicates if a requirement is needed in that location
 *    - Requirements can be selected even if location is unavailable
 *    - Bulk operations supported (select all/none per location or requirement)
 *
 * 5. FIELD ORDER MANAGEMENT:
 *    - Controls display order of requirement columns
 *    - Reordering via up/down buttons or drag-drop
 *    - Order persists per service
 *
 * 6. DATA PERSISTENCE:
 *    - Saves entire matrix configuration for selected service
 *    - Includes availability status for each location
 *    - Includes requirement selections (preserved even if unavailable)
 *    - Includes field order preferences
 *
 * 7. ERROR HANDLING:
 *    - Gracefully handles missing data
 *    - Prevents saves without service selection
 *    - Shows user-friendly error messages
 *    - Maintains UI consistency on errors
 *
 * Testing business logic for DSX tab functionality:
 * - Service selection and data loading
 * - Requirements matrix table with availability column
 * - Location availability toggle (preserves requirement selections)
 * - Requirement selection per location
 * - Field order management
 * - Data persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDsxTab } from '@/hooks/useDsxTab';

// Mock the auth context
const mockFetchWithAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth
  })
}));

// Mock logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

describe('useDsxTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchWithAuth.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers(); // Always restore real timers after each test
    vi.resetAllMocks();
    mockFetchWithAuth.mockReset();
  });

  describe('Initialization', () => {
    it('should initialize with empty state', async () => {
      // Mock the initial services fetch
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [] })
      });

      const { result } = renderHook(() => useDsxTab());

      // Wait for the services fetch to complete
      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/services?includeDisabled=false');
      });

      expect(result.current.selectedService).toBeNull();
      expect(result.current.services).toEqual([]);
      expect(result.current.locations).toEqual([]);
      expect(result.current.requirements).toEqual([]);
      expect(result.current.locationRequirements).toEqual({});
      expect(result.current.locationAvailability).toEqual({});
      expect(result.current.fieldOrder).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load services on mount', async () => {
      const mockServices = [
        { id: '1', name: 'Service A' },
        { id: '2', name: 'Service B' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/services?includeDisabled=false');
        expect(result.current.services).toEqual(mockServices);
      });
    });

    it('should handle service loading error', async () => {
      mockFetchWithAuth.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load services');
        expect(result.current.services).toEqual([]);
      });
    });
  });

  describe('Service Selection', () => {
    it('should load all data when a service is selected', async () => {
      const mockServices = [
        { id: '1', name: 'Service A' },
        { id: '2', name: 'Service B' }
      ];

      const mockLocations = [
        { id: 'loc1', name: 'USA', type: 'country' },
        { id: 'loc2', name: 'Canada', type: 'country' },
        { id: 'loc3', name: 'California', type: 'subregion1', parentId: 'loc1' }
      ];

      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1', type: 'document' },
        { id: 'req2', name: 'Requirement 2', type: 'data' }
      ];

      const mockDsxConfig = {
        serviceId: '1',
        requirements: mockRequirements,  // DSX API returns requirements directly
        mappings: {
          'loc1___req1': true,
          'loc1___req2': true,
          'loc2___req1': true,
          'loc3___req2': true
        },
        availability: {
          'loc1': true,
          'loc2': false,
          'loc3': true
        },
        fieldOrder: ['req2', 'req1']
      };

      // Mock initial services load
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      // Wait for services to load
      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      // Mock data loads when service is selected (only 2 calls, not 3)
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDsxConfig  // DSX response includes requirements
        });

      // Select a service
      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      await waitFor(() => {
        expect(result.current.selectedService).toBe('1');
        expect(result.current.locations).toEqual(mockLocations);
        expect(result.current.requirements).toEqual(mockRequirements);
        // Check converted format from legacy mappings
        expect(result.current.locationAvailability).toEqual({
          'loc1': true,
          'loc2': false,
          'loc3': true,
          'all': false // ALL is false because not all locations are available (loc2 is false)
        });
        expect(result.current.locationRequirements).toEqual({
          'loc1': ['req1', 'req2'],
          'loc2': ['req1'],
          'loc3': ['req2'],
          'all': [] // ALL is empty because no requirement is in ALL locations
        });
        expect(result.current.fieldOrder).toEqual(mockDsxConfig.fieldOrder);
      });

      // Verify API calls (only 2 calls, not 3)
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/locations');
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/dsx?serviceId=1');
    });

    it('should clear data when switching services', async () => {
      const mockServices = [
        { id: '1', name: 'Service A' },
        { id: '2', name: 'Service B' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      // Mock first service selection
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Mock second service selection
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await act(async () => {
        await result.current.handleServiceSelect('2');
      });

      expect(result.current.selectedService).toBe('2');
    });

    it('should handle errors when loading service data', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      // Mock failed location load (Promise.all needs both mocks even if first fails)
      mockFetchWithAuth
        .mockRejectedValueOnce(new Error('Failed to load locations'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });  // DSX mock (won't be reached)

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load DSX configuration');
        expect(result.current.locations).toEqual([]);
      });
    });
  });

  describe('Location Availability Management', () => {
    it('should toggle location availability without clearing requirements', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [
        { id: 'loc1', name: 'USA' },
        { id: 'loc2', name: 'Canada' }
      ];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      // Setup initial state (only 2 calls)
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc1___req1': true, 'loc2___req1': true },
            availability: { 'loc1': true, 'loc2': false },
            fieldOrder: ['req1']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Toggle availability for loc1 (true -> false)
      act(() => {
        result.current.handleAvailabilityToggle('loc1');
      });

      expect(result.current.locationAvailability['loc1']).toBe(false);
      expect(result.current.locationRequirements['loc1']).toEqual(['req1']); // Requirements preserved

      // Toggle availability for loc2 (false -> true)
      act(() => {
        result.current.handleAvailabilityToggle('loc2');
      });

      expect(result.current.locationAvailability['loc2']).toBe(true);
      expect(result.current.locationRequirements['loc2']).toEqual(['req1']); // Requirements preserved
    });

    it('should handle bulk availability operations', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [
        { id: 'loc1', name: 'USA' },
        { id: 'loc2', name: 'Canada' },
        { id: 'loc3', name: 'Mexico' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: [],
            mappings: {},
            availability: {},
            fieldOrder: []
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Select all locations
      act(() => {
        result.current.handleSelectAllAvailability();
      });

      expect(result.current.locationAvailability).toEqual({
        'loc1': true,
        'loc2': true,
        'loc3': true
      });

      // Deselect all locations
      act(() => {
        result.current.handleDeselectAllAvailability();
      });

      expect(result.current.locationAvailability).toEqual({
        'loc1': false,
        'loc2': false,
        'loc3': false
      });
    });
  });

  describe('Requirement Selection', () => {
    it('should toggle requirement for a specific location', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [{ id: 'loc1', name: 'USA' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc1___req1': true },
            availability: { 'loc1': true },
            fieldOrder: ['req1', 'req2']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Add req2 to loc1
      act(() => {
        result.current.handleRequirementToggle('loc1', 'req2');
      });

      expect(result.current.locationRequirements['loc1']).toContain('req2');
      expect(result.current.locationRequirements['loc1']).toContain('req1');

      // Remove req1 from loc1
      act(() => {
        result.current.handleRequirementToggle('loc1', 'req1');
      });

      expect(result.current.locationRequirements['loc1']).not.toContain('req1');
      expect(result.current.locationRequirements['loc1']).toContain('req2');
    });

    it('should handle bulk requirement operations for a location', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [{ id: 'loc1', name: 'USA' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' },
        { id: 'req3', name: 'Requirement 3' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: {},
            availability: { 'loc1': true },
            fieldOrder: ['req1', 'req2', 'req3']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Select all requirements for loc1
      act(() => {
        result.current.handleSelectAllRequirements('loc1');
      });

      expect(result.current.locationRequirements['loc1']).toEqual(['req1', 'req2', 'req3']);

      // Deselect all requirements for loc1
      act(() => {
        result.current.handleDeselectAllRequirements('loc1');
      });

      expect(result.current.locationRequirements['loc1']).toEqual([]);
    });

    it('should handle bulk requirement operations across all locations', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [
        { id: 'loc1', name: 'USA' },
        { id: 'loc2', name: 'Canada' }
      ];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc2___req1': true },
            availability: { 'loc1': true, 'loc2': true },
            fieldOrder: ['req1', 'req2']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Select requirement for all locations
      act(() => {
        result.current.handleRequirementToggleAllLocations('req2', true);
      });

      expect(result.current.locationRequirements['loc1']).toContain('req2');
      expect(result.current.locationRequirements['loc2']).toContain('req2');

      // Deselect requirement for all locations
      act(() => {
        result.current.handleRequirementToggleAllLocations('req1', false);
      });

      expect(result.current.locationRequirements['loc1']).not.toContain('req1');
      expect(result.current.locationRequirements['loc2']).not.toContain('req1');
    });
  });

  describe('Field Order Management', () => {
    it('should reorder requirements', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' },
        { id: 'req3', name: 'Requirement 3' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: {},
            availability: {},
            fieldOrder: ['req1', 'req2', 'req3']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Move req3 to position 0
      act(() => {
        result.current.handleFieldReorder('req3', 0);
      });

      expect(result.current.fieldOrder).toEqual(['req3', 'req1', 'req2']);

      // Move req1 to end
      act(() => {
        result.current.handleFieldReorder('req1', 2);
      });

      expect(result.current.fieldOrder).toEqual(['req3', 'req2', 'req1']);
    });

    it('should handle moving field up', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' },
        { id: 'req3', name: 'Requirement 3' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: {},
            availability: {},
            fieldOrder: ['req1', 'req2', 'req3']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Move req2 up
      act(() => {
        result.current.handleMoveFieldUp('req2');
      });

      expect(result.current.fieldOrder).toEqual(['req2', 'req1', 'req3']);

      // Try to move first item up (should not change)
      act(() => {
        result.current.handleMoveFieldUp('req2');
      });

      expect(result.current.fieldOrder).toEqual(['req2', 'req1', 'req3']);
    });

    it('should handle moving field down', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' },
        { id: 'req3', name: 'Requirement 3' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: {},
            availability: {},
            fieldOrder: ['req1', 'req2', 'req3']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Move req2 down
      act(() => {
        result.current.handleMoveFieldDown('req2');
      });

      expect(result.current.fieldOrder).toEqual(['req1', 'req3', 'req2']);

      // Try to move last item down (should not change)
      act(() => {
        result.current.handleMoveFieldDown('req2');
      });

      expect(result.current.fieldOrder).toEqual(['req1', 'req3', 'req2']);
    });
  });

  describe('Data Persistence', () => {
    it('should save DSX configuration successfully', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [
        { id: 'loc1', name: 'USA' },
        { id: 'loc2', name: 'Canada' }
      ];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc1___req1': true },
            availability: { 'loc1': true, 'loc2': false },
            fieldOrder: ['req1', 'req2']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Modify configuration
      act(() => {
        result.current.handleAvailabilityToggle('loc2');
        result.current.handleRequirementToggle('loc2', 'req2');
      });

      // Mock successful save (now two separate API calls)
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc1___req1': true, 'loc2___req2': true },
            availability: { 'loc1': true, 'loc2': true },
            fieldOrder: ['req1', 'req2']
          })
        });

      await act(async () => {
        await result.current.handleSave();
      });

      // Verify the two separate API calls made during save
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/dsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: '1',
          type: 'mappings',
          data: { 'req1': ['loc1'], 'req2': ['loc2'] }
        })
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/dsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: '1',
          type: 'availability',
          data: { 'loc1': true, 'loc2': true, 'all': true }
        })
      });

      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle save errors gracefully', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ requirements: [] })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Mock failed save
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(result.current.error).toBe('Failed to save DSX configuration');
      expect(result.current.isSaving).toBe(false);
    });

    it('should not save if no service is selected', async () => {
      // Mock services fetch to succeed so we get clean initial state
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [] })
      });

      const { result } = renderHook(() => useDsxTab());

      // Wait for initial services fetch
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockFetchWithAuth).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/dsx'),
        expect.anything()
      );
      expect(result.current.error).toBe('Please select a service first');
    });

    it.skip('should show success message after save', async () => {
      vi.useFakeTimers();

      const mockServices = [{ id: '1', name: 'Service A' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Mock the save responses (2 API calls for mappings and availability)
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        // Mock the reload after save (handleServiceSelect is called again)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [] // locations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: [],
            mappings: {},
            availability: {},
            fieldOrder: []
          }) // dsx data
        });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(result.current.successMessage).toBe('DSX configuration saved successfully');

      // Success message should clear after timeout - use fake timers
      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(result.current.successMessage).toBeNull();
      // Don't restore timers here - afterEach will handle it
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty locations list', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      expect(result.current.locations).toEqual([]);
      expect(result.current.locationAvailability).toEqual({
        'all': false // ALL is false when there are no locations
      });
    });

    it('should handle empty requirements list', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [{ id: 'loc1', name: 'USA' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      expect(result.current.requirements).toEqual([]);
      expect(result.current.fieldOrder).toEqual([]);
    });

    it('should handle missing DSX configuration gracefully', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [{ id: 'loc1', name: 'USA' }];
      const mockRequirements = [{ id: 'req1', name: 'Requirement 1' }];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      // Return null/undefined DSX config
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ requirements: mockRequirements })  // Minimal DSX response
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Should initialize with computed ALL state for existing location
      expect(result.current.locationAvailability).toEqual({
        'all': true // ALL is true when all locations are available (default state)
      });
      expect(result.current.locationRequirements).toEqual({
        'all': [] // ALL has no requirements when no mappings exist
      });
      expect(result.current.fieldOrder).toEqual(['req1']); // Default order
    });

    it('should preserve requirement selections when unavailable', async () => {
      const mockServices = [{ id: '1', name: 'Service A' }];
      const mockLocations = [{ id: 'loc1', name: 'USA' }];
      const mockRequirements = [
        { id: 'req1', name: 'Requirement 1' },
        { id: 'req2', name: 'Requirement 2' }
      ];

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      const { result } = renderHook(() => useDsxTab());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockLocations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requirements: mockRequirements,
            mappings: { 'loc1___req1': true, 'loc1___req2': true },
            availability: { 'loc1': true },
            fieldOrder: ['req1', 'req2']
          })
        });

      await act(async () => {
        await result.current.handleServiceSelect('1');
      });

      // Make location unavailable
      act(() => {
        result.current.handleAvailabilityToggle('loc1');
      });

      expect(result.current.locationAvailability['loc1']).toBe(false);
      expect(result.current.locationRequirements['loc1']).toEqual(['req1', 'req2']);

      // Make location available again
      act(() => {
        result.current.handleAvailabilityToggle('loc1');
      });

      expect(result.current.locationAvailability['loc1']).toBe(true);
      expect(result.current.locationRequirements['loc1']).toEqual(['req1', 'req2']);
    });
  });
});