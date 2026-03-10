import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import clientLogger from '@/lib/client-logger';
import type {
  ServiceComment,
  CreateServiceCommentInput,
  UpdateServiceCommentInput,
  ServiceCommentWithRelations
} from '@/types/comment-template';
import {
  createServiceCommentSchema,
  updateServiceCommentSchema
} from '@/lib/schemas/serviceCommentSchemas';

// Single service interface
interface UseServiceCommentsProps {
  serviceId: string;
  enabled?: boolean;
}

// Bulk order interface
interface UseServiceCommentsBulkProps {
  orderId: string;
  enabled?: boolean;
}

interface UseServiceCommentsReturn {
  comments: ServiceCommentWithRelations[];
  commentsByService?: Record<string, ServiceCommentWithRelations[]>;
  loading: boolean;
  error: string | null;
  createComment: (data: CreateServiceCommentInput) => Promise<void>;
  updateComment: (commentId: string, data: UpdateServiceCommentInput) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  refetch: () => Promise<void>;
  getCommentCount: (serviceId: string) => number;
  checkVisibilityChangeWarning: (commentId: string, newVisibility: boolean) => Promise<string | null>;
  canCreateComment: () => boolean;
  canEditComment: (commentId: string) => boolean;
  canDeleteComment: (commentId: string) => boolean;
  getAvailableTemplates: (serviceType: string, serviceStatus: string) => Promise<any[]>;
  applyTemplate: (templateId: string, placeholderValues: Record<string, string>) => string;
  extractPlaceholders: (templateText: string) => string[];
  getVisibleComments: () => ServiceCommentWithRelations[];
  getSortedComments: () => ServiceCommentWithRelations[];
  availableTemplates: any[];
  hasUnreplacedPlaceholders: (text: string) => boolean;
  requiresDeleteConfirmation: () => boolean;
}

