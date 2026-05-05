// /GlobalRX_v2/src/components/candidate/CandidateDocumentUpload.tsx
//
// Phase 6 Stage 4 — reusable candidate document upload component. Replaces
// the Stage 3 informational document line items in `AggregatedRequirements`
// and is also used inline by service sections that have per_entry document
// requirements.
//
// State machine (lowercase per BR 22): empty | uploading | uploaded | error
//
// Behavior:
//   - On file selection: client-side validation (max 10 MB, MIME PDF/JPEG/PNG
//     per BR 9). On failure, set error state with a user-visible message
//     (TD-009 — no silent errors).
//   - On valid selection: call POST /api/candidate/application/[token]/upload
//     immediately (BR 21 — uploads happen at file selection, not at submit).
//   - On upload success: call onUploadComplete(metadata). The parent is
//     responsible for routing the metadata into the correct slot in form
//     state per BR 11 (per_entry / per_search / per_order).
//   - On Remove: call DELETE /api/candidate/application/[token]/upload/[documentId]
//     and on success call onRemove().
//   - The mobile capture affordance (BR — DoD #18) is the standard
//     `<input type="file" capture="environment">` attribute. Browsers that
//     support it offer the camera; older browsers fall back to a regular
//     file picker. No custom camera code is included.

'use client';

import React, { useRef, useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { UploadedDocumentMetadata } from '@/types/candidate-stage4';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface UploadRequirement {
  id: string;
  name: string;
  instructions?: string | null;
  isRequired: boolean;
  scope?: string | null;
}

interface CandidateDocumentUploadProps {
  requirement: UploadRequirement;
  uploadedDocument: UploadedDocumentMetadata | null;
  onUploadComplete: (metadata: UploadedDocumentMetadata) => void;
  onRemove: () => void;
  token: string;
  /** Optional — passed through to the server for per_entry-scoped uploads. */
  entryIndex?: number;
}

type UploadStatus = 'empty' | 'uploading' | 'uploaded' | 'error';

export default function CandidateDocumentUpload({
  requirement,
  uploadedDocument,
  onUploadComplete,
  onRemove,
  token,
  entryIndex,
}: CandidateDocumentUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<UploadStatus>(
    uploadedDocument ? 'uploaded' : 'empty',
  );
  const [error, setError] = useState<string | null>(null);

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file twice still triggers
    // onChange (browsers skip the event when the value hasn't changed).
    e.target.value = '';
    if (!file) {
      return;
    }

    // Client-side validation BEFORE we attempt the network call. The server
    // re-validates as defense in depth.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus('error');
      setError(t('candidate.documentUpload.errorTooLarge'));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setStatus('error');
      setError(t('candidate.documentUpload.errorWrongType'));
      return;
    }

    setStatus('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requirementId', requirement.id);
      if (entryIndex !== undefined) {
        formData.append('entryIndex', String(entryIndex));
      }

      // Per COMPONENT_STANDARDS Section 4.2: never set Content-Type manually
      // when sending FormData — the browser sets the multipart boundary.
      const response = await fetch(
        `/api/candidate/application/${encodeURIComponent(token)}/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        let message = t('candidate.documentUpload.errorUploadFailed');
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') {
            message = body.error;
          }
        } catch {
          // Body wasn't JSON or response was empty — fall back to the generic
          // translated message.
        }
        setStatus('error');
        setError(message);
        return;
      }

      const metadata = (await response.json()) as UploadedDocumentMetadata;
      setStatus('uploaded');
      onUploadComplete(metadata);
    } catch {
      // Network errors (offline, CORS, etc.) reach this branch. We surface
      // a generic message rather than the underlying error to avoid leaking
      // internal details, but log nothing client-side per project rules.
      setStatus('error');
      setError(t('candidate.documentUpload.errorUploadFailed'));
    }
  };

  const handleRemove = async () => {
    if (!uploadedDocument) {
      return;
    }
    try {
      const response = await fetch(
        `/api/candidate/application/${encodeURIComponent(token)}/upload/${encodeURIComponent(uploadedDocument.documentId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setStatus('error');
        setError(t('candidate.documentUpload.errorRemoveFailed'));
        return;
      }
      setStatus('empty');
      setError(null);
      onRemove();
    } catch {
      setStatus('error');
      setError(t('candidate.documentUpload.errorRemoveFailed'));
    }
  };

  const tryAgain = () => {
    setStatus(uploadedDocument ? 'uploaded' : 'empty');
    setError(null);
  };

  return (
    <div
      className="border border-gray-200 rounded-md p-4 bg-white"
      data-testid="candidate-document-upload"
      data-status={status}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{requirement.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                requirement.isRequired
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {requirement.isRequired
                ? t('candidate.documentUpload.required')
                : t('candidate.documentUpload.optional')}
            </span>
          </div>
          {requirement.instructions && (
            <p className="mt-1 text-sm text-gray-600">
              {requirement.instructions}
            </p>
          )}
        </div>
      </div>

      {/* Hidden file input — the visible "Upload" button triggers it. The
          `capture="environment"` attribute prompts mobile browsers to offer
          the camera (DoD #18). `accept` narrows the system file picker to
          PDF/JPEG/PNG, matching the server-side allow-list. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="candidate-document-file-input"
      />

      {status === 'empty' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={triggerFilePicker}
            className="inline-flex items-center px-3 py-2 min-h-[44px] rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
            data-testid="candidate-document-upload-button"
          >
            {t('candidate.documentUpload.upload')}
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <div
          className="mt-3 flex items-center gap-2 text-gray-700"
          data-testid="candidate-document-uploading"
        >
          <span
            className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{t('candidate.documentUpload.uploading')}</span>
        </div>
      )}

      {status === 'uploaded' && uploadedDocument && (
        <div
          className="mt-3 flex items-center justify-between"
          data-testid="candidate-document-uploaded"
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-sm text-gray-900 truncate"
              title={uploadedDocument.originalName}
            >
              {uploadedDocument.originalName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(uploadedDocument.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="ml-3 px-3 py-2 min-h-[44px] rounded-md text-sm text-red-700 hover:bg-red-50"
            data-testid="candidate-document-remove-button"
          >
            {t('candidate.documentUpload.remove')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div
          className="mt-3 text-sm text-red-700"
          role="alert"
          data-testid="candidate-document-error"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={tryAgain}
            className="mt-1 underline"
            data-testid="candidate-document-try-again"
          >
            {t('candidate.documentUpload.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Format a byte count as a human-readable string (e.g., "271 KB", "1.4 MB").
 * Uses KB / MB rather than KiB / MiB because that's what most consumer
 * software displays, and the candidate audience expects.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
