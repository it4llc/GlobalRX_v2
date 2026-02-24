'use client';
// src/components/modules/global-config/tabs/edit-document-modal.tsx
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import { useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable } from '@/components/ui/form-table';
import { FormRow } from '@/components/ui/form-row';
import { useAuth } from '@/contexts/AuthContext';

// Document scope options
const scopeOptions = [
  { id: 'per_case', value: 'per_case', label: 'Per Case' },
  { id: 'per_search_type', value: 'per_search_type', label: 'Per Search Type' },
  { id: 'per_search', value: 'per_search', label: 'Per Search' },
];

// Retention handling options
const retentionOptions = [
  { id: 'no_delete', value: 'no_delete', label: 'Don\'t delete' },
  { id: 'customer_rule', value: 'customer_rule', label: 'Delete at customer rule' },
  { id: 'global_rule', value: 'global_rule', label: 'Delete at global rule' },
];

export interface DocumentVersion {
  timestamp: string;
  modifiedBy: string;
  changes: Record<string, { from: any; to: any }>;
}

export interface DocumentData {
  id: string;
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling: string;
  pdfFile?: File | null;
  hasExistingFile?: boolean;
  versions?: DocumentVersion[];
}

interface EditDocumentModalProps {
  documentId: string;
  onEditDocument: (document: DocumentData) => void;
  onCancel: () => void;
}

export function EditDocumentModal({ documentId, onEditDocument, onCancel }: EditDocumentModalProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [documentName, setDocumentName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [scope, setScope] = useState('');
  const [retentionHandling, setRetentionHandling] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [hasExistingFile, setHasExistingFile] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  
  const { fetchWithAuth } = useAuth();

  // Fetch document data when component mounts
  useEffect(() => {
    const fetchDocumentData = async () => {
      setIsLoading(true);
      try {
        const response = await fetchWithAuth(`/api/data-rx/documents/${documentId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || 'Failed to fetch document data');
        }
        
        const { document } = await response.json();
        
        // Set form values
        setDocumentName(document.documentName);
        setInstructions(document.instructions || '');
        setScope(document.scope);
        setRetentionHandling(document.retentionHandling || '');
        setHasExistingFile(!!document.hasExistingFile);
        
        // Set version history
        if (document.versions && document.versions.length > 0) {
          setVersions(document.versions);
        }
      } catch (error: unknown) {
        clientLogger.error('Error fetching document data:', error);
        // Show error in the UI
      } finally {
        setIsLoading(false);
      }
    };
    
    // Show modal on component mount
    dialogRef.current?.showModal();
    
    // Fetch document data
    fetchDocumentData();
  }, [documentId, fetchWithAuth]);

  // Reset form fields
  const resetForm = () => {
    setDocumentName('');
    setInstructions('');
    setScope('');
    setRetentionHandling('');
    setPdfFile(null);
    setErrors({});
  };

  // Handle cancel button click
  const handleCancel = () => {
    resetForm();
    dialogRef.current?.close();
    onCancel();
  };

  // Handle file change
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

  // Validate the entire form
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

  // Handle form submission
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const documentData: DocumentData = {
      id: documentId,
      documentName,
      instructions,
      scope,
      retentionHandling,
      pdfFile,
      hasExistingFile
    };

    onEditDocument(documentData);
    resetForm();
    dialogRef.current?.close();
  };

  // Format a timestamp to a readable date/time
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <ModalDialog
      ref={dialogRef}
      title="Edit Document"
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Save Changes"
        />
      }
      onClose={handleCancel}
    >
      {isLoading ? (
        <div className="py-4 text-center">Loading document data...</div>
      ) : (
        <>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
            </button>
          </div>
          
          {showVersionHistory && versions.length > 0 && (
            <div className="mb-6 border rounded p-3 bg-gray-50 max-h-40 overflow-y-auto">
              <h3 className="text-sm font-medium mb-2">Version History</h3>
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div key={index} className="text-xs border-b pb-2">
                    <div className="font-medium">
                      {formatTimestamp(version.timestamp)} by {version.modifiedBy}
                    </div>
                    <ul className="mt-1 pl-2">
                      {Object.entries(version.changes).map(([field, change]) => (
                        <li key={field} className="mb-1">
                          <span className="font-medium">{field}:</span> 
                          <span className="line-through text-red-600 mr-1">{JSON.stringify(change.from)}</span>
                          <span className="text-green-600">{JSON.stringify(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          
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
              {hasExistingFile && !pdfFile && (
                <div className="mb-2 text-sm text-gray-600">
                  <span className="font-medium">Current file:</span> PDF document already attached
                </div>
              )}
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
              />
              {pdfFile && (
                <div className="mt-2 text-sm text-gray-500">
                  <span className="font-medium">New file:</span> {pdfFile.name}
                  <p className="text-xs text-amber-600 mt-1">
                    This will replace the current file when you save changes.
                  </p>
                </div>
              )}
            </FormRow>
          </FormTable>
        </>
      )}
    </ModalDialog>
  );
}