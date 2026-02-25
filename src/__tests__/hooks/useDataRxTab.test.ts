// src/__tests__/hooks/useDataRxTab.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDataRxTab } from '@/hooks/useDataRxTab';

// Mock the auth context
const mockFetchWithAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

// Mock the client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useDataRxTab', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    mockFetchWithAuth.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      // Mock fetchWithAuth to prevent initial data load
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ fields: [], documents: [] }),
      });

      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.activeTab).toBe('fields');
      expect(result.current.dataFields).toEqual([]);
      expect(result.current.documents).toEqual([]);
      // Initial loading is true because fetchData is called on mount
      expect(result.current.error).toBe(null);
      expect(result.current.showAddFieldModal).toBe(false);
      expect(result.current.showAddDocumentModal).toBe(false);
      expect(result.current.showEditFieldModal).toBe(false);
      expect(result.current.selectedFieldId).toBe(null);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch fields and documents on mount', async () => {
      const mockFields = [
        { id: '1', fieldLabel: 'Test Field', shortName: 'test', dataType: 'text' },
      ];
      const mockDocuments = [
        { id: '1', documentName: 'Test Doc', scope: 'global' },
      ];

      mockFetchWithAuth.mockImplementation((url: string) => {
        if (url.includes('/api/data-rx/fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fields: mockFields }),
          });
        }
        if (url.includes('/api/data-rx/documents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: mockDocuments }),
          });
        }
      });

      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataFields).toEqual(mockFields);
      expect(result.current.documents).toEqual(mockDocuments);
      expect(result.current.error).toBe(null);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDataRxTab());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load data. Please try again.');
      expect(result.current.dataFields).toEqual([]);
      expect(result.current.documents).toEqual([]);
    });
  });

  describe('Tab Management', () => {
    it('should switch between fields and documents tabs', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.activeTab).toBe('fields');

      act(() => {
        result.current.setActiveTab('documents');
      });

      expect(result.current.activeTab).toBe('documents');

      act(() => {
        result.current.setActiveTab('fields');
      });

      expect(result.current.activeTab).toBe('fields');
    });
  });

  describe('Field Management', () => {
    beforeEach(() => {
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (url.includes('/api/data-rx/fields') && !url.includes('/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fields: [] }),
          });
        }
        if (url.includes('/api/data-rx/documents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [] }),
          });
        }
      });
    });

    it('should handle adding a new field', async () => {
      const newField = {
        fieldLabel: 'New Field',
        shortName: 'new_field',
        dataType: 'text',
        instructions: 'Test instructions',
        retentionHandling: 'no_delete',
        collectionTab: 'subject',
        requiresVerification: false,
      };

      const expectedFieldObject = {
        ...newField,
        addressConfig: null,
      };

      mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
        if (options?.method === 'POST' && url.includes('/api/data-rx/fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ field: { id: '1', ...newField } }),
          });
        }
        // Return empty arrays for initial fetch
        if (url.includes('/api/data-rx/fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fields: [] }),
          });
        }
        if (url.includes('/api/data-rx/documents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [] }),
          });
        }
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleAddField(newField);
      });

      // Find the POST call among all calls
      const postCall = mockFetchWithAuth.mock.calls.find(
        call => call[1]?.method === 'POST' && call[0] === '/api/data-rx/fields'
      );

      expect(postCall).toBeDefined();
      expect(postCall[0]).toBe('/api/data-rx/fields');
      expect(postCall[1]?.method).toBe('POST');
      expect(postCall[1]?.headers).toEqual({ 'Content-Type': 'application/json' });

      // Parse the body to check properties regardless of order
      const sentBody = JSON.parse(postCall[1]?.body);
      expect(sentBody).toEqual(expectedFieldObject);
    });

    it('should handle adding a field with options for select type', async () => {
      const newField = {
        fieldLabel: 'Select Field',
        shortName: 'select_field',
        dataType: 'select',
        options: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'opt2', label: 'Option 2' },
        ],
        instructions: '',
        retentionHandling: 'no_delete',
        collectionTab: 'subject',
        requiresVerification: false,
      };

      const expectedFieldObject = {
        ...newField,
        addressConfig: null,
      };

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ field: { id: '1', ...newField } }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleAddField(newField);
      });

      // Find the POST call among all calls
      const postCall = mockFetchWithAuth.mock.calls.find(
        call => call[1]?.method === 'POST' && call[0] === '/api/data-rx/fields'
      );

      expect(postCall).toBeDefined();

      // Parse the body to check properties regardless of order
      const sentBody = JSON.parse(postCall[1]?.body);
      expect(sentBody).toEqual(expectedFieldObject);
    });

    it('should handle editing an existing field', async () => {
      const editedField = {
        id: '1',
        fieldLabel: 'Edited Field',
        shortName: 'edited_field',
        dataType: 'text',
        instructions: 'Updated instructions',
        retentionHandling: 'customer_rule',
        collectionTab: 'subject',
        requiresVerification: true,
        options: [],
      };

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ field: editedField }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleEditField(editedField);
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        `/api/data-rx/fields/${editedField.id}`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldLabel: editedField.fieldLabel,
            shortName: editedField.shortName,
            dataType: editedField.dataType,
            instructions: editedField.instructions,
            retentionHandling: editedField.retentionHandling,
            collectionTab: editedField.collectionTab,
            addressConfig: null,
            requiresVerification: editedField.requiresVerification,
            options: editedField.options,
          }),
        })
      );

      expect(result.current.showEditFieldModal).toBe(false);
      expect(result.current.selectedFieldId).toBe(null);
    });

    it('should handle toggling field status', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleToggleFieldStatus('field-id');
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/data-rx/fields/field-id/toggle-status',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should open edit modal with correct field id', () => {
      const { result } = renderHook(() => useDataRxTab());

      act(() => {
        result.current.handleOpenEditModal('field-123');
      });

      expect(result.current.selectedFieldId).toBe('field-123');
      expect(result.current.showEditFieldModal).toBe(true);
    });
  });

  describe('Document Management', () => {
    it('should handle adding a new document', async () => {
      const newDocument = {
        documentName: 'New Document',
        instructions: 'Document instructions',
        scope: 'global',
        retentionHandling: 'no_delete',
      };

      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ document: { id: '1', ...newDocument } }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleAddDocument(newDocument);
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/data-rx/documents',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDocument),
        })
      );

      expect(result.current.showAddDocumentModal).toBe(false);
    });

    it('should handle toggling document status', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleToggleDocumentStatus('doc-id', false);
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/data-rx/documents/doc-id/toggle-status',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('Data Type Mapping', () => {
    it('should correctly map data types to labels', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.getDataTypeLabel('text')).toBe('Text');
      expect(result.current.getDataTypeLabel('number')).toBe('Number');
      expect(result.current.getDataTypeLabel('date')).toBe('Date');
      expect(result.current.getDataTypeLabel('email')).toBe('Email');
      expect(result.current.getDataTypeLabel('phone')).toBe('Phone');
      expect(result.current.getDataTypeLabel('select')).toBe('Dropdown');
      expect(result.current.getDataTypeLabel('checkbox')).toBe('Checkbox');
      expect(result.current.getDataTypeLabel('radio')).toBe('Radio Buttons');
      expect(result.current.getDataTypeLabel('address_block')).toBe('Address Block');
      expect(result.current.getDataTypeLabel('unknown')).toBe('unknown');
    });

    it('should provide correct data type options', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.dataTypeOptions).toHaveLength(9);
      expect(result.current.dataTypeOptions[0]).toEqual({
        id: 'text',
        value: 'text',
        label: 'Text',
      });
    });
  });

  describe('Retention Handling', () => {
    it('should correctly map retention handling values to labels', () => {
      const { result } = renderHook(() => useDataRxTab());

      const field1 = { retentionHandling: 'no_delete' };
      expect(result.current.getRetentionLabelForField(field1)).toBe("Don't delete");

      const field2 = { retentionHandling: 'customer_rule' };
      expect(result.current.getRetentionLabelForField(field2)).toBe('Customer rule');

      const field3 = { retentionHandling: 'global_rule' };
      expect(result.current.getRetentionLabelForField(field3)).toBe('Global rule');

      const field4 = { retentionHandling: 'none' };
      expect(result.current.getRetentionLabelForField(field4)).toBe('None');

      const field5 = { retentionHandling: 'invalid' };
      expect(result.current.getRetentionLabelForField(field5)).toBe('None');
    });

    it('should provide correct retention options', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.retentionOptions).toHaveLength(4);
      expect(result.current.retentionOptions[0]).toEqual({
        id: 'no_delete',
        value: 'no_delete',
        label: "Don't delete",
      });
    });
  });

  describe('Modal State Management', () => {
    it('should manage add field modal state', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.showAddFieldModal).toBe(false);

      act(() => {
        result.current.setShowAddFieldModal(true);
      });

      expect(result.current.showAddFieldModal).toBe(true);

      act(() => {
        result.current.setShowAddFieldModal(false);
      });

      expect(result.current.showAddFieldModal).toBe(false);
    });

    it('should manage add document modal state', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.showAddDocumentModal).toBe(false);

      act(() => {
        result.current.setShowAddDocumentModal(true);
      });

      expect(result.current.showAddDocumentModal).toBe(true);
    });

    it('should manage edit field modal state with selected field', () => {
      const { result } = renderHook(() => useDataRxTab());

      expect(result.current.showEditFieldModal).toBe(false);
      expect(result.current.selectedFieldId).toBe(null);

      act(() => {
        result.current.handleOpenEditModal('field-456');
      });

      expect(result.current.showEditFieldModal).toBe(true);
      expect(result.current.selectedFieldId).toBe('field-456');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors when adding fields', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Validation failed' }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleAddField({
          fieldLabel: 'Test',
          shortName: 'test',
          dataType: 'text',
        });
      });

      expect(result.current.error).toBe('Failed to add field: Validation failed');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API errors when editing fields', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ details: 'Field not found' }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleEditField({
          id: '1',
          fieldLabel: 'Test',
          shortName: 'test',
          dataType: 'text',
        });
      });

      expect(result.current.error).toBe('Failed to update field: Field not found');
    });

    it('should handle API errors when adding documents', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Document creation failed' }),
      });

      const { result } = renderHook(() => useDataRxTab());

      await act(async () => {
        await result.current.handleAddDocument({
          documentName: 'Test Doc',
          instructions: 'Instructions',
          scope: 'global',
          retentionHandling: 'no_delete',
        });
      });

      expect(result.current.error).toBe('Failed to add document: Document creation failed');
    });

    it('should clear error when retrying data fetch', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ fields: [], documents: [] }),
      });

      const { result } = renderHook(() => useDataRxTab());

      // Set an error first
      act(() => {
        result.current.setError('Some error');
      });

      expect(result.current.error).toBe('Some error');

      // Mock success response for retry
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (url.includes('/api/data-rx/fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fields: [] }),
          });
        }
        if (url.includes('/api/data-rx/documents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await act(async () => {
        await result.current.fetchData();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Loading State', () => {
    it('should manage loading state during data operations', async () => {
      // Mock responses to resolve quickly
      mockFetchWithAuth.mockImplementation((url: string) => {
        if (url.includes('/api/data-rx/fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ fields: [] }),
          });
        }
        if (url.includes('/api/data-rx/documents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDataRxTab());

      // Initial load starts immediately
      expect(result.current.isLoading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger another load
      act(() => {
        result.current.fetchData();
      });

      // Should be loading again
      expect(result.current.isLoading).toBe(true);

      // Wait for it to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});