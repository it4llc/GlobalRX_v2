// /GlobalRX_v2/src/hooks/useCommentTemplates.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  CommentTemplate,
  CreateCommentTemplateInput,
  UpdateCommentTemplateInput,
  CommentTemplateListData,
  CommentTemplateAvailability,
  UpdateAvailabilityInput
} from '@/lib/schemas/commentTemplateSchemas';

interface Service {
  code: string;
  name: string;
  category?: string;
}

interface UseCommentTemplatesResult {
  templates: CommentTemplate[];
  services: Service[];
  statuses: string[];
  isLoading: boolean;
  error: string | null;
  createTemplate: (input: CreateCommentTemplateInput) => Promise<CommentTemplate>;
  updateTemplate: (id: string, input: UpdateCommentTemplateInput) => Promise<CommentTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  getAvailability: (templateId: string) => Promise<CommentTemplateAvailability[]>;
  updateAvailability: (templateId: string, input: UpdateAvailabilityInput) => Promise<CommentTemplateAvailability[]>;
  refresh: () => Promise<void>;
}

export function useCommentTemplates(): UseCommentTemplatesResult {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    // Business rule: Comment management is restricted to internal users with specific permission
    // This check prevents UI from attempting API calls that would fail with 403
    if (!user?.permissions?.comment_management) {
      setError('Insufficient permissions');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/comment-templates');

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view comment templates');
        }
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }

      const data: CommentTemplateListData = await response.json();
      setTemplates(data.templates);
      setServices(data.services);
      setStatuses(data.statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (input: CreateCommentTemplateInput): Promise<CommentTemplate> => {
    const response = await fetch('/api/comment-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create template');
    }

    const newTemplate = await response.json();

    // Add to state
    setTemplates(prev => [...prev, newTemplate]);

    return newTemplate;
  };

  const updateTemplate = async (id: string, input: UpdateCommentTemplateInput): Promise<CommentTemplate> => {
    const response = await fetch(`/api/comment-templates/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update template');
    }

    const updatedTemplate = await response.json();

    // Update in state
    setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t));

    return updatedTemplate;
  };

  const deleteTemplate = async (id: string): Promise<void> => {
    const response = await fetch(`/api/comment-templates/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete template');
    }

    const result = await response.json();

    // Handle different deletion outcomes based on hasBeenUsed business rule
    // Hard deleted templates are removed from UI completely
    // Soft deleted templates remain in state but marked inactive (could be shown in admin views)
    if (result.message?.includes('permanently')) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    } else {
      setTemplates(prev => prev.map(t =>
        t.id === id ? { ...t, isActive: false } : t
      ));
    }
  };

  const getAvailability = async (templateId: string): Promise<CommentTemplateAvailability[]> => {
    const response = await fetch(`/api/comment-templates/${templateId}/availability`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch availability');
    }

    const data = await response.json();
    return data.availabilities;
  };

  const updateAvailability = async (
    templateId: string,
    input: UpdateAvailabilityInput
  ): Promise<CommentTemplateAvailability[]> => {
    const response = await fetch(`/api/comment-templates/${templateId}/availability`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update availability');
    }

    const data = await response.json();
    return data.availabilities;
  };

  return {
    templates,
    services,
    statuses,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getAvailability,
    updateAvailability,
    refresh: fetchTemplates,
  };
}