// /GlobalRX_v2/src/components/portal/InviteCandidateDialog.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { ModalDialog, DialogRef } from '@/components/ui/modal-dialog';
import { PackageSelectionStep } from './PackageSelectionStep';
import { CandidateInfoStep } from './CandidateInfoStep';
import { InvitationSuccessStep } from './InvitationSuccessStep';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  DialogStep,
  PackageOption,
  InviteFormData,
  InvitationResponse,
  DialogState
} from '@/types/inviteCandidate';

interface InviteCandidateDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export default function InviteCandidateDialog({ open, onOpenChange, onClose }: InviteCandidateDialogProps) {
  const dialogRef = useRef<DialogRef>(null);
  const { toastError, toastSuccess } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<DialogState>({
    currentStep: DialogStep.PackageSelection,
    isLoading: false,
    error: null,
    formData: {},
    packages: [],
    invitationResult: null
  });

  // Fetch packages when dialog opens
  useEffect(() => {
    if (open) {
      fetchPackages();
    } else {
      // Reset state when dialog closes
      setState({
        currentStep: DialogStep.PackageSelection,
        isLoading: false,
        error: null,
        formData: {},
        packages: [],
        invitationResult: null
      });
    }
  }, [open]);

  // Handle declarative open/close
  useEffect(() => {
    if (open !== undefined && dialogRef.current) {
      if (open) {
        dialogRef.current.showModal();
      } else {
        dialogRef.current.close();
      }
    }
  }, [open]);

  const fetchPackages = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/packages?hasWorkflow=true');

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t('portal.inviteCandidate.errorNoPermission'));
        }
        throw new Error(t('portal.inviteCandidate.errorNetworkFailure'));
      }

      const packages: PackageOption[] = await response.json();
      setState(prev => ({ ...prev, packages, isLoading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('portal.inviteCandidate.errorNetworkFailure');
      toastError(message);
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  };

  const handlePackageNext = (packageId: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, packageId },
      currentStep: DialogStep.CandidateInfo
    }));
  };

  const handleCandidateBack = () => {
    setState(prev => ({
      ...prev,
      currentStep: DialogStep.PackageSelection
    }));
  };

  const handleSubmitInvitation = async (formData: InviteFormData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t('portal.inviteCandidate.errorNoPermission'));
        }
        if (response.status === 422) {
          throw new Error(t('portal.inviteCandidate.errorNoWorkflow'));
        }
        throw new Error(data.error || t('portal.inviteCandidate.errorNetworkFailure'));
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        invitationResult: data,
        currentStep: DialogStep.Success
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('portal.inviteCandidate.errorNetworkFailure');
      toastError(message);
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  };

  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    if (onClose) {
      onClose();
    } else {
      dialogRef.current?.close();
    }
  };

  const getDialogTitle = () => {
    if (state.currentStep === DialogStep.Success) {
      return '';
    }
    return t('portal.inviteCandidate.dialogTitle');
  };

  return (
    <ModalDialog
      ref={dialogRef}
      title={getDialogTitle()}
      onClose={handleClose}
      data-testid="invite-candidate-dialog"
    >
      <div className="min-h-[400px]">
        {state.currentStep === DialogStep.PackageSelection && (
          <PackageSelectionStep
            packages={state.packages}
            selectedPackageId={state.formData.packageId}
            onNext={handlePackageNext}
            isLoading={state.isLoading}
          />
        )}

        {state.currentStep === DialogStep.CandidateInfo && (
          <CandidateInfoStep
            formData={state.formData}
            onBack={handleCandidateBack}
            onSubmit={handleSubmitInvitation}
            isSubmitting={state.isLoading}
          />
        )}

        {state.currentStep === DialogStep.Success && state.invitationResult && (
          <InvitationSuccessStep
            invitation={state.invitationResult}
            onClose={handleClose}
          />
        )}
      </div>
    </ModalDialog>
  );
}