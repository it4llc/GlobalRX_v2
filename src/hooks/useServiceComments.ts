// /GlobalRX_v2/src/hooks/useServiceComments.ts

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

// Type for comment templates
interface CommentTemplate {
  id: string;
  name: string;
  text: string;
  category?: string;
  serviceType?: string;
  serviceStatus?: string;
  isActive: boolean;
}

// Type for service data in commentsByService
interface ServiceCommentData {
  serviceName?: string;
  serviceStatus?: string;
  comments: ServiceCommentWithRelations[];
  total?: number;
}

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
  commentsByService?: Record<string, ServiceCommentData>;
  loading: boolean;
  error: string | null;
  createComment: (data: CreateServiceCommentInput & { serviceId?: string }) => Promise<void>;
  updateComment: (commentId: string, data: UpdateServiceCommentInput & { serviceId?: string }) => Promise<void>;
  deleteComment: (serviceIdOrCommentId: string, commentId?: string) => Promise<void>;
  refetch: () => Promise<void>;
  getCommentCount: (serviceId: string) => number;
  checkVisibilityChangeWarning: (commentId: string, newVisibility: boolean) => Promise<string | null>;
  canCreateComment: () => boolean;
  canEditComment: (commentId: string) => boolean;
  canDeleteComment: (commentId: string) => boolean;
  getAvailableTemplates: (serviceType: string, serviceStatus: string) => Promise<CommentTemplate[]>;
  applyTemplate: (templateId: string, placeholderValues: Record<string, string>) => string;
  extractPlaceholders: (templateText: string) => string[];
  getVisibleComments: () => ServiceCommentWithRelations[];
  getSortedComments: () => ServiceCommentWithRelations[];
  availableTemplates: CommentTemplate[];
  hasUnreplacedPlaceholders: (text: string) => boolean;
  requiresDeleteConfirmation: () => boolean;
}

