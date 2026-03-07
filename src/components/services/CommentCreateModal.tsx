// /GlobalRX_v2/src/components/services/CommentCreateModal.tsx

"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ModalDialog, DialogFooter, DialogRef } from '@/components/ui/modal-dialog';
import { createServiceCommentSchema } from '@/lib/schemas/serviceCommentSchemas';
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
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
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

  // Update final text when template or placeholder values change
  // This provides live preview functionality so users can see exactly what
  // the comment will look like before saving (critical for accuracy)
  useEffect(() => {
    if (!selectedTemplate) {
      setFinalText('');
      return;
    }

    let text = selectedTemplate.templateText;

    // Extract placeholders from template text if not provided
    // Placeholders are in format [PLACEHOLDER_NAME] and must all be replaced
    const placeholders = selectedTemplate.placeholders ||
      (selectedTemplate.templateText.match(/\[([^\]]+)\]/g) || [])
        .map(match => match.slice(1, -1));

    // Replace placeholders with values - unreplaced placeholders will remain as [NAME]
    // This allows users to see which placeholders still need values
    placeholders.forEach(placeholder => {
      const value = placeholderValues[placeholder] || `[${placeholder}]`;
      // Replace all occurrences of the placeholder
      const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
      text = text.replace(regex, value);
    });

    setFinalText(text);
  }, [selectedTemplate, placeholderValues]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPlaceholderValues({});
    setError(null);
  };

  const handlePlaceholderChange = (placeholder: string, value: string) => {
    setPlaceholderValues(prev => ({
      ...prev,
      [placeholder]: value
    }));
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
    setPlaceholderValues({});
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
          disabled={!selectedTemplateId || characterCount > maxCharacters || isSubmitting}
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
                {template.shortName} - {template.longName}
              </option>
            ))}
          </select>
        </div>

        {/* Template Text with Placeholders */}
        {selectedTemplate && (
          <>
            <div>
              <Label>Template Text</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                {selectedTemplate.templateText.split(/(\[[^\]]+\])/).map((part, index) => {
                  const isPlaceholder = part.startsWith('[') && part.endsWith(']');
                  return (
                    <span
                      key={index}
                      className={isPlaceholder ? 'text-blue-600 font-medium' : ''}
                    >
                      {part}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Placeholder Fields */}
            {(() => {
              const placeholders = selectedTemplate.placeholders ||
                (selectedTemplate.templateText.match(/\[([^\]]+)\]/g) || [])
                  .map(match => match.slice(1, -1));

              return placeholders.length > 0 && (
                <div className="space-y-3">
                  <Label>Fill in the placeholders</Label>
                  {placeholders.map(placeholder => (
                  <div key={placeholder}>
                    <Label htmlFor={`placeholder-${placeholder}`} className="text-sm">
                      {placeholder} *
                    </Label>
                    <input
                      id={`placeholder-${placeholder}`}
                      type="text"
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      value={placeholderValues[placeholder] || ''}
                      onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                      placeholder={`Enter ${placeholder}`}
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
                </div>
              );
            })()}

            {/* Live Preview */}
            <div>
              <Label>Preview</Label>
              <Textarea
                className="mt-1"
                value={finalText}
                readOnly
                rows={4}
              />
              <div className={`text-sm mt-1 ${characterCount > maxCharacters ? 'text-red-600' : 'text-gray-500'}`}>
                {characterCount}/1000 characters
              </div>
            </div>
          </>
        )}

        {/* Show character count when no template selected */}
        {!selectedTemplate && (
          <div className="text-sm text-gray-500">
            0/1000 characters
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