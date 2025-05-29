'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  // Using useRef for dialog reference
  const dialogRef = useRef<DialogRef>(null);
  
  // Keep scope in local state - initialize from props only once
  const [scope, setScope] = useState<any>(initialScope || {});
  const initializedRef = useRef(false);
  
  // Update scope when initialScope changes and dialog opens, but only once
  useEffect(() => {
    if (open && !initializedRef.current) {
      setScope(initialScope || {});
      initializedRef.current = true;
    }
    
    // Reset initialization flag when dialog closes
    if (!open) {
      initializedRef.current = false;
    }
  }, [initialScope, open]);
  
  // Create stable callback functions
  const handleSave = useCallback(() => {
    onClose(scope);
  }, [scope, onClose]);
  
  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);
  
  // Handle scope changes
  const handleScopeChange = useCallback((newScope: any) => {
    setScope(newScope);
  }, []);
  
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
          onChange={(newScope) => setScope(newScope)}
        />
      </div>
    </ModalDialog>
  );
}