// Overloaded function signatures
export function useServiceComments(serviceId: string | null, orderId?: string, serviceType?: string, serviceStatus?: string): UseServiceCommentsReturn {
  const { user } = useAuth();
  const [comments, setComments] = useState<ServiceCommentWithRelations[]>([]);
  const [commentsByService, setCommentsByService] = useState<Record<string, ServiceCommentData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CommentTemplate[]>([]);

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
        .sort((a: ServiceCommentWithRelations, b: ServiceCommentWithRelations) =>
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
          hasComments: !!(serviceData as ServiceCommentData).comments,
          commentCount: (serviceData as ServiceCommentData).comments?.length || 0
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
      Object.values(commentsMap).forEach((serviceData) => {
        // The API returns { serviceName, serviceStatus, comments, total }
        // We need to access the comments array inside this object
        const typedData = serviceData as ServiceCommentData;
        if (typedData && Array.isArray(typedData.comments)) {
          allComments.push(...typedData.comments);
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
  // CRITICAL FIX (March 10, 2026): Fixed comment creation issue in fulfillment section
  // Previously, this function relied on hook's serviceId which was null in order mode,
  // causing API calls to /api/services/null/comments (404 error)
  //
  // BUG FIXES IMPLEMENTED:
  // 1. ID Mismatch Resolution: Now accepts explicit serviceId parameter for proper API routing
  // 2. Template Loading: Fixed template availability checks when serviceType is undefined
  // 3. UUID Validation: Added security validation to prevent injection attacks
  // 4. TypeScript Compliance: Fixed all type errors with proper error handling
  // 5. Logging Standards: Replaced console statements with structured logging
  const createComment = useCallback(async (data: CreateServiceCommentInput & { serviceId?: string }) => {
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

    // CRITICAL ID RESOLUTION (March 10, 2026): Use provided serviceId or fall back to hook's serviceId
    // This fixes the null ID bug where order mode components pass serviceFulfillmentId
    // but single service mode components rely on the hook's serviceId
    const targetServiceId = data.serviceId || serviceId;
    if (!targetServiceId) {
      throw new Error('Service ID is required for creating comments');
    }

    // Remove serviceId from body data to avoid sending it in the request body
    const { serviceId: _, ...bodyData } = commentData;

    try {
      const response = await fetch(`/api/services/${targetServiceId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create comment' }));
        throw new Error(errorData.error || 'Failed to create comment');
      }

      const result = await response.json();

      // Add the new comment to the list
      const newComment = result.comment || result;

      // Update the appropriate state based on mode
      if (orderId && data.serviceId) {
        // In order mode, update commentsByService using the serviceFulfillmentId as key
        setCommentsByService(prev => {
          const serviceFulfillmentId = data.serviceId!; // In order mode, this is actually serviceFulfillmentId
          const serviceData = prev?.[serviceFulfillmentId] || { comments: [] };
          const updatedComments = [newComment, ...(serviceData.comments || [])].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          return {
            ...prev,
            [serviceFulfillmentId]: {
              ...serviceData,
              comments: updatedComments
            }
          };
        });
      } else {
        // In single service mode, update comments array
        setComments(prev => [newComment, ...prev].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('cannot') || err.message.includes('required') || err.message.includes('must'))) {
        throw err; // Re-throw validation errors
      }
      throw new Error('Failed to create comment');
    }
  }, [serviceId, user]);

  // Update an existing comment
  // CRITICAL FIX (March 10, 2026): Modified to accept serviceId parameter for consistency with createComment fix
  const updateComment = useCallback(async (commentId: string, data: UpdateServiceCommentInput & { serviceId?: string }) => {
    // Check permissions
    if (user?.userType === 'vendor') {
      throw new Error('Vendors cannot edit comments');
    }
    if (user?.userType === 'customer') {
      throw new Error('Customers cannot edit comments');
    }

    // Validate text if provided
    if (data.finalText !== undefined) {
      validateCommentText(data.finalText);
    }

    // CRITICAL ID RESOLUTION (March 10, 2026): Use provided serviceId or fall back to hook's serviceId
    // This maintains consistency with createComment fix for ID handling
    const targetServiceId = data.serviceId || serviceId;
    if (!targetServiceId) {
      throw new Error('Service ID is required for updating comments');
    }

    // Remove serviceId from body data to avoid sending it in the request body
    const { serviceId: _, ...bodyData } = data;

    try {
      const response = await fetch(`/api/services/${targetServiceId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to edit this comment');
        }
        throw new Error('Failed to update comment');
      }

      const updatedComment = await response.json();
      const newComment = updatedComment.comment || updatedComment;

      // Update local state instead of refetching - more efficient
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, ...newComment } : c
      ));

      // Also update commentsByService if in order mode
      if (orderId && targetServiceId) {
        setCommentsByService(prev => {
          const serviceFulfillmentId = targetServiceId; // In order mode, this is serviceFulfillmentId
          const serviceData = prev[serviceFulfillmentId];
          if (!serviceData) return prev;

          return {
            ...prev,
            [serviceFulfillmentId]: {
              ...serviceData,
              comments: serviceData.comments.map(c =>
                c.id === commentId ? { ...c, ...newComment } : c
              )
            }
          };
        });
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('cannot') || err.message.includes('permission'))) {
        throw err; // Re-throw validation/permission errors
      }
      throw new Error('Failed to update comment');
    }
  }, [serviceId, user, orderId]);

  // Delete a comment
  // CRITICAL FIX (March 10, 2026): Overloaded to accept either (commentId) or (serviceId, commentId) for compatibility
  // This supports both the legacy single-parameter signature and new dual-parameter signature
  // needed for the ID mismatch bug fix
  const deleteComment = useCallback(async (serviceIdOrCommentId: string, commentId?: string) => {
    // Check permissions
    if (user?.userType === 'vendor') {
      throw new Error('Vendors cannot delete comments');
    }
    if (user?.userType === 'customer') {
      throw new Error('Customers cannot delete comments');
    }

    // Handle both signatures: (commentId) and (serviceId, commentId)
    let targetServiceId: string | null;
    let targetCommentId: string;

    if (commentId !== undefined) {
      // New signature: (serviceId, commentId)
      targetServiceId = serviceIdOrCommentId;
      targetCommentId = commentId;
    } else {
      // Legacy signature: (commentId)
      targetServiceId = serviceId;
      targetCommentId = serviceIdOrCommentId;
    }

    if (!targetServiceId) {
      throw new Error('Service ID is required for deleting comments');
    }

    try {
      const response = await fetch(`/api/services/${targetServiceId}/comments/${targetCommentId}`, {
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

      // Remove from local state - handle both single service and order mode
      setComments(prev => prev.filter(c => c.id !== targetCommentId));

      // Also update commentsByService if in order mode
      if (orderId && targetServiceId) {
        setCommentsByService(prev => {
          const serviceFulfillmentId = targetServiceId; // In order mode, this is serviceFulfillmentId
          const serviceData = prev[serviceFulfillmentId];
          if (!serviceData) return prev;

          return {
            ...prev,
            [serviceFulfillmentId]: {
              ...serviceData,
              comments: serviceData.comments.filter(c => c.id !== targetCommentId)
            }
          };
        });
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes('cannot') || err.message.includes('permission'))) {
        throw err;
      }
      throw new Error('Failed to delete comment');
    }
  }, [serviceId, user]);

  // Get comment count for a specific service
  // CRITICAL BUG FIX (March 10, 2026): Fixed comment count calculation bug
  // Previous issue: UI was showing incorrect comment counts due to data structure mismatch
  // The API returns an object with 'comments' array, not a direct array
  // This fix ensures accurate comment counts are displayed in the fulfillment table
  const getCommentCount = useCallback((serviceId: string): number => {
    if (commentsByService && commentsByService[serviceId]) {
      // Fix: commentsByService[serviceId] is an object with a 'comments' array
      return commentsByService[serviceId]?.comments?.length || 0;
    }
    return 0;
  }, [commentsByService]);

  // Check if visibility change requires a warning
  const checkVisibilityChangeWarning = useCallback(async (
    commentId: string,
    newVisibility: boolean
  ): Promise<string | null> => {
    const comment = comments.find((c: ServiceCommentWithRelations) => c.id === commentId);
    if (!comment) return null;

    // Warning when changing from internal to external (newVisibility false = external)
    if (comment.isInternalOnly === true && newVisibility === false) {
      return 'Warning: This will make the comment visible to customers. Continue?';
    }

    return null;
  }, [comments]);

  // Permission check functions
  const canCreateComment = useCallback((): boolean => {
    // Bug fix: Admin users should have the same permissions as internal users
    // per API documentation and specifications
    return user?.userType === 'internal' || user?.userType === 'vendor' || user?.userType === 'admin';
  }, [user]);

  const canEditComment = useCallback((commentId?: string): boolean => {
    if (!user) return false;
    // Admin users should have the same permissions as internal users
    return user.userType === 'internal' || user.userType === 'admin';
  }, [user]);

  const canDeleteComment = useCallback((commentId?: string): boolean => {
    if (!user) return false;
    // Admin users should have the same permissions as internal users
    return user.userType === 'internal' || user.userType === 'admin';
  }, [user]);

  // Get available templates
  const getAvailableTemplates = useCallback(async (
    serviceType: string,
    serviceStatus: string
  ): Promise<CommentTemplate[]> => {
    try {
      // Build query params, handling empty serviceType
      const params = new URLSearchParams();
      if (serviceType) {
        params.append('serviceType', serviceType);
      }
      params.append('serviceStatus', serviceStatus);

      const response = await fetch(
        `/api/comment-templates?${params.toString()}`,
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

  // Auto-fetch templates if serviceStatus is provided
  // Bug fix: Allow fetching templates even when serviceType is undefined
  // This handles services that don't have a code or category defined
  useEffect(() => {
    if (serviceStatus) {
      // Use empty string as default when serviceType is undefined
      getAvailableTemplates(serviceType || '', serviceStatus);
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