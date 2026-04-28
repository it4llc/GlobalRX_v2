'use client';

import React, { useEffect, useRef } from 'react';
import { ModalDialog, DialogFooter, DialogRef } from '@/components/ui/modal-dialog';
import { InvitationAction } from '@/types/invitation-management';
import { useTranslation } from '@/contexts/TranslationContext';

interface InvitationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: InvitationAction;
  isLoading?: boolean;
}

export function InvitationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  action,
  isLoading = false
}: InvitationConfirmDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<DialogRef>(null);

  // Open/close modal based on isOpen prop
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!isOpen && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  const getDialogContent = () => {
    if (action === InvitationAction.EXTEND) {
      return {
        title: t('invitation.action.extend'),
        description: t('invitation.action.extendConfirm'),
        confirmText: isLoading ? t('invitation.action.extending') : t('invitation.action.extend')
      };
    } else {
      return {
        title: t('invitation.action.resend'),
        description: t('invitation.action.resendConfirm'),
        confirmText: isLoading ? t('invitation.action.resending') : t('invitation.action.resend')
      };
    }
  };

  const content = getDialogContent();

  return (
    <ModalDialog
      ref={dialogRef}
      title={content.title}
      onClose={onClose}
      data-testid="confirm-dialog"
      footer={
        <DialogFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          cancelText={t('common.cancel')}
          confirmText={content.confirmText}
          disabled={isLoading}
          loading={isLoading}
        />
      }
    >
      <p className="text-sm text-muted-foreground mb-4">
        {content.description}
      </p>
    </ModalDialog>
  );
}