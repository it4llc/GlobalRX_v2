// /GlobalRX_v2/src/app/api/candidate/application/[token]/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// File constraints per Phase 6 Stage 4 Business Rule 9.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

// Form-field validation. The `file` field is read directly off the parsed
// FormData (formData.get('file')) and validated by manual size/MIME checks
// because Zod cannot meaningfully validate a Blob in this environment.
const uploadRequestSchema = z.object({
  requirementId: z.string().uuid(),
  entryIndex: z.preprocess(
    (v) => (typeof v === 'string' && v.length > 0 ? Number(v) : undefined),
    z.number().int().min(0).optional(),
  ),
});

/**
 * POST /api/candidate/application/[token]/upload
 *
 * Phase 6 Stage 4 — candidate document upload endpoint. Accepts a single
 * file plus a `requirementId` (UUID) and optional `entryIndex` (used by
 * per_entry-scoped requirements to identify which repeatable entry the
 * upload belongs to). Stores the file under
 * `uploads/draft-documents/{orderId}/{timestamp}-{originalName}` per BR 10
 * and returns metadata. The metadata is NOT persisted to the database here:
 * the candidate's next auto-save writes it to `formData` per BR 11.
 *
 * Required authentication: Valid candidate_session cookie matching the URL token.
 *
 * Path params:
 *   - token: invitation token (string)
 *
 * Body: multipart/form-data with:
 *   - file (binary, required) — max 10 MB; MIME application/pdf,
 *     image/jpeg, or image/png (BR 9).
 *   - requirementId (UUID, required) — the dsx_requirements.id this upload
 *     satisfies.
 *   - entryIndex (number, optional) — non-negative integer; only consumed
 *     by per_entry-scoped requirements.
 *
 * Response (201):
 * {
 *   documentId: string (UUID),
 *   originalName: string,
 *   storagePath: string,   // 'uploads/draft-documents/{orderId}/{timestamp}-{originalName}'
 *   mimeType: 'application/pdf' | 'image/jpeg' | 'image/png',
 *   size: number,           // bytes
 *   uploadedAt: string      // ISO8601 timestamp
 * }
 *
 * Errors (validation order 401 → 403 → 400 → 404 → 410):
 *   - 401: No session
 *   - 403: Session token doesn't match URL token
 *   - 400: Invalid request body, missing file, file too large, or wrong MIME
 *   - 404: Invitation not found
 *   - 410: Invitation expired or completed
 *   - 500: Disk write failure
 *
 * Why no DB row at upload time: per BR 10 and the spec API description,
 * the metadata persistence happens through the standard `/save` endpoint
 * when the candidate's next auto-save fires. Writing a separate DB row here
 * would create two sources of truth for the same metadata.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

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

    // Step 3: Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logger.error('Failed to parse upload FormData', {
        event: 'candidate_upload_formdata_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 },
      );
    }

    const file = formData.get('file') as File | null;
    const requirementIdRaw = formData.get('requirementId');
    const entryIndexRaw = formData.get('entryIndex');

    // Validate non-file fields with Zod
    const validation = uploadRequestSchema.safeParse({
      requirementId:
        typeof requirementIdRaw === 'string' ? requirementIdRaw : undefined,
      entryIndex: typeof entryIndexRaw === 'string' ? entryIndexRaw : undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 },
      );
    }

    if (
      !ALLOWED_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: 'File type not allowed. Accepted types: PDF, JPEG, PNG.',
        },
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
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    // 410 — expired or completed (matches the convention used by the other
    // candidate routes in this folder).
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json(
        { error: 'Invitation already completed' },
        { status: 410 },
      );
    }

    // Step 5: Persist the file
    const fileExtension = path.extname(file.name).toLowerCase();
    const baseName = path.basename(file.name, fileExtension);
    // Sanitize filename — alphanumeric + `_-` + extension. Mirrors the
    // existing `/api/portal/uploads` rule so both upload paths produce
    // similar on-disk filenames. Cap at 100 chars to avoid OS filename limits.
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 100);
    const sanitizedOriginal = `${sanitizedBaseName}${fileExtension}`;
    const timestamp = Date.now();
    const storedFilename = `${timestamp}-${sanitizedOriginal}`;

    // Storage layout per BR 10: uploads/draft-documents/{orderId}/{timestamp}-{originalName}
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'draft-documents',
      invitation.orderId,
    );
    const fullPath = path.join(uploadDir, storedFilename);
    const relativePath = path.posix.join(
      'uploads',
      'draft-documents',
      invitation.orderId,
      storedFilename,
    );

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(fullPath, buffer);
    } catch (writeError) {
      logger.error('Failed to write candidate upload to disk', {
        event: 'candidate_upload_write_error',
        orderId: invitation.orderId,
        error:
          writeError instanceof Error ? writeError.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 },
      );
    }

    const responseBody = {
      documentId: randomUUID(),
      originalName: file.name,
      storagePath: relativePath,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    logger.info('Candidate document uploaded', {
      event: 'candidate_upload_success',
      orderId: invitation.orderId,
      requirementId: validation.data.requirementId,
      size: file.size,
      mimeType: file.type,
    });

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    logger.error('Unexpected error in candidate upload', {
      event: 'candidate_upload_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
