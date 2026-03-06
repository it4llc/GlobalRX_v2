"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ModalDialog, DialogFooter, DialogRef } from '@/components/ui/modal-dialog';
import { updateServiceCommentSchema } from '@/lib/schemas/serviceCommentSchemas';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import type { ServiceCommentWithRelations } from '@/types/comment-template';

interface CommentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  comment: ServiceCommentWithRelations;
}

export function CommentEditModal({
  isOpen,
  onClose,
  onSubmit,
  comment
}: CommentEditModalProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [finalText, setFinalText] = useState(comment.finalText);
  const [isInternalOnly, setIsInternalOnly] = useState(comment.isInternalOnly);
  const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when comment changes
  useEffect(() => {
    setFinalText(comment.finalText);
    setIsInternalOnly(comment.isInternalOnly);
    setShowVisibilityWarning(false);
    setError(null);
  }, [comment]);

  // Open/close modal based on isOpen prop
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!isOpen && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  const handleVisibilityChange = (checked: boolean) => {
    // Show warning when changing from internal to external
    if (comment.isInternalOnly && !checked) {
      setShowVisibilityWarning(true);
    } else {
      setShowVisibilityWarning(false);
    }
    setIsInternalOnly(checked);
  };

  const handleSubmit = async () => {
    setError(null);

    // Check if anything actually changed
    const hasChanges = finalText !== comment.finalText || isInternalOnly !== comment.isInternalOnly;

    if (!hasChanges) {
      handleClose();
      return;
    }

    try {
      // Build update data with only changed fields
      const updateData: any = {};
      if (finalText !== comment.finalText) {
        updateData.finalText = finalText;
      }
      if (isInternalOnly !== comment.isInternalOnly) {
        updateData.isInternalOnly = isInternalOnly;
      }

      // Validate the data
      const validationResult = updateServiceCommentSchema.safeParse(updateData);

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        setError(firstError.message);
        return;
      }

      setIsSubmitting(true);
      await onSubmit(validationResult.data);

      // Close on success
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setFinalText(comment.finalText);
    setIsInternalOnly(comment.isInternalOnly);
    setShowVisibilityWarning(false);
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  // Character count
  const characterCount = finalText.length;
  const maxCharacters = 1000;

  return (
    <ModalDialog
      ref={dialogRef}
      title="Edit Comment"
      maxWidth="lg"
      onClose={handleClose}
      footer={
        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmText="Save Changes"
          disabled={characterCount > maxCharacters || isSubmitting}
          loading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        {/* Template Info */}
        {comment.template && (
          <div className="text-sm text-gray-600">
            Template: <span className="font-medium">{comment.template.name}</span>
          </div>
        )}

        {/* Comment Text Editor */}
        <div>
          <Label htmlFor="comment-text">Comment Text *</Label>
          <Textarea
            id="comment-text"
            className="mt-1"
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            rows={6}
            disabled={isSubmitting}
            placeholder="Enter comment text..."
          />
          <div className={`text-sm mt-1 ${characterCount > maxCharacters ? 'text-red-600' : 'text-gray-500'}`}>
            {characterCount}/{maxCharacters} characters
          </div>
        </div>

        {/* Visibility Toggle */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-internal-only"
              checked={isInternalOnly}
              onCheckedChange={handleVisibilityChange}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="edit-internal-only"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Internal Only (not visible to customers)
            </Label>
          </div>

          {/* Visibility Change Warning */}
          {showVisibilityWarning && (
            <div className="flex items-start gap-2 p-3 text-amber-700 bg-amber-50 rounded-md">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Warning: Making this comment external</p>
                <p>This will make the comment visible to customers. Are you sure you want to continue?</p>
              </div>
            </div>
          )}
        </div>

        {/* Edit History */}
        {comment.updatedAt && comment.updatedByUser && (
          <div className="text-xs text-gray-500 italic">
            Last edited by {comment.updatedByUser.name} on {new Date(comment.updatedAt).toLocaleString()}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-md">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}