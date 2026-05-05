// /GlobalRX_v2/src/app/api/candidate/application/[token]/upload/__tests__/route.test.ts
//
// Phase 6 Stage 4 — Pass 2 API route tests for the candidate document upload
// endpoint POST /api/candidate/application/[token]/upload.
//
// Coverage:
//   - BR 9:  server rejects > 10 MB and non-PDF/JPEG/PNG MIME types.
//   - BR 10: file is written under uploads/draft-documents/{orderId}/...
//   - BR 12: token validation; cross-token uploads forbidden.
//   - DoD 6: token + size + MIME validation present; storage path correct.
//
// Mocks (per the Pass 2 mock reference table):
//   - @/lib/services/candidateSession.service (CandidateSessionService.getSession)
//   - @/lib/prisma  (global mock from src/test/setup.ts; per-test
//                    vi.mocked(...).mockResolvedValueOnce for the invitation row)
//   - fs / path / crypto (inline factories mirroring the portal/uploads test)
//
// We do NOT mock the route handler itself (Mocking Rule M1).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// CandidateSessionService is mocked the same way the saved-data and structure
// route tests do — module-level service whose getSession resolves to either
// null or a session object. Per Rule M3 this is module-level state, not a
// function the route calls with meaningful parent-supplied arguments.
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

// fs is mocked with the standard portal/uploads test pattern: each function
// is a vi.fn() exposed on both default and as a named export so default- and
// named-import callers both hit the mock. Tests configure per-call behavior
// with vi.mocked(fs.existsSync).mockReturnValue(...) etc.
vi.mock('fs', () => {
  const existsSyncFn = vi.fn();
  const mkdirSyncFn = vi.fn();
  const writeFileSyncFn = vi.fn();
  return {
    default: {
      existsSync: existsSyncFn,
      mkdirSync: mkdirSyncFn,
      writeFileSync: writeFileSyncFn,
    },
    existsSync: existsSyncFn,
    mkdirSync: mkdirSyncFn,
    writeFileSync: writeFileSyncFn,
  };
});

// path is mocked with inline implementations that READ the input. Per
// Mocking Rule M3 these are NOT scripted return values — extname/basename
// inspect the real argument and return a real-shaped result.
vi.mock('path', () => {
  const extname = vi.fn((filename: string) => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot);
  });
  const basename = vi.fn((filename: string, ext?: string) => {
    if (ext && filename.endsWith(ext)) {
      return filename.substring(0, filename.length - ext.length);
    }
    const lastSlash = filename.lastIndexOf('/');
    return lastSlash === -1 ? filename : filename.substring(lastSlash + 1);
  });
  const join = vi.fn((...args: string[]) => args.filter(Boolean).join('/'));
  return {
    default: {
      extname,
      basename,
      join,
      posix: { join },
    },
    extname,
    basename,
    join,
    posix: { join },
  };
});

// crypto.randomUUID returns a fixed value so we can assert documentId in
// responses. The route calls randomUUID() with no arguments — a constant
// is appropriate (no parent-supplied arguments to read).
vi.mock('crypto', () => {
  const randomUUIDFn = vi.fn(() => 'doc-uuid-test-1234');
  return {
    default: { randomUUID: randomUUIDFn },
    randomUUID: randomUUIDFn,
  };
});

const TOKEN = 'tok-stage4-abc';
const ORDER_ID = 'order-9999';
const REQ_ID = '11111111-1111-4111-8111-111111111111';

// Future-dated expiry so the route's 410 path is not triggered unless
// explicitly overridden by a test.
const FUTURE_EXPIRY = new Date(Date.now() + 24 * 60 * 60 * 1000);

const validInvitation = {
  id: 'inv-1',
  orderId: ORDER_ID,
  status: INVITATION_STATUSES.ACCESSED,
  expiresAt: FUTURE_EXPIRY,
};

// Helper: build a NextRequest carrying a multipart FormData with a file plus
// optional requirementId / entryIndex. The body is a real FormData; the route
// awaits request.formData() to read it.
function makeRequest(opts: {
  file?: File | null;
  requirementId?: string;
  entryIndex?: string;
}): NextRequest {
  const fd = new FormData();
  if (opts.file !== null && opts.file !== undefined) {
    fd.append('file', opts.file);
  }
  if (opts.requirementId !== undefined) {
    fd.append('requirementId', opts.requirementId);
  }
  if (opts.entryIndex !== undefined) {
    fd.append('entryIndex', opts.entryIndex);
  }
  return new NextRequest(
    `http://localhost/api/candidate/application/${TOKEN}/upload`,
    {
      method: 'POST',
      body: fd,
    },
  );
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = sizeBytes > 0 ? 'a'.repeat(sizeBytes) : '';
  return new File([content], name, { type });
}

describe('POST /api/candidate/application/[token]/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore the inline path mock implementations after vi.clearAllMocks
    // resets call records (mockClear). Implementations on vi.mock factories
    // persist; the per-test configuration of the file system matters here.
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as unknown as string);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
  });

  describe('authentication (BR 12)', () => {
    it('returns 401 when there is no session', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 403 when the session token does not match the URL token', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'a-different-token',
        invitationId: 'inv-1',
      });

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Forbidden' });
    });
  });

  describe('input validation (BR 9)', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('returns 400 when requirementId is missing', async () => {
      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file /* no requirementId */ });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid input');
    });

    it('returns 400 when requirementId is not a UUID', async () => {
      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: 'not-a-uuid' });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 400 when no file is provided', async () => {
      const request = makeRequest({ file: null, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'No file provided' });
    });

    it('returns 400 when the file is larger than 10 MB', async () => {
      const file = makeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024 + 1);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'File too large. Maximum size is 10 MB.',
      });
      // Disk should not have been touched.
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('returns 400 when the MIME type is not PDF/JPEG/PNG', async () => {
      const file = makeFile('a.txt', 'text/plain', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'File type not allowed. Accepted types: PDF, JPEG, PNG.',
      });
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('accepts application/pdf', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        validInvitation as never,
      );
      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });
      expect(response.status).toBe(201);
    });

    it('accepts image/jpeg', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        validInvitation as never,
      );
      const file = makeFile('a.jpg', 'image/jpeg', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });
      expect(response.status).toBe(201);
    });

    it('accepts image/png', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        validInvitation as never,
      );
      const file = makeFile('a.png', 'image/png', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });
      expect(response.status).toBe(201);
    });
  });

  describe('invitation lookup', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('returns 404 when the invitation is not found', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        null,
      );

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Invitation not found' });
    });

    it('returns 410 when the invitation is expired', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...validInvitation,
        expiresAt: new Date(Date.now() - 1000),
      } as never);

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ error: 'Invitation expired' });
    });

    it('returns 410 when the invitation is already completed', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...validInvitation,
        status: INVITATION_STATUSES.COMPLETED,
      } as never);

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'Invitation already completed',
      });
    });
  });

  describe('successful upload (BR 10)', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(
        validInvitation as never,
      );
    });

    it('creates the order-scoped upload directory if it does not exist and writes the file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const file = makeFile('diploma.pdf', 'application/pdf', 1024);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(201);
      expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
      // The directory the route creates must include the orderId per BR 10.
      const mkdirArgs = vi.mocked(fs.mkdirSync).mock.calls[0];
      expect(String(mkdirArgs[0])).toContain(ORDER_ID);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('does not call mkdirSync when the directory already exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(201);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('returns the documentId, originalName, storagePath, mimeType, size, uploadedAt', async () => {
      const file = makeFile('diploma.pdf', 'application/pdf', 1234);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.documentId).toBe('doc-uuid-test-1234');
      expect(body.originalName).toBe('diploma.pdf');
      expect(body.mimeType).toBe('application/pdf');
      expect(body.size).toBe(1234);
      // ISO 8601 timestamp.
      expect(body.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Storage path lives under uploads/draft-documents/{orderId} per BR 10.
      expect(body.storagePath).toContain('uploads/draft-documents');
      expect(body.storagePath).toContain(ORDER_ID);
      // Storage filename includes a timestamp prefix (Date.now() converted to
      // string is digits only) and the original filename's extension.
      expect(body.storagePath).toMatch(/\d+-/);
      expect(body.storagePath).toContain('.pdf');
    });

    it('sanitizes the original filename (strips characters outside [a-zA-Z0-9-_]) when constructing the storage filename', async () => {
      const file = makeFile('My Cool Diploma!.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();

      // The unsafe characters in the original name (spaces, "!") must not
      // appear in the storage path; they are replaced with underscores. The
      // originalName field, by contrast, preserves the user's filename.
      expect(body.originalName).toBe('My Cool Diploma!.pdf');
      expect(body.storagePath).not.toContain(' ');
      expect(body.storagePath).not.toContain('!');
      expect(body.storagePath).toMatch(/My_Cool_Diploma_\.pdf$/);
    });

    it('accepts entryIndex as a stringified non-negative integer', async () => {
      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({
        file,
        requirementId: REQ_ID,
        entryIndex: '3',
      });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(201);
    });

    it('returns 400 when entryIndex is negative', async () => {
      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({
        file,
        requirementId: REQ_ID,
        entryIndex: '-1',
      });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('disk write failures', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(
        validInvitation as never,
      );
    });

    it('returns 500 when fs.writeFileSync throws', async () => {
      vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      const file = makeFile('a.pdf', 'application/pdf', 100);
      const request = makeRequest({ file, requirementId: REQ_ID });
      const response = await POST(request, {
        params: Promise.resolve({ token: TOKEN }),
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to upload file' });
    });
  });
});
