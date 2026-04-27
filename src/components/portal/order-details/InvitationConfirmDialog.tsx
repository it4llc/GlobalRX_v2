'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="confirm-dialog">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
          >
            {content.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}