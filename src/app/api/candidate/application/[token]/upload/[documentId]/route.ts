// /GlobalRX_v2/src/app/api/candidate/application/[token]/upload/[documentId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { validateFilePath } from '@/lib/services/document-download.service';
import type { CandidateFormData } from '@/types/candidate-portal';

const documentIdSchema = z.string().uuid();

// Minimal shape used when crawling a candidate's saved formData to find a
// document metadata record by documentId. The metadata records share this
// shape across all storage locations (per_entry inside an entry's `fields`,
// per_search/per_order inside the section's `aggregatedFields` bucket).
interface DocumentMetadataRecord {
  documentId: string;
  storagePath: string;
}

/**
 * DELETE /api/candidate/application/[token]/upload/[documentId]
 *
 * Phase 6 Stage 4 — candidate document delete endpoint. Removes a previously
 * uploaded document file from disk after verifying that the document
 * belongs to the candidate's order (BR 12). Returns `{ deleted: true }` on
 * success.
 *
 * Required authentication: Valid candidate_session cookie matching the URL token.
 *
 * Path params:
 *   - token: invitation token (string)
 *   - documentId: UUID returned by the upload endpoint
 *
 * Response (200): `{ deleted: true }`
 *
 * Errors (validation order 401 → 403 → 400 → 404 → 410):
 *   - 401: No session
 *   - 403: Session token doesn't match URL token
 *   - 400: Bad documentId format
 *   - 404: No metadata for the documentId in the candidate's saved formData,
 *          OR the metadata's storagePath is not under the candidate's order's
 *          draft-documents directory. Returning 404 in both cases is
 *          intentional — exposing the existence/absence of arbitrary
 *          documentIds via 403 vs 404 is information leakage.
 *   - 410: Invitation expired or completed
 *
 * No formData mutation occurs here. The candidate's next auto-save omits the
 * metadata (the UI removes it from local state), so this endpoint only
 * deletes the file from disk.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; documentId: string }> },
) {
  try {
    const { token, documentId } = await params;

    // Step 1: Authentication
    const { CandidateSessionService } = await import(
      '@/lib/services/candidateSession.service'
    );
    const sessionData = await CandidateSessionService.getSession();

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Token match
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Validate documentId format
    const idValidation = documentIdSchema.safeParse(documentId);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid documentId' },
        { status: 400 },
      );
    }

    // Step 4: Load invitation (404/410 checks)
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        orderId: true,
        status: true,
        expiresAt: true,
        formData: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json(
        { error: 'Invitation already completed' },
        { status: 410 },
      );
    }

    // Step 5: Find the metadata in the candidate's saved formData. We crawl
    // every section bucket — both per-entry `fields` arrays and aggregated
    // `aggregatedFields` objects — looking for any record whose `documentId`
    // matches. If none match, return 404.
    const formData = (invitation.formData as unknown as CandidateFormData) ?? {
      sections: {},
    };
    const metadata = findMetadataByDocumentId(formData, documentId);

    if (!metadata) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Step 6: Ownership check (BR 12). The metadata's storagePath must live
    // strictly under `uploads/draft-documents/{orderId}/` for THIS candidate's
    // order. We use validateFilePath (path-traversal protection) and an
    // explicit prefix check together — the prefix check binds the file to
    // this orderId, and validateFilePath ensures the file path can't escape
    // the uploads root via `..` segments.
    const expectedPrefix = path.posix.join(
      'uploads',
      'draft-documents',
      invitation.orderId,
    );
    if (
      !validateFilePath(metadata.storagePath) ||
      !metadata.storagePath.startsWith(expectedPrefix + '/')
    ) {
      // Per the route contract, return 404 (not 403) to avoid leaking the
      // existence of foreign documents. Log internally so admins can see if
      // this hits in production.
      logger.warn('Candidate attempted cross-order document delete', {
        event: 'candidate_delete_cross_order_attempt',
        orderId: invitation.orderId,
        documentId,
      });
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Step 7: Remove the file from disk. The file may already be gone (the
    // delete may be a retry). If unlink reports ENOENT, treat as success;
    // any other error is a 500.
    const fullPath = path.join(process.cwd(), metadata.storagePath);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (unlinkError) {
      logger.error('Failed to delete candidate upload from disk', {
        event: 'candidate_delete_unlink_error',
        orderId: invitation.orderId,
        documentId,
        error:
          unlinkError instanceof Error
            ? unlinkError.message
            : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 },
      );
    }

    logger.info('Candidate document deleted', {
      event: 'candidate_delete_success',
      orderId: invitation.orderId,
      documentId,
    });

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    logger.error('Unexpected error in candidate document delete', {
      event: 'candidate_delete_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Walks the candidate's saved formData and returns the document metadata
 * record matching the given documentId, or null if none is found. The crawler
 * checks every storage location used by Stage 4:
 *
 *   - per_entry — inside `formData.sections[<sid>].entries[*].fields[*].value`
 *   - per_search / per_order — inside
 *     `formData.sections[<sid>].aggregatedFields[<key>]`
 *
 * In all cases the value is expected to be an object with at least
 * `{ documentId, storagePath }`. Anything else is ignored.
 */
function findMetadataByDocumentId(
  formData: CandidateFormData,
  documentId: string,
): DocumentMetadataRecord | null {
  const sections = formData.sections ?? {};
  for (const sectionData of Object.values(sections)) {
    if (!sectionData) continue;

    // Per-entry fields
    if (Array.isArray(sectionData.entries)) {
      for (const entry of sectionData.entries) {
        if (!entry?.fields) continue;
        for (const field of entry.fields) {
          const candidate = readMetadata(field?.value);
          if (candidate && candidate.documentId === documentId) {
            return candidate;
          }
        }
      }
    }

    // Aggregated bucket (per_search / per_order)
    const rawAggregated = (
      sectionData as { aggregatedFields?: unknown }
    ).aggregatedFields;
    if (
      rawAggregated &&
      typeof rawAggregated === 'object' &&
      !Array.isArray(rawAggregated)
    ) {
      for (const value of Object.values(
        rawAggregated as Record<string, unknown>,
      )) {
        const candidate = readMetadata(value);
        if (candidate && candidate.documentId === documentId) {
          return candidate;
        }
      }
    }

    // Flat-fields workflow-section / personal-info structures don't carry
    // document metadata in Stage 4 — they hold acknowledgments and primitive
    // field values. We skip them here.
  }
  return null;
}

function readMetadata(value: unknown): DocumentMetadataRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Partial<DocumentMetadataRecord>;
  if (
    typeof candidate.documentId === 'string' &&
    typeof candidate.storagePath === 'string'
  ) {
    return {
      documentId: candidate.documentId,
      storagePath: candidate.storagePath,
    };
  }
  return null;
}