// Overloaded function signatures
export function useServiceComments(serviceId: string | null, orderId?: string, serviceType?: string, serviceStatus?: string): UseServiceCommentsReturn {
  const { user } = useAuth();
  const [comments, setComments] = useState<ServiceCommentWithRelations[]>([]);
  const [commentsByService, setCommentsByService] = useState<Record<string, ServiceCommentWithRelations[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  // Helper function to validate comment text
  const validateCommentText = (text: string): void => {
    if (!text || text.trim().length === 0) {
      throw new Error('Comment text cannot be empty');
    }
    if (text.length > 1000) {
      throw new Error('Comment cannot exceed 1000 characters');
    }
    // Brackets are now allowed as regular text - no validation needed
  };

  // Fetch comments for a single service
  const fetchServiceComments = useCallback(async () => {
    if (!serviceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/services/${serviceId}/comments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const data = await response.json();
      const validatedComments = data.comments || data;

      // Sort by newest first
      const sortedComments = (Array.isArray(validatedComments) ? validatedComments : [])
        .sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      setComments(sortedComments);
    } catch (err) {
      const errorMessage = 'Failed to load comments';
      clientLogger.error('Error fetching service comments', {
        error: err,
        serviceId,
        errorMessage
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  // Fetch comments for all services in an order
  const fetchOrderComments = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/services/comments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load comments');
      }

      const data = await response.json();
      const commentsMap = data.commentsByService || {};

      clientLogger.info('Received comments data from API', {
        orderId,
        hasCommentsByService: !!data.commentsByService,
        serviceIds: Object.keys(commentsMap),
        services: Object.entries(commentsMap).map(([id, serviceData]) => ({
          id,
          hasComments: !!(serviceData as any).comments,
          commentCount: (serviceData as any).comments?.length || 0
        }))
      });

      // Log the first service's data structure for debugging
      const firstServiceId = Object.keys(commentsMap)[0];
      if (firstServiceId) {
        clientLogger.info('Sample service data structure', {
          serviceId: firstServiceId,
          data: commentsMap[firstServiceId]
        });
      }

      setCommentsByService(commentsMap);

      // Flatten all comments for the comments array
      const allComments: ServiceCommentWithRelations[] = [];
      Object.values(commentsMap).forEach((serviceData: any) => {
        // The API returns { serviceName, serviceStatus, comments, total }
        // We need to access the comments array inside this object
        if (serviceData && Array.isArray(serviceData.comments)) {
          allComments.push(...serviceData.comments);
        }
      });

      setComments(allComments);
    } catch (err) {
      const errorMessage = 'Failed to load comments';
      clientLogger.error('Error fetching order comments', {
        error: err,
        orderId,
        errorMessage
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Main fetch function that decides which fetch to use
  const fetchComments = useCallback(async () => {
    if (orderId) {
      await fetchOrderComments();
    } else if (serviceId) {
      await fetchServiceComments();
    }
  }, [serviceId, orderId, fetchServiceComments, fetchOrderComments]);

  // Create a new comment
  const createComment = useCallback(async (data: CreateServiceCommentInput) => {
    // Check permissions
    if (user?.userType === 'customer') {
      throw new Error('Customers cannot create comments');
    }

    // Validate template selection
    if (!data.templateId || data.templateId.trim() === '') {
      throw new Error('Template selection is required');
    }

    // Validate text - this will throw if validation fails
    validateCommentText(data.finalText);

    // Set default visibility
    const commentData = {
      ...data,
      isInternalOnly: data.isInternalOnly !== undefined ? data.isInternalOnly : true
    };

    try {
      const response = await fetch(`/api/services/${serviceId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create comment' }));
        throw new Error(errorData.error || 'Failed to create comment');
      }

      const result = await response.json();

      // Add the new comment to the list
      const newComment = result.comment || result;
      setComments(prev => [newComment, ...prev].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (err: any) {
      if (err.message.includes('cannot') || err.message.includes('required') || err.message.includes('must')) {
        throw err; // Re-throw validation errors
      }
      throw new Error('Failed to create comment');
    }
  }, [serviceId, user]);

  // Update an existing comment
  const updateComment = useCallback(async (commentId: string, data: UpdateServiceCommentInput) => {
    // Check permissions
    if (user?.userType === 'vendor') {
      throw new Error('Vendors cannot edit comments');
    }
    if (user?.userType === 'customer') {
      throw new Error('Customers cannot edit comments');
    }

    // Validate text
    validateCommentText(data.finalText);

    try {
      const response = await fetch(`/api/services/${serviceId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to edit this comment');
        }
        throw new Error('Failed to update comment');
      }

      // Refetch to get updated data
      await fetchComments();
    } catch (err: any) {
      if (err.message.includes('cannot') || err.message.includes('permission')) {
        throw err; // Re-throw validation/permission errors
      }
      throw new Error('Failed to update comment');
    }
  }, [serviceId, user, fetchComments]);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: string) => {
    // Check permissions
    if (user?.userType === 'vendor') {
      throw new Error('Vendors cannot delete comments');
    }
    if (user?.userType === 'customer') {
      throw new Error('Customers cannot delete comments');
    }

    try {
      const response = await fetch(`/api/services/${serviceId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this comment');
        }
        throw new Error('Failed to delete comment');
      }

      // Remove from local state
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      if (err.message.includes('cannot') || err.message.includes('permission')) {
        throw err;
      }
      throw new Error('Failed to delete comment');
    }
  }, [serviceId, user]);

  // Get comment count for a specific service
  const getCommentCount = useCallback((serviceId: string): number => {
    if (commentsByService && commentsByService[serviceId]) {
      return commentsByService[serviceId].length;
    }
    return 0;
  }, [commentsByService]);

  // Check if visibility change requires a warning
  const checkVisibilityChangeWarning = useCallback(async (
    commentId: string,
    newVisibility: boolean
  ): Promise<string | null> => {
    const comment = comments.find((c: any) => c.id === commentId);
    if (!comment) return null;

    // Warning when changing from internal to external (newVisibility false = external)
    if (comment.isInternalOnly === true && newVisibility === false) {
      return 'Warning: This will make the comment visible to customers. Continue?';
    }

    return null;
  }, [comments]);

  // Permission check functions
  const canCreateComment = useCallback((): boolean => {
    return user?.userType === 'internal' || user?.userType === 'vendor';
  }, [user]);

  const canEditComment = useCallback((commentId?: string): boolean => {
    if (!user) return false;
    return user.userType === 'internal';
  }, [user]);

  const canDeleteComment = useCallback((commentId?: string): boolean => {
    if (!user) return false;
    return user.userType === 'internal';
  }, [user]);

  // Get available templates
  const getAvailableTemplates = useCallback(async (
    serviceType: string,
    serviceStatus: string
  ): Promise<any[]> => {
    try {
      const response = await fetch(
        `/api/comment-templates?serviceType=${serviceType}&serviceStatus=${serviceStatus}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      const fetchedTemplates = data.templates || data;
      setTemplates(fetchedTemplates);
      return fetchedTemplates;
    } catch (err) {
      clientLogger.error('Error fetching templates', { error: err, serviceType, serviceStatus });
      return [];
    }
  }, []);

  // Apply template with placeholders
  const applyTemplate = useCallback((
    templateId: string,
    placeholderValues: Record<string, string>
  ): string => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return '';

    let text = template.text || '';
    Object.entries(placeholderValues).forEach(([key, value]) => {
      text = text.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    });

    return text;
  }, [templates]);

  // Extract placeholders from template text
  const extractPlaceholders = useCallback((templateText: string): string[] => {
    const matches = templateText.match(/\[([^\]]+)\]/g) || [];
    return matches.map(match => match.slice(1, -1));
  }, []);

  // Get visible comments based on user type
  const getVisibleComments = useCallback((): ServiceCommentWithRelations[] => {
    if (!user) return comments;
    if (user.userType === 'customer') {
      return comments.filter(c => !c.isInternalOnly);
    }
    return comments;
  }, [comments, user]);

  // Get sorted comments (already sorted newest first)
  const getSortedComments = useCallback((): ServiceCommentWithRelations[] => {
    return comments;
  }, [comments]);

  // Check if text has unreplaced placeholders
  const hasUnreplacedPlaceholders = useCallback((text: string): boolean => {
    return /\[.*?\]/.test(text);
  }, []);

  // Check if delete requires confirmation (always true for now)
  const requiresDeleteConfirmation = useCallback((): boolean => {
    return true;
  }, []);

  // Initial fetch
  useEffect(() => {
    // Skip initial fetch if no serviceId or orderId
    if (!serviceId && !orderId) return;
    fetchComments();
  }, [fetchComments, serviceId, orderId]);

  // Auto-fetch templates if serviceType and serviceStatus are provided
  useEffect(() => {
    if (serviceType && serviceStatus) {
      getAvailableTemplates(serviceType, serviceStatus);
    }
  }, [serviceType, serviceStatus, getAvailableTemplates]);

  return {
    comments,
    commentsByService,
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    refetch: fetchComments,
    getCommentCount,
    checkVisibilityChangeWarning,
    canCreateComment,
    canEditComment,
    canDeleteComment,
    getAvailableTemplates,
    applyTemplate,
    extractPlaceholders,
    getVisibleComments,
    getSortedComments,
    availableTemplates: templates,
    hasUnreplacedPlaceholders,
    requiresDeleteConfirmation
  };
}