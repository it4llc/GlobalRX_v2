// /GlobalRX_v2/src/components/modules/workflows/sections/workflow-section-dialog.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow } from '@/components/ui/form';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertBox } from '@/components/ui/alert-box';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlacementEnum, SectionTypeEnum } from '@/types/workflow-section';
import { useTranslation } from '@/contexts/TranslationContext';
import WorkflowSectionVariableReference from '@/components/modules/workflows/sections/WorkflowSectionVariableReference';

// Validation schema for workflow section
const sectionSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(100),
  placement: PlacementEnum,
  type: SectionTypeEnum,
  content: z.string().max(50000).optional(),
  displayOrder: z.union([
    z.string().transform((val) => val === '' ? 0 : parseInt(val, 10)),
    z.number()
  ]).default(0),
  isRequired: z.boolean().default(true),
});

type SectionFormValues = z.infer<typeof sectionSchema>;

interface WorkflowSection {
  id: string;
  name: string;
  placement: 'before_services' | 'after_services';
  type: 'text' | 'document';
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  displayOrder: number;
  isRequired: boolean;
}

interface WorkflowSectionDialogProps {
  workflowId: string;
  section: WorkflowSection | null;
  placement?: 'before_services' | 'after_services';
  onClose: (refreshData: boolean) => void;
  open: boolean;
}

export function WorkflowSectionDialog({
  workflowId,
  section,
  placement: defaultPlacement,
  onClose,
  open
}: WorkflowSectionDialogProps) {
  const dialogRef = useRef<DialogRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fetchWithAuth } = useAuth();
  const { t } = useTranslation();
  const [selectPortalContainer, setSelectPortalContainer] = useState<HTMLDivElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ fileName: string; fileUrl: string } | null>(
    section?.fileName && section?.fileUrl
      ? { fileName: section.fileName, fileUrl: section.fileUrl }
      : null
  );
  const [isUploading, setIsUploading] = useState(false);

  // Open/close dialog based on prop
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!open && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [open]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset
  } = useForm<SectionFormValues>({
    resolver: zodResolver(sectionSchema),
    mode: 'onChange',
    defaultValues: {
      name: section?.name || '',
      placement: section?.placement || defaultPlacement || 'before_services',
      type: section?.type || 'text',
      content: section?.content || '',
      displayOrder: section?.displayOrder ?? 0,
      isRequired: section?.isRequired ?? true,
    }
  });

  const watchedType = watch('type');
  const watchedName = watch('name');
  const watchedPlacement = watch('placement');

  // Removed debug logging

  // Reset form when dialog opens with different section
  useEffect(() => {
    if (open) {
      reset({
        name: section?.name || '',
        placement: section?.placement || defaultPlacement || 'before_services',
        type: section?.type || 'text',
        content: section?.content || '',
        displayOrder: section?.displayOrder ?? 0,
        isRequired: section?.isRequired ?? true,
      });
      setUploadedFile(
        section?.fileName && section?.fileUrl
          ? { fileName: section.fileName, fileUrl: section.fileUrl }
          : null
      );
      setError(null);
    }
  }, [open, section, defaultPlacement, reset]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.pdf', '.docx', '.doc'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedTypes.includes(fileExtension)) {
      setError('Only PDF and Word documents are allowed (.pdf, .docx, .doc)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must not exceed 10MB');
      return;
    }

    // If editing existing section with document type, upload immediately
    if (section?.id && watchedType === 'document') {
      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetchWithAuth(
          `/api/workflows/${workflowId}/sections/${section.id}/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload file');
        }

        const result = await response.json();
        setUploadedFile({
          fileName: result.fileName,
          fileUrl: result.fileUrl,
        });

        clientLogger.info('File uploaded successfully', {
          sectionId: section.id,
          fileName: result.fileName,
        });
      } catch (err) {
        const logMeta = errorToLogMeta(err);
        clientLogger.error('File upload failed', logMeta);
        setError(logMeta.message || 'Failed to upload file');
      } finally {
        setIsUploading(false);
      }
    } else {
      // For new sections, just store metadata
      setUploadedFile({
        fileName: file.name,
        fileUrl: '', // Will be set after section creation
      });
    }
  };

  const onSubmit = async (data: SectionFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = section
        ? `/api/workflows/${workflowId}/sections/${section.id}`
        : `/api/workflows/${workflowId}/sections`;

      const method = section ? 'PUT' : 'POST';

      // Don't send file data in JSON request
      const requestData = {
        ...data,
        displayOrder: data.displayOrder ?? 0,
      };

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error('This workflow has active orders and cannot be modified');
        }
        throw new Error(errorData.error || `Failed to ${section ? 'update' : 'create'} section`);
      }

      const result = await response.json();

      // If creating new document section and file was selected, upload it now
      if (!section && data.type === 'document' && uploadedFile && fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetchWithAuth(
          `/api/workflows/${workflowId}/sections/${result.id}/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          clientLogger.error('Failed to upload file for new section', {
            sectionId: result.id,
            status: uploadResponse.status,
          });
        }
      }

      clientLogger.info(`Section ${section ? 'updated' : 'created'} successfully`, {
        sectionId: result.id,
        workflowId,
      });

      onClose(true);
    } catch (err) {
      const logMeta = errorToLogMeta(err);
      clientLogger.error(`Failed to ${section ? 'update' : 'create'} section`, logMeta);
      setError(logMeta.message || `Failed to ${section ? 'update' : 'create'} section`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const characterCount = watch('content')?.length || 0;

  return (
    <ModalDialog
      ref={dialogRef}
      title={section ? t('admin.workflowSection.dialog.titleEdit') : t('admin.workflowSection.dialog.titleAdd')}
      onClose={() => onClose(false)}
      footer={
        <DialogFooter
          onCancel={() => onClose(false)}
          onConfirm={handleSubmit(onSubmit)}
          confirmText={section ? t('admin.workflowSection.dialog.confirmUpdate') : t('admin.workflowSection.dialog.confirmCreate')}
          disabled={!isValid || isSubmitting || isUploading}
          loading={isSubmitting}
        />
      }
    >
      <div ref={setSelectPortalContainer} />
      {error && <AlertBox type="error" message={error} className="mb-4" />}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormTable>
          <FormRow label={t('admin.workflowSection.dialog.nameLabel')} required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder={t('admin.workflowSection.dialog.namePlaceholder')}
              disabled={isSubmitting}
            />
          </FormRow>

          <FormRow label={t('admin.workflowSection.dialog.placementLabel')} required error={errors.placement?.message}>
            <Select
              value={watch('placement')}
              onValueChange={(value) => setValue('placement', value as 'before_services' | 'after_services', { shouldValidate: true })}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent container={selectPortalContainer}>
                <SelectItem value="before_services">{t('admin.workflowSection.dialog.placementBeforeServices')}</SelectItem>
                <SelectItem value="after_services">{t('admin.workflowSection.dialog.placementAfterServices')}</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label={t('admin.workflowSection.dialog.typeLabel')} required error={errors.type?.message}>
            <Select
              value={watch('type')}
              onValueChange={(value) => setValue('type', value as 'text' | 'document', { shouldValidate: true })}
              disabled={isSubmitting || !!section}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent container={selectPortalContainer}>
                <SelectItem value="text">{t('admin.workflowSection.dialog.typeText')}</SelectItem>
                <SelectItem value="document">{t('admin.workflowSection.dialog.typeDocument')}</SelectItem>
              </SelectContent>
            </Select>
          </FormRow>

          {watchedType === 'text' && (
            <>
              <FormRow
                label={t('admin.workflowSection.dialog.contentLabel')}
                error={errors.content?.message}
                description={`${characterCount}/50000 characters`}
              >
                <Textarea
                  {...register('content')}
                  placeholder={t('admin.workflowSection.dialog.contentPlaceholder')}
                  disabled={isSubmitting}
                  rows={8}
                  className="font-mono text-sm"
                />
              </FormRow>
              {/* v1 of the template-variable system: render a read-only
                  reference panel directly under the content textarea so
                  admins know which {{placeholders}} are available. */}
              <WorkflowSectionVariableReference />
            </>
          )}

          {watchedType === 'document' && (
            <FormRow
              label={t('admin.workflowSection.dialog.documentLabel')}
              description={t('admin.workflowSection.dialog.documentDescription')}
            >
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isSubmitting || isUploading}
                  className="mb-2"
                />
                {isUploading && <p className="text-sm text-muted-foreground">{t('admin.workflowSection.dialog.uploading')}</p>}
                {uploadedFile && (
                  <p className="text-sm text-muted-foreground">
                    {t('admin.workflowSection.dialog.currentFile')}: {uploadedFile.fileName}
                  </p>
                )}
              </div>
            </FormRow>
          )}

          <FormRow label={t('admin.workflowSection.dialog.displayOrderLabel')} error={errors.displayOrder?.message}>
            <Input
              type="number"
              {...register('displayOrder')}
              placeholder="0"
              disabled={isSubmitting}
              min={0}
            />
          </FormRow>

          <FormRow label={t('admin.workflowSection.dialog.requiredLabel')}>
            <Checkbox
              checked={watch('isRequired')}
              onCheckedChange={(checked) => setValue('isRequired', checked as boolean, { shouldValidate: true })}
              disabled={isSubmitting}
            />
          </FormRow>
        </FormTable>
      </form>
    </ModalDialog>
  );
}