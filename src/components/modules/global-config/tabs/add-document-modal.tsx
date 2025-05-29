// src/components/modules/global-config/tabs/add-document-modal.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable } from '@/components/ui/form-table';
import { FormRow } from '@/components/ui/form-row';
import { FormActions } from '@/components/ui/form-actions';

// Document scope options
const scopeOptions = [
  { id: 'per_case', value: 'per_case', label: 'Per Case' },
  { id: 'per_search_type', value: 'per_search_type', label: 'Per Search Type' },
  { id: 'per_search', value: 'per_search', label: 'Per Search' },
];

// Retention handling options (same as in add-field-modal)
const retentionOptions = [
  { id: 'no_delete', value: 'no_delete', label: 'Don\'t delete' },
  { id: 'customer_rule', value: 'customer_rule', label: 'Delete at customer rule' },
  { id: 'global_rule', value: 'global_rule', label: 'Delete at global rule' },
];

export interface DocumentData {
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling: string;
  pdfFile?: File | null;
}

interface AddDocumentModalProps {
  onAddDocument: (document: DocumentData) => void;
  onCancel: () => void;
}

export function AddDocumentModal({ onAddDocument, onCancel }: AddDocumentModalProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [documentName, setDocumentName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scope, setScope] = useState('');
  const [retentionHandling, setRetentionHandling] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show modal on component mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const resetForm = () => {
    setDocumentName('');
    setInstructions('');
    setScope('');
    setRetentionHandling('');
    setPdfFile(null);
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    dialogRef.current?.close();
    onCancel();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!documentName.trim()) {
      newErrors.documentName = 'Document name is required';
    }

    if (!scope) {
      newErrors.scope = 'Scope is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        setErrors((prev) => ({ ...prev, pdfFile: '' }));
      } else {
        setErrors((prev) => ({ 
          ...prev, 
          pdfFile: 'Only PDF files are allowed' 
        }));
        setPdfFile(null);
      }
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    onAddDocument({
      documentName,
      instructions,
      scope,
      retentionHandling,
      pdfFile
    });

    resetForm();
    dialogRef.current?.close();
  };

  return (
    <ModalDialog
      ref={dialogRef}
      title="Add New Document"
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Add Document"
        />
      }
      onClose={handleCancel}
      maxWidth="md" // Ensure the modal is wide enough
    >
      <div className="py-2 max-h-[60vh] overflow-y-auto pr-2">
        <FormTable>
          <FormRow
            label="Document Name"
            htmlFor="document-name"
            required={true}
            error={errors.documentName}
          >
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="E.g., ID Document, Proof of Address"
            />
          </FormRow>

          <FormRow
            label="Instructions"
            htmlFor="instructions"
            required={false}
            alignTop={true}
          >
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions for uploading this document"
              rows={3}
            />
          </FormRow>

          <FormRow
            label="Scope"
            htmlFor="scope"
            required={true}
            error={errors.scope}
          >
            <StandardDropdown
              id="scope"
              options={scopeOptions}
              value={scope}
              onChange={setScope}
              placeholder="Select document scope"
            />
          </FormRow>

          <FormRow
            label="Retention Handling"
            htmlFor="retention-handling"
            required={false}
          >
            <StandardDropdown
              id="retention-handling"
              options={retentionOptions}
              value={retentionHandling}
              onChange={setRetentionHandling}
              placeholder="Select retention policy"
            />
          </FormRow>

          <FormRow
            label="PDF Template"
            htmlFor="pdf-file"
            required={false}
            error={errors.pdfFile}
            alignTop={true}
          >
            <Input
              id="pdf-file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
            {pdfFile && (
              <div className="mt-2 text-sm text-gray-500">
                Selected file: {pdfFile.name}
              </div>
            )}
          </FormRow>
        </FormTable>
      </div>
    </ModalDialog>
  );
}