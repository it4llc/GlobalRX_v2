// /GlobalRX_v2/src/components/services/ServiceCommentCard.tsx

"use client";

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Lock, Globe, Edit2, Trash2 } from 'lucide-react';
import type { ServiceCommentWithRelations } from '@/types/comment-template';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// Ensure Tailwind doesn't purge these classes
// bg-blue-50 border-blue-200 bg-gray-50 border-gray-300
// bg-yellow-50 border-yellow-300 bg-green-50 border-green-300
// bg-red-50 border-red-300

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
  const isCustomer = user?.userType === 'customer';

  // Status changes should never be editable or deletable
  // Regular comments: Vendors cannot edit or delete
  const canEdit = !comment.isStatusChange && isInternalUser;
  const canDelete = !comment.isStatusChange && isInternalUser;

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


  const isStatusChange = comment.isStatusChange === true || (comment.statusChangedFrom && comment.statusChangedTo);

  // Determine styles directly
  const getCardStyles = () => {
    if (isStatusChange) {
      // Status changes
      if (comment.statusChangedTo === 'Completed') {
        return { backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: '1px', borderStyle: 'solid' };
      } else if (comment.statusChangedTo === 'Cancelled' || comment.statusChangedTo === 'Cancelled-DNB') {
        return { backgroundColor: '#fee2e2', borderColor: '#fca5a5', borderWidth: '1px', borderStyle: 'solid' };
      } else {
        return { backgroundColor: '#fef3c7', borderColor: '#fde047', borderWidth: '1px', borderStyle: 'solid' };
      }
    } else {
      // Regular comments - ALL should be blue shaded
      // Internal-only comments get a slightly lighter blue shade
      if (comment.isInternalOnly === true) {
        return { backgroundColor: '#e0e7ff', borderColor: '#a5b4fc', borderWidth: '1px', borderStyle: 'solid' }; // Light blue for internal
      } else {
        return { backgroundColor: '#dbeafe', borderColor: '#93c5fd', borderWidth: '1px', borderStyle: 'solid' }; // Blue for external
      }
    }
  };

  const cardStyles = getCardStyles();

  return (
    <div
      data-testid={`comment-card-${comment.id}`}
      className={`p-3 rounded-lg ${isStatusChange ? 'ml-6 relative' : ''}`}
      style={cardStyles}
    >
      {/* Status change indicator bar */}
      {isStatusChange && (
        <div className={`absolute -left-4 top-0 bottom-0 w-1 rounded-l ${
          comment.statusChangedTo === 'Completed' ? 'bg-green-400' :
          comment.statusChangedTo === 'Cancelled' || comment.statusChangedTo === 'Cancelled-DNB' ? 'bg-red-400' :
          'bg-yellow-400'
        }`} />
      )}

      {/* Compact header with all info on one line */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          {/* Author and timestamp */}
          <div className="flex items-center gap-2">
            {!isCustomer && (
              <span className="font-medium">
                {comment.createdByName || comment.createdByUser?.name || 'Unknown User'}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {createdTimeAgo}
            </span>
          </div>

          {/* Status change indicator */}
          {comment.isStatusChange && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white/60 border">
              Status Change
            </span>
          )}

          {/* Only show badge for internal-only comments */}
          {comment.isInternalOnly === true && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-600 text-white">
              <Lock className="w-3 h-3" data-testid="lock-icon" />
              Internal Only
            </span>
          )}

          {/* Edit timestamp if exists */}
          {updatedInfo && !isCustomer && (
            <span className="text-xs text-gray-500 italic">
              (edited by {updatedInfo.userName} {updatedInfo.timeAgo})
            </span>
          )}
          {updatedInfo && isCustomer && (
            <span className="text-xs text-gray-500 italic">
              (edited {updatedInfo.timeAgo})
            </span>
          )}
        </div>

        {/* Action buttons */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1 ml-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="p-1 h-auto"
                aria-label="Edit comment"
              >
                <Edit2 className="w-3 h-3" />
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
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status change details or comment text */}
      {comment.isStatusChange ? (
        <div>
          {/* Status transition on same line as content */}
          {comment.statusChangedFrom && comment.statusChangedTo && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Status changed:</span>
              <span className="inline-flex px-2 py-0.5 rounded bg-white/70 text-gray-700 font-medium text-xs">
                {comment.statusChangedFrom}
              </span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className={`inline-flex px-2 py-0.5 rounded font-medium text-xs ${
                comment.statusChangedTo === 'Completed'
                  ? 'bg-green-600 text-white'
                  : comment.statusChangedTo === 'Cancelled' || comment.statusChangedTo === 'Cancelled-DNB'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
              }`}>
                {comment.statusChangedTo}
              </span>
              {/* Additional comment inline if short */}
              {comment.comment && comment.comment.length < 100 && (
                <span className="text-sm text-gray-600 ml-2">• {comment.comment}</span>
              )}
            </div>
          )}
          {/* Additional comment on new line if long */}
          {comment.comment && comment.comment.length >= 100 && (
            <div className="text-sm text-gray-700 mt-2">
              {comment.comment}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-700">
          {comment.finalText}
        </div>
      )}
    </div>
  );
}
