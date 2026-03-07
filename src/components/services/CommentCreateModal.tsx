// /GlobalRX_v2/src/components/services/CommentCreateModal.tsx

"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ModalDialog, DialogFooter, DialogRef } from '@/components/ui/modal-dialog';
import { createServiceCommentSchema } from '@/lib/validations/service-comment';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';

interface CommentCreateModalProps {
  serviceName?: string;
  templates?: any[];
  onCreateComment: (data: any) => Promise<void>;
  onCancel: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSubmit?: (data: any) => Promise<void>;
  serviceId?: string;
}

export const CommentCreateModal = forwardRef<DialogRef, CommentCreateModalProps>(
  ({
    serviceName = "Service",
    templates = [],
    onCreateComment,
    onCancel,
    isOpen,
    onClose,
    onSubmit,
    serviceId
  }, ref) => {
  const dialogRef = useRef<DialogRef>(null);

  // Use ref from parent if provided, otherwise use local ref
  useImperativeHandle(ref, () => ({
    showModal: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close()
  }));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isInternalOnly, setIsInternalOnly] = useState(true); // Default to true as per spec
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get active templates only (assume all provided templates are active)
  const activeTemplates = templates || [];

  // Get selected template details
  const selectedTemplate = activeTemplates.find(t => t.id === selectedTemplateId);

  // Open/close modal based on isOpen prop
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!isOpen && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  // Update final text when template changes
  // Template text becomes the initial value that users can edit freely
  useEffect(() => {
    if (!selectedTemplate) {
      setFinalText('');
      return;
    }

    // Set template text as the initial value for the editable textarea
    setFinalText(selectedTemplate.templateText);
  }, [selectedTemplate]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setError(null);
  };

  const handleTextChange = (value: string) => {
    setFinalText(value);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    try {
      // Validate the data
      console.log('Validating comment data:', {
        templateId: selectedTemplateId,
        finalText: finalText.substring(0, 50) + '...',
        isInternalOnly
      });
      const validationResult = createServiceCommentSchema.safeParse({
        templateId: selectedTemplateId,
        finalText,
        isInternalOnly
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        setError(firstError.message);
        return;
      }

      setIsSubmitting(true);
      // Use onCreateComment if provided, otherwise fallback to onSubmit
      const submitFn = onCreateComment || onSubmit;
      if (submitFn) {
        await submitFn(validationResult.data);
      }

      // Reset form and close
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create comment');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setSelectedTemplateId('');
    setFinalText('');
    setIsInternalOnly(true);
    setError(null);
    setIsSubmitting(false);
    // Use onCancel if provided, otherwise fallback to onClose
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  };

  // Character count
  const characterCount = finalText.length;
  const maxCharacters = 1000;

  // Check if the text is empty or only whitespace
  const isTextEmpty = !finalText || finalText.trim().length === 0;

  return (
    <ModalDialog
      ref={dialogRef}
      title={`Add Comment to ${serviceName}`}
      maxWidth="lg"
      onClose={handleClose}
      footer={
        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmText="Add Comment"
          disabled={!selectedTemplateId || isTextEmpty || characterCount > maxCharacters || isSubmitting}
          loading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        {/* Template Selection */}
        <div>
          <Label htmlFor="template">Template *</Label>
          <select
            id="template"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select a template...</option>
            {activeTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.shortName && template.longName
                  ? `${template.shortName} - ${template.longName}`
                  : template.name || 'Unnamed Template'}
              </option>
            ))}
          </select>
        </div>

        {/* Editable Template Text */}
        {selectedTemplate && (
          <div>
            <Label htmlFor="comment-text">Comment Text *</Label>
            <Textarea
              id="comment-text"
              className="mt-1"
              value={finalText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={6}
              disabled={isSubmitting}
              placeholder="Enter your comment..."
              aria-label="Comment text"
            />
            <div className={`text-sm mt-1 ${characterCount > maxCharacters ? 'text-red-600' : 'text-gray-500'}`}>
              {characterCount}/{maxCharacters} characters
            </div>
          </div>
        )}

        {/* Show character count when no template selected */}
        {!selectedTemplate && (
          <div className="text-sm text-gray-500">
            0/{maxCharacters} characters
          </div>
        )}

        {/* Visibility Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="internal-only"
            checked={isInternalOnly}
            onCheckedChange={(checked) => setIsInternalOnly(checked as boolean)}
            disabled={isSubmitting}
          />
          <Label
            htmlFor="internal-only"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Internal Only (not visible to customers)
          </Label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-md">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* No templates warning */}
        {activeTemplates.length === 0 && (
          <div className="p-4 text-amber-700 bg-amber-50 rounded-md">
            No active templates available. Please contact an administrator to create templates.
          </div>
        )}
      </div>
    </ModalDialog>
  );
});