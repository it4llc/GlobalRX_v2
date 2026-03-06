"use client";

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Lock, Globe, Edit2, Trash2 } from 'lucide-react';
import type { ServiceCommentWithRelations } from '@/types/comment-template';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface ServiceCommentCardProps {
  comment: ServiceCommentWithRelations;
  onEdit?: (comment: ServiceCommentWithRelations) => void;
  onDelete?: (commentId: string) => void;
}

export function ServiceCommentCard({ comment, onEdit, onDelete }: ServiceCommentCardProps) {
  const { user } = useAuth();

  // Check user type
  const isInternalUser = user?.userType === 'internal';
  const isVendor = user?.userType === 'vendor';

  // Vendors cannot edit or delete comments
  const canEdit = isInternalUser;
  const canDelete = isInternalUser;

  const handleEdit = () => {
    if (canEdit && onEdit) {
      onEdit(comment);
    }
  };

  const handleDelete = () => {
    if (canDelete && onDelete) {
      onDelete(comment.id);
    }
  };

  // Format the creation date
  const createdTimeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  // Format the update date if exists
  const updatedInfo = comment.updatedAt && comment.updatedBy ? {
    timeAgo: formatDistanceToNow(new Date(comment.updatedAt), { addSuffix: true }),
    userName: comment.updatedByName || comment.updatedByUser?.name || 'Unknown'
  } : null;

  return (
    <div
      data-testid={`comment-card-${comment.id}`}
      className={`p-4 border rounded-lg ${
        comment.isInternalOnly ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'
      }`}
    >
      {/* Header with metadata */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* Author name */}
            <span className="font-medium text-sm">
              {comment.createdByName || comment.createdByUser?.name || 'Unknown User'}
            </span>

            {/* Visibility badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                comment.isInternalOnly
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {comment.isInternalOnly ? (
                <>
                  <Lock className="w-3 h-3" data-testid="lock-icon" />
                  Internal
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" data-testid="globe-icon" />
                  External
                </>
              )}
            </span>

            {/* Template name */}
            {(comment.templateName || comment.template?.name) && (
              <span className="text-xs text-gray-500">
                {comment.templateName || comment.template?.name}
              </span>
            )}
          </div>

          {/* Creation timestamp */}
          <div className="text-xs text-gray-500">
            {createdTimeAgo}
          </div>

          {/* Edit timestamp if exists */}
          {updatedInfo && (
            <div className="text-xs text-gray-500 italic mt-1">
              Edited by {updatedInfo.userName} {updatedInfo.timeAgo}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="p-1 h-auto"
                aria-label="Edit comment"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="p-1 h-auto text-red-500 hover:text-red-700"
                aria-label="Delete comment"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Comment text */}
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {comment.finalText}
      </div>
    </div>
  );
}