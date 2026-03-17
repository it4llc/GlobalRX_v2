// /GlobalRX_v2/src/components/services/CommentCreateModal.tsx

"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ModalDialog, DialogFooter, DialogRef } from '@/components/ui/modal-dialog';
import { createServiceCommentSchema } from '@/lib/validations/service-comment';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CreateServiceCommentInput } from '@/types/comment-template';

// Interface for templates with the specific properties used in this modal
interface CommentModalTemplate {
  id: string;
  shortName?: string;
  longName?: string;
  name?: string;
  templateText?: string;  // Made optional to reflect actual API responses that may have undefined
  serviceTypes?: string[];
  statuses?: string[];
}

interface CommentCreateModalProps {
  serviceName?: string;
  templates?: CommentModalTemplate[];
  onCreateComment: (data: CreateServiceCommentInput) => Promise<void>;
  onCancel: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSubmit?: (data: CreateServiceCommentInput) => Promise<void>;
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
  const { t } = useTranslation();
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

  // Template text becomes editable starting point - major behavior change
  // Previously templates had rigid bracket validation and placeholder fields
  // Now the full template text (including brackets) appears in one editable textarea
  // Users can modify any part of the text, keeping or removing brackets as needed
  useEffect(() => {
    if (!selectedTemplate) {
      setFinalText('');
      return;
    }

    // Set template text as the initial value for the editable textarea
    // This text can be completely changed by the user - brackets are just regular text
    // FIX: Ensure templateText is never undefined to prevent runtime errors
    setFinalText(selectedTemplate.templateText || '');
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
  // FIX: Handle undefined finalText to prevent TypeError at runtime
  const characterCount = finalText?.length || 0;
  const maxCharacters = 1000;

  // Check if the text is empty or only whitespace
  // This validation prevents saving comments with no actual content
  // even if user starts with template text but deletes everything
  const isTextEmpty = !finalText || finalText.trim().length === 0;

  return (
    <ModalDialog
      ref={dialogRef}
      title={`${t('serviceComments.addCommentTo')} ${serviceName}`}
      maxWidth="lg"
      onClose={handleClose}
      footer={
        <DialogFooter
          onCancel={handleClose}
          onConfirm={handleSubmit}
          confirmText={t('common.addComment')}
          disabled={!selectedTemplateId || isTextEmpty || characterCount > maxCharacters || isSubmitting}
          loading={isSubmitting}
        />
      }
    >
      <div className="space-y-4">
        {/* Template Selection */}
        <div>
          <Label htmlFor="template">{t('serviceComments.template')} *</Label>
          <select
            id="template"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">{t('serviceComments.selectTemplate')}</option>
            {activeTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.shortName && template.longName
                  ? `${template.shortName} - ${template.longName}`
                  : template.name || t('serviceComments.unnamedTemplate')}
              </option>
            ))}
          </select>
        </div>

        {/* Editable Template Text */}
        {selectedTemplate && (
          <div>
            <Label htmlFor="comment-text">{t('serviceComments.commentText')} *</Label>
            <Textarea
              id="comment-text"
              className="mt-1"
              value={finalText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={6}
              disabled={isSubmitting}
              placeholder={t('serviceComments.enterComment')}
              aria-label="Comment text"
            />
            <div className={`text-sm mt-1 ${characterCount > maxCharacters ? 'text-red-600' : 'text-gray-500'}`}>
              {characterCount}/{maxCharacters} characters
            </div>
          </div>
        )}

        {/* Only show character count when template is selected and text is visible */}
        {/* When no template is selected, the character count is not relevant */}

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
            {t('serviceComments.internalOnlyLabel')}
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
            {t('serviceComments.noTemplatesAvailable')}
          </div>
        )}
      </div>
    </ModalDialog>
  );
});