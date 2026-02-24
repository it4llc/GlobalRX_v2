'use client';
// src/components/modules/customer/scope-dialog.tsx
import clientLogger from '@/lib/client-logger';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { ScopeSelector } from './scope-selector';

interface ScopeDialogProps {
  open: boolean;
  onClose: (savedScope?: any) => void;
  serviceName: string;
  serviceType: string;
  initialScope: any;
}

export function ScopeDialog({
  open,
  onClose,
  serviceName,
  serviceType,
  initialScope
}: ScopeDialogProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [scope, setScope] = useState(initialScope || {});
  
  // Debug logging
  useEffect(() => {
    clientLogger.info("ScopeDialog initialized with:", { 
      serviceName, 
      serviceType, 
      initialScope,
      currentScope: scope
    });
  }, [serviceName, serviceType, initialScope]);
  
  // Use effect to open/close dialog when the open prop changes
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.showModal();
    } else if (!open && dialogRef.current) {
      dialogRef.current.close();
    }
  }, [open]);
  
  // Create stable handler functions that don't close over changing state
  const handleSave = useCallback(() => {
    clientLogger.info("Saving scope:", scope);
    onClose(scope);
  }, [scope, onClose]);
  
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);
  
  return (
    <ModalDialog
      ref={dialogRef}
      title="Edit Service Scope"
      maxWidth="lg"
      open={open}
      onClose={handleCancel}
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={handleSave}
          confirmText="Save Changes"
        />
      }
    >
      <div className="py-4">
        <p className="text-sm text-gray-500 mb-4">
          {serviceName} ({serviceType})
        </p>
        
        <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-700">
          <pre>Current scope: {JSON.stringify(initialScope, null, 2)}</pre>
        </div>
        
        <ScopeSelector
          serviceType={serviceType}
          value={scope}
          onChange={(newScope) => {
            clientLogger.info("Scope updated:", newScope);
            setScope(newScope);
          }}
        />
      </div>
    </ModalDialog>
  );
}