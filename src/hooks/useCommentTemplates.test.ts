// /GlobalRX_v2/src/hooks/useCommentTemplates.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/contexts/AuthContext');

// Mock fetch
global.fetch = vi.fn();

describe('useCommentTemplates', () => {
  const mockTemplates = [
    {
      id: 't1',
      shortName: 'Missing Doc',
      longName: 'Document Required - Customer Must Provide',
      templateText: 'Please provide [document type] for [candidate name]',
      isActive: true,
      hasBeenUsed: false,
      availabilities: []
    },
    {
      id: 't2',
      shortName: 'MVR Failed',
      longName: 'Motor Vehicle Record Check Failed',
      templateText: 'MVR check failed: [reason]',
      isActive: true,
      hasBeenUsed: true,
      availabilities: []
    }
  ];

  const mockServices = [
    { code: 'MVR', name: 'Motor Vehicle Record', category: 'Driving' },
    { code: 'CRIMINAL', name: 'Criminal Background', category: 'Background' }
  ];

  const mockStatuses = ['PASS', 'FAIL', 'pending', 'in_progress', 'REVIEW', 'completed'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '1',
        type: 'internal',
        permissions: { comment_management: true }
      },
      hasPermission: (perm) => perm === 'comment_management',
      loading: false,
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn()
    });
  });

  describe('Initial Load', () => {
    it('should fetch templates on mount', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          templates: mockTemplates,
          services: mockServices,
          statuses: mockStatuses
        })
      });

      const { result } = renderHook(() => useCommentTemplates());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.services).toEqual(mockServices);
      expect(result.current.statuses).toEqual(mockStatuses);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle 403 forbidden response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('You do not have permission to view comment templates');
    });

    it('should not fetch if user lacks permission', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: { candidate_workflow: true }
        },
        hasPermission: (perm) => false,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn()
      });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Insufficient permissions');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Create Template', () => {
    it('should create template successfully', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'new-template',
            shortName: 'New Template',
            longName: 'New Template Long Name',
            templateText: 'Template text with [placeholder]',
            isActive: true,
            hasBeenUsed: false
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newTemplate = {
        shortName: 'New Template',
        longName: 'New Template Long Name',
        templateText: 'Template text with [placeholder]'
      };

      let createdTemplate;
      await act(async () => {
        createdTemplate = await result.current.createTemplate(newTemplate);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comment-templates',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newTemplate)
        })
      );

      expect(createdTemplate).toEqual({
        id: 'new-template',
        shortName: 'New Template',
        longName: 'New Template Long Name',
        templateText: 'Template text with [placeholder]',
        isActive: true,
        hasBeenUsed: false
      });
    });

    it('should handle create error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid template' })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.createTemplate({
          shortName: '',
          longName: '',
          templateText: ''
        })
      ).rejects.toThrow('Invalid template');
    });

    it('should add created template to state', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'new-template',
            shortName: 'New',
            longName: 'New Template',
            templateText: 'New template text',
            isActive: true,
            hasBeenUsed: false
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.createTemplate({
          shortName: 'New',
          longName: 'New Template',
          templateText: 'New template text'
        });
      });

      expect(result.current.templates).toHaveLength(3);
    });
  });

  describe('Update Template', () => {
    it('should update template successfully', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 't1',
            shortName: 'Updated Short',
            longName: 'Updated Long Name',
            templateText: 'Updated template text',
            isActive: true,
            hasBeenUsed: false
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updates = {
        shortName: 'Updated Short',
        longName: 'Updated Long Name',
        templateText: 'Updated template text'
      };

      let updatedTemplate;
      await act(async () => {
        updatedTemplate = await result.current.updateTemplate('t1', updates);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comment-templates/t1',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        })
      );

      expect(updatedTemplate.shortName).toBe('Updated Short');
    });

    it('should update template in state', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 't1',
            shortName: 'Updated',
            longName: mockTemplates[0].longName,
            templateText: mockTemplates[0].templateText,
            isActive: true,
            hasBeenUsed: false
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates[0].shortName).toBe('Missing Doc');

      await act(async () => {
        await result.current.updateTemplate('t1', { shortName: 'Updated' });
      });

      expect(result.current.templates[0].shortName).toBe('Updated');
    });

    it('should handle update error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Template not found' })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.updateTemplate('nonexistent', {
          shortName: 'Updated'
        })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Delete Template', () => {
    it('should delete template successfully', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Template permanently deleted'
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTemplate('t1');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comment-templates/t1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should handle hard delete (remove from state)', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Template permanently deleted'
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.deleteTemplate('t1');
      });

      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates.find(t => t.id === 't1')).toBeUndefined();
    });

    it('should handle soft delete (deactivate in state)', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Template deactivated (has been used)'
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates[1].isActive).toBe(true);

      await act(async () => {
        await result.current.deleteTemplate('t2');
      });

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates.find(t => t.id === 't2').isActive).toBe(false);
    });

    it('should handle delete error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Template not found' })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.deleteTemplate('nonexistent')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Availability Management', () => {
    it('should fetch availability successfully', async () => {
      const mockAvailabilities = [
        { templateId: 't1', serviceCode: 'MVR', status: 'PASS' },
        { templateId: 't1', serviceCode: 'MVR', status: 'FAIL' }
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            availabilities: mockAvailabilities
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let availabilities;
      await act(async () => {
        availabilities = await result.current.getAvailability('t1');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/comment-templates/t1/availability');
      expect(availabilities).toEqual(mockAvailabilities);
    });

    it('should update availability successfully', async () => {
      const updatedAvailabilities = [
        { templateId: 't1', serviceCode: 'CRIMINAL', status: 'PASS' }
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            availabilities: updatedAvailabilities
          })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const input = {
        availabilities: [
          { serviceCode: 'CRIMINAL', status: 'PASS' }
        ]
      };

      let availabilities;
      await act(async () => {
        availabilities = await result.current.updateAvailability('t1', input);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comment-templates/t1/availability',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(input)
        })
      );

      expect(availabilities).toEqual(updatedAvailabilities);
    });

    it('should handle availability fetch error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Template not found' })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.getAvailability('nonexistent')
      ).rejects.toThrow('Template not found');
    });

    it('should handle availability update error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            templates: mockTemplates,
            services: mockServices,
            statuses: mockStatuses
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid input' })
        });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        result.current.updateAvailability('t1', { availabilities: [] })
      ).rejects.toThrow('Invalid input');
    });
  });

  describe('Refresh', () => {
    it('should manually refresh templates', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            templates: callCount === 1 ? mockTemplates : [...mockTemplates, {
              id: 't3',
              shortName: 'New',
              longName: 'New Template',
              templateText: 'New template added',
              isActive: true,
              hasBeenUsed: false
            }],
            services: mockServices,
            statuses: mockStatuses
          })
        });
      });

      const { result } = renderHook(() => useCommentTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.templates).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});