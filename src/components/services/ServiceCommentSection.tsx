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
  serviceId: string; // OrderItem ID for creating/updating comments (comments.orderItemId)
  orderId?: string;
  serviceName?: string;
  serviceType?: string;
  serviceStatus?: string;
  serviceFulfillmentId?: string; // ServiceFulfillment ID for fetching comments in order mode (API response key)

  /* ID USAGE EXPLANATION:
   * - serviceId: Always OrderItem.id - used for comment CRUD operations
   * - serviceFulfillmentId: Always ServicesFulfillment.id - used to lookup comments from order API response
   * This dual-ID pattern was necessary to fix the comment display bug where IDs were mismatched */
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ServiceCommentSection({ serviceId, orderId, serviceName = "Service", serviceType, serviceStatus, serviceFulfillmentId }: ServiceCommentSectionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Validate IDs to prevent injection issues
  React.useEffect(() => {
    if (serviceId && !UUID_REGEX.test(serviceId)) {
      clientLogger.error('Invalid serviceId format', { serviceId });
    }
    if (serviceFulfillmentId && !UUID_REGEX.test(serviceFulfillmentId)) {
      clientLogger.error('Invalid serviceFulfillmentId format', { serviceFulfillmentId });
    }
    if (orderId && !UUID_REGEX.test(orderId)) {
      clientLogger.error('Invalid orderId format', { orderId });
    }
  }, [serviceId, serviceFulfillmentId, orderId]);
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

  // Debug logging
  React.useEffect(() => {
    clientLogger.info('ServiceCommentSection render', {
      serviceId,
      orderId,
      hasCommentsByService: !!commentsByService,
      commentsByServiceKeys: commentsByService ? Object.keys(commentsByService) : [],
      directCommentsLength: comments?.length || 0,
      loading,
      error
    });
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
    if (orderId && commentsByService && serviceFulfillmentId) {
      // CRITICAL FIX: Use serviceFulfillmentId to look up comments (API keys by ServiceFulfillment ID)
      // This was the root cause of the comment display bug - API returns results keyed by
      // ServicesFulfillment.id but UI was trying to use OrderItem.id as the lookup key
      const serviceData = commentsByService[serviceFulfillmentId];
      serviceComments = serviceData?.comments || [];

      clientLogger.info('Extracting service comments from order data', {
        serviceId, // OrderItem ID (used for comment operations)
        serviceFulfillmentId, // ServiceFulfillment ID (used as lookup key for API response)
        hasServiceData: !!serviceData,
        serviceDataKeys: serviceData ? Object.keys(serviceData) : [],
        extractedCommentsLength: serviceComments.length,
        allServiceIds: Object.keys(commentsByService),
        bugFixNote: 'Using serviceFulfillmentId as lookup key (was causing comment display bug)'
      });
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
      // CRITICAL BUG FIX (March 10, 2026): Correct ID type selection for API call
      // Root cause: API expects ServiceFulfillment ID but frontend was passing OrderItem ID
      // In order mode, use serviceFulfillmentId for API call (API expects ServiceFulfillment ID)
      // In single service mode, use serviceId directly
      // This prevents the "POST /api/services/null/comments 404" error
      const apiServiceId = orderId && serviceFulfillmentId ? serviceFulfillmentId : serviceId;

      // Validate service ID before API call
      if (!apiServiceId || apiServiceId === 'null' || apiServiceId === 'undefined') {
        clientLogger.error('Invalid service ID for comment creation', { apiServiceId, serviceId, serviceFulfillmentId, orderId });
        throw new Error('Cannot create comment: Invalid service ID');
      }

      // Log without PII (exclude data which contains comment text)
      clientLogger.info('Creating comment', { apiServiceId, serviceId, serviceFulfillmentId, orderId });
      await createComment({ ...data, serviceId: apiServiceId });
      setIsCreateModalOpen(false);
    } catch (error) {
      clientLogger.error('Failed to create comment', { error, serviceId, serviceFulfillmentId });
      throw error;
    }
  };

  const handleUpdateComment = async (data: {
    finalText: string;
    isInternalOnly?: boolean;
  }) => {
    if (!editingComment) return;

    try {
      // CRITICAL BUG FIX (March 10, 2026): Use same ID resolution pattern as create
      // In order mode, use serviceFulfillmentId for API call (API expects ServiceFulfillment ID)
      // In single service mode, use serviceId directly
      const apiServiceId = orderId && serviceFulfillmentId ? serviceFulfillmentId : serviceId;

      // Validate service ID before API call
      if (!apiServiceId || apiServiceId === 'null' || apiServiceId === 'undefined') {
        clientLogger.error('Invalid service ID for comment update', { apiServiceId, serviceId, serviceFulfillmentId, orderId });
        throw new Error('Cannot update comment: Invalid service ID');
      }

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
        // CRITICAL BUG FIX (March 10, 2026): Use same ID resolution pattern as create/update
        // In order mode, use serviceFulfillmentId for API call (API expects ServiceFulfillment ID)
        // In single service mode, use serviceId directly
        const apiServiceId = orderId && serviceFulfillmentId ? serviceFulfillmentId : serviceId;

        // Validate service ID before API call
        if (!apiServiceId || apiServiceId === 'null' || apiServiceId === 'undefined') {
          clientLogger.error('Invalid service ID for comment deletion', { apiServiceId, serviceId, serviceFulfillmentId, orderId });
          throw new Error('Cannot delete comment: Invalid service ID');
        }

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          {t('serviceComments.title')} ({visibleComments.length})
        </h3>
        {canCreateComment && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="flex items-center gap-2"
            disabled={!hasTemplates}
            title={!hasTemplates ? 'No templates available for this service' : undefined}
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
          serviceId={serviceId}
          serviceName={serviceName}
          templates={availableTemplates}
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