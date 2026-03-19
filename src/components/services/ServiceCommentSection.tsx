// /GlobalRX_v2/src/components/services/ServiceCommentSection.tsx

"use client";

import React, { useState } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { useServiceComments } from '@/hooks/useServiceComments';
import { ServiceCommentCard } from './ServiceCommentCard';
import { CommentCreateModal } from './CommentCreateModal';
import { CommentEditModal } from './CommentEditModal';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import type { ServiceCommentWithRelations } from '@/types/comment-template';

interface ServiceCommentSectionProps {
  serviceId: string; // ServiceFulfillment ID when it exists, OrderItem ID otherwise - used for comment lookup
  orderItemId?: string; // OrderItem ID - used for API calls to create/update comments
  orderId?: string;
  serviceName?: string;
  serviceType?: string;
  serviceStatus?: string;
}

// UUID validation regex for security - prevents injection attacks
// FULFILLMENT ID STANDARDIZATION: All service IDs are now consistently UUIDs (OrderItem IDs)
// SECURITY IMPROVEMENT (March 10, 2026): Added UUID validation to prevent injection
// This regex ensures all service and fulfillment IDs match the expected UUID format
// preventing potential SQL injection or path traversal attacks through malformed IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper function to validate service ID for API calls
// Ensures service IDs are valid UUIDs to prevent injection attacks
function validateServiceId(serviceId: string): string {
  // Validate service ID format
  if (!serviceId || serviceId === 'null' || serviceId === 'undefined') {
    throw new Error('Cannot perform operation: Invalid service ID');
  }

  // Validate UUID format to prevent injection
  if (!UUID_REGEX.test(serviceId)) {
    throw new Error(`Cannot perform operation: Invalid service ID format: ${serviceId}`);
  }

  return serviceId;
}

export function ServiceCommentSection({ serviceId, orderItemId, orderId, serviceName = "Service", serviceType, serviceStatus }: ServiceCommentSectionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Passive validation: Log invalid IDs for monitoring but don't block rendering
  // Active validation: validateServiceId() throws errors during API operations
  React.useEffect(() => {
    if (serviceId && !UUID_REGEX.test(serviceId)) {
      clientLogger.error('Invalid serviceId format', { serviceId });
    }
    if (orderId && !UUID_REGEX.test(orderId)) {
      clientLogger.error('Invalid orderId format', { orderId });
    }
  }, [serviceId, orderId]);
  const {
    comments,
    commentsByService,
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    canCreateComment: checkCanCreate,
    canEditComment,
    canDeleteComment,
    getAvailableTemplates,
    availableTemplates,
    getSortedComments
  } = useServiceComments(orderId ? null : serviceId, orderId, serviceType, serviceStatus);

  // Debug logging - using debug level for production
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      clientLogger.info('ServiceCommentSection render', {
        serviceId,
        orderId,
        hasCommentsByService: !!commentsByService,
        commentsByServiceKeys: commentsByService ? Object.keys(commentsByService) : [],
        directCommentsLength: comments?.length || 0,
        loading,
        error
      });
    }
  }, [serviceId, orderId, commentsByService, comments, loading, error]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<ServiceCommentWithRelations | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use the permission check from the hook - validates user has fulfillment permission
  // and is not a customer (customers cannot create comments per business rules)
  const canCreateComment = checkCanCreate();
  const hasTemplates = availableTemplates && availableTemplates.length > 0;

  // Check if user is a customer
  const isCustomer = user?.userType === 'customer';

  // Filter comments based on user role and service context
  // When using order mode (commentsByService), get comments for this specific service
  // When using service mode, use the comments directly
  const visibleComments = React.useMemo(() => {
    let serviceComments = comments;

    // If we're in order mode and have commentsByService, get comments for this specific service
    if (orderId && commentsByService) {
      // Use serviceId (OrderItem ID) to look up comments
      // API now consistently uses OrderItem IDs after fulfillment ID standardization
      const serviceData = commentsByService[serviceId];
      serviceComments = serviceData?.comments || [];

      if (process.env.NODE_ENV === 'development') {
        clientLogger.info('Extracting service comments from order data', {
          serviceId, // OrderItem ID (used for both operations and lookups)
          extractedCommentsLength: serviceComments.length
        });
      }
    }

    if (isCustomer) {
      // Customers can only see external comments (isInternalOnly = false)
      // This is a critical security filter to prevent exposure of sensitive internal notes
      return serviceComments.filter(c => !c.isInternalOnly);
    }
    // Internal users and vendors see all comments for full operational context
    return serviceComments;
  }, [comments, commentsByService, isCustomer, orderId, serviceId]);

  const handleCreateComment = async (data: {
    templateId: string;
    finalText: string;
    isInternalOnly?: boolean;
  }) => {
    try {
      // Use orderItemId for API call, or fallback to serviceId if not provided
      const apiServiceId = validateServiceId(orderItemId || serviceId);

      // Log without PII (exclude data which contains comment text)
      clientLogger.info('Creating comment', { apiServiceId, serviceId, orderItemId, orderId });
      await createComment({ ...data, serviceId: apiServiceId });
      setIsCreateModalOpen(false);
    } catch (error) {
      clientLogger.error('Failed to create comment', { error, serviceId });
      throw error;
    }
  };

  const handleUpdateComment = async (data: {
    finalText: string;
    isInternalOnly?: boolean;
  }) => {
    if (!editingComment) return;

    try {
      // Use orderItemId for API call, or fallback to serviceId if not provided
      const apiServiceId = validateServiceId(orderItemId || serviceId);

      await updateComment(editingComment.id, { ...data, serviceId: apiServiceId });
      setEditingComment(null);
    } catch (error) {
      clientLogger.error('Failed to update comment', { error, commentId: editingComment.id });
      throw error;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeleteConfirmId(commentId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      try {
        // Validate the service ID for API call
        const apiServiceId = validateServiceId(serviceId);

        // Use new signature with serviceId to avoid null ID issues
        await deleteComment(apiServiceId, deleteConfirmId);
        setDeleteConfirmId(null);
        setShowDeleteDialog(false);
      } catch (error) {
        clientLogger.error('Failed to delete comment', { error, commentId: deleteConfirmId });
        // Standardize error handling - throw error to be consistent with create/update
        throw error;
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
    setShowDeleteDialog(false);
  };

  const handleEditClick = (comment: ServiceCommentWithRelations) => {
    setEditingComment(comment);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="font-medium text-gray-900 flex-shrink-0">
          {t('serviceComments.title')} ({visibleComments.length})
        </h3>
        {canCreateComment && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="flex items-center gap-2 flex-shrink-0"
            disabled={!hasTemplates || loading}
            title={!hasTemplates ? 'Loading templates...' : undefined}
          >
            <MessageSquarePlus className="w-4 h-4" />
            {t('serviceComments.addComment')}
          </Button>
        )}
      </div>

      {/* Comments list or empty state */}
      {visibleComments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquarePlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>{t('serviceComments.emptyState')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleComments.map((comment) => (
            <ServiceCommentCard
              key={comment.id}
              comment={comment}
              onEdit={handleEditClick}
              onDelete={(id) => handleDeleteComment(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">{t('common.delete')} {t('serviceComments.comment')}</h2>
            <p className="mb-6 text-gray-600">
              {t('serviceComments.deleteConfirmation')}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelDelete}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                aria-label={t('common.confirmDelete')}
              >
                {t('common.confirmDelete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <CommentCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateComment}
          onCreateComment={handleCreateComment}
          onCancel={() => setIsCreateModalOpen(false)}
          serviceId={serviceId}
          serviceName={serviceName}
          templates={availableTemplates?.map(t => ({
            ...t,
            templateText: t.text
          }))}
        />
      )}

      {/* Edit Modal */}
      {editingComment && (
        <CommentEditModal
          isOpen={!!editingComment}
          onClose={() => setEditingComment(null)}
          onSubmit={handleUpdateComment}
          comment={editingComment}
        />
      )}
    </div>
  );
}