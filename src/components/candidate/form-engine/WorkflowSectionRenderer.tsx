// /GlobalRX_v2/src/components/candidate/form-engine/WorkflowSectionRenderer.tsx
//
// Phase 6 Stage 4 — renders a single workflow section for the candidate.
//
// Two `type` values are supported (BR 3, BR 4):
//   - `text`     → sanitized HTML in a scrollable container.
//   - `document` → tap-to-open/download link labelled with `fileName`,
//                  falling back to the section `name`. No embedded PDF viewer.
//   - Edge case: `type === 'document'` with no `fileUrl` → render a
//     "Document not available" placeholder (BR Edge Cases). The
//     acknowledgment checkbox still works.
//
// An acknowledgment checkbox is always rendered below the content. Its label
// is the hardcoded translated string `t('candidate.workflowSection.acknowledgmentLabel')`
// per BR 5. The checkbox's onChange invokes `onAcknowledge(checked)` and the
// parent (the shell) is responsible for triggering the auto-save.

'use client';

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { sanitizeWorkflowContent } from '@/lib/candidate/sanitizeWorkflowContent';
import type { WorkflowSectionPayload } from '@/types/candidate-stage4';

interface WorkflowSectionRendererProps {
  section: WorkflowSectionPayload;
  acknowledged: boolean;
  onAcknowledge: (checked: boolean) => void;
}

// Defense-in-depth allow-list for the document `href`. The fileUrl is
// admin-configured at workflow-build time, but a `javascript:` (or `data:`,
// `vbscript:`, etc.) URL would turn the link into a click-to-XSS vector.
// We accept only absolute `http://`/`https://` URLs and root-relative paths
// (`/...`). Anything else falls back to the "Document not available"
// placeholder.
function isAllowedDocumentUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  return /^https?:\/\//i.test(trimmed);
}

export default function WorkflowSectionRenderer({
  section,
  acknowledged,
  onAcknowledge,
}: WorkflowSectionRendererProps) {
  const { t } = useTranslation();

  const checkboxId = `workflow-ack-${section.id}`;
  const downloadLabel = section.fileName?.trim() || section.name;
  const safeFileUrl = isAllowedDocumentUrl(section.fileUrl) ? section.fileUrl : null;

  return (
    <div className="space-y-4" data-testid="workflow-section-renderer">
      <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>

      {section.type === 'text' && (
        <div
          className="prose max-w-none overflow-y-auto max-h-[60vh] border border-gray-200 rounded-md p-4 bg-white"
          data-testid="workflow-section-content"
          // The HTML is sanitized via DOMPurify (allow-list of basic
          // formatting tags; strips script/style/iframe/object/embed and any
          // `on*` event handler). Defense in depth — the spec recommends
          // sanitizing on read at minimum (DoD #19).
          dangerouslySetInnerHTML={{
            __html: sanitizeWorkflowContent(section.content ?? ''),
          }}
        />
      )}

      {section.type === 'document' && safeFileUrl && (
        <div className="border border-gray-200 rounded-md p-4 bg-white">
          <a
            href={safeFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
            data-testid="workflow-section-download"
            // download attribute makes browsers offer a save dialog when
            // possible; combined with target=_blank the candidate can either
            // open the file inline or save it depending on browser behavior.
            download={downloadLabel}
          >
            {t('candidate.workflowSection.openDocument')}: {downloadLabel}
          </a>
        </div>
      )}

      {section.type === 'document' && !safeFileUrl && (
        <div
          className="border border-gray-200 rounded-md p-4 bg-white text-gray-600"
          data-testid="workflow-section-document-unavailable"
        >
          {t('candidate.workflowSection.documentUnavailable')}
        </div>
      )}

      <div className="flex items-start space-x-2 min-h-[44px]">
        <input
          type="checkbox"
          id={checkboxId}
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="mt-1 h-5 w-5"
          data-testid="workflow-section-ack"
        />
        <label htmlFor={checkboxId} className="text-base text-gray-900">
          {t('candidate.workflowSection.acknowledgmentLabel')}
        </label>
      </div>
    </div>
  );
}
