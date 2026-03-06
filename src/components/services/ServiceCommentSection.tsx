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
  serviceId: string;
  serviceName?: string;
  serviceType?: string;
  serviceStatus?: string;
}

export function ServiceCommentSection({ serviceId, serviceName = "Service", serviceType, serviceStatus }: ServiceCommentSectionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    comments,
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
  } = useServiceComments(serviceId, undefined, serviceType, serviceStatus);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<ServiceCommentWithRelations | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use the permission check from the hook
  const canCreateComment = checkCanCreate();
  const hasTemplates = availableTemplates && availableTemplates.length > 0;

  // Check if user is a customer
  const isCustomer = user?.userType === 'customer';

  // Filter comments based on user role
  const visibleComments = React.useMemo(() => {
    const sorted = getSortedComments ? getSortedComments() : comments;
    if (isCustomer) {
      // Customers can only see external comments
      return sorted.filter(c => !c.isInternalOnly);
    }
    // Internal users and vendors see all comments
    return sorted;
  }, [comments, isCustomer, getSortedComments]);

  const handleCreateComment = async (data: any) => {
    try {
      await createComment(data);
      setIsCreateModalOpen(false);
    } catch (error) {
      clientLogger.error('Failed to create comment', { error });
      throw error;
    }
  };

  const handleUpdateComment = async (data: any) => {
    if (!editingComment) return;

    try {
      await updateComment(editingComment.id, data);
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
        await deleteComment(deleteConfirmId);
        setDeleteConfirmId(null);
        setShowDeleteDialog(false);
      } catch (error) {
        clientLogger.error('Failed to delete comment', { error, commentId: deleteConfirmId });
        // Don't throw here to avoid breaking UI
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
        <span className="ml-2 text-gray-500">Loading comments...</span>
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
            <h2 className="text-lg font-semibold mb-4">Delete Comment</h2>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this comment? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelDelete}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                aria-label="Confirm delete"
              >
                Confirm Delete
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