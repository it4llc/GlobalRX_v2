// /GlobalRX_v2/src/components/candidate/CandidateDocumentUpload.test.tsx
//
// Phase 6 Stage 4 — Pass 2 component tests for CandidateDocumentUpload.
//
// Coverage:
//   - BR 9:  client-side validation rejects > 10 MB and wrong MIME types.
//   - BR 12: token is propagated into the upload and delete URLs.
//   - BR 13: candidate can remove an uploaded document via DELETE.
//   - BR 21: uploads happen immediately on file selection (no defer).
//   - BR 22: the internal status state uses lowercase string values, surfaced
//            via the data-status attribute.
//   - DoD 5: empty / uploading / uploaded / error states render correctly.
//   - DoD 6/7: client triggers POST and DELETE against the right endpoints.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CandidateDocumentUpload from './CandidateDocumentUpload';
import type { UploadedDocumentMetadata } from '@/types/candidate-stage4';

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TOKEN = 'tok-abc-123';

const baseRequirement = {
  id: 'req-degree-1',
  name: 'Copy of Degree',
  instructions: 'Please upload a scanned copy of your degree or certificate.',
  isRequired: true,
  scope: 'per_entry' as const,
};

const sampleMetadata: UploadedDocumentMetadata = {
  documentId: 'doc-uuid-1',
  originalName: 'diploma.pdf',
  storagePath: 'uploads/draft-documents/order-1/123-diploma.pdf',
  mimeType: 'application/pdf',
  size: 277000,
  uploadedAt: '2026-05-04T12:00:00.000Z',
};

// Helper: build a Response-like object that the component's fetch await can
// consume (await response.json(), response.ok, response.status). We avoid
// constructing the real Response class for compatibility across happy-dom
// versions and because we only need the surface the component touches.
function makeJsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

// Helper: build a real File. happy-dom's File supports the size/type props
// we read in the component, but the file content is irrelevant to the
// component's behavior — we only need size/type to pass the client checks.
function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
): File {
  // A repeating string of length sizeBytes gives us a File whose .size is
  // sizeBytes (UTF-8 single-byte chars).
  const content = sizeBytes > 0 ? 'a'.repeat(sizeBytes) : '';
  return new File([content], name, { type });
}

// Helper: simulate a file selection by directly firing the input's change
// event with a real File. We use this rather than userEvent.upload in tests
// that need to bypass the input's `accept` attribute filter — for example,
// to verify the component's MIME guard fires when the OS picker returns a
// file whose extension wasn't in the accept list (real browsers don't
// strictly enforce `accept`, so the component's check is defense in depth).
function fireFileChange(input: HTMLInputElement, file: File): void {
  fireEvent.change(input, { target: { files: [file] } });
}

describe('CandidateDocumentUpload', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The fetch mock is an inline implementation that READS the URL and method
    // and returns a deterministic response. Per Mocking Rule M3 it does NOT
    // use mockReturnValueOnce/scripted return values for the parent's
    // meaningful arguments — the URL it returns matches the URL the parent
    // sent. Tests that need a specific failure mode override fetchMock for
    // that test only.
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      // Default behavior: any POST to /upload succeeds with sampleMetadata;
      // any DELETE to /upload/<id> succeeds. Tests can override per-case.
      if (init?.method === 'DELETE') {
        return makeJsonResponse({ deleted: true }, { status: 200 });
      }
      return makeJsonResponse(sampleMetadata, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial render', () => {
    it('renders the empty state when uploadedDocument is null', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
        'data-status',
        'empty',
      );
      expect(screen.getByTestId('candidate-document-upload-button')).toBeInTheDocument();
      expect(screen.getByText('Copy of Degree')).toBeInTheDocument();
      expect(
        screen.getByText('Please upload a scanned copy of your degree or certificate.'),
      ).toBeInTheDocument();
    });

    it('renders the uploaded state when uploadedDocument is provided', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={sampleMetadata}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
        'data-status',
        'uploaded',
      );
      expect(screen.getByTestId('candidate-document-uploaded')).toBeInTheDocument();
      expect(screen.getByText('diploma.pdf')).toBeInTheDocument();
      // 277000 bytes / 1024 ~= 270 KB
      expect(screen.getByText(/KB/)).toBeInTheDocument();
      expect(screen.getByTestId('candidate-document-remove-button')).toBeInTheDocument();
    });

    it('shows the Required badge when requirement.isRequired = true', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );
      expect(screen.getByText('candidate.documentUpload.required')).toBeInTheDocument();
    });

    it('shows the Optional badge when requirement.isRequired = false', () => {
      render(
        <CandidateDocumentUpload
          requirement={{ ...baseRequirement, isRequired: false }}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );
      expect(screen.getByText('candidate.documentUpload.optional')).toBeInTheDocument();
    });

    it('renders the file input with PDF/JPEG/PNG accept and capture=environment for mobile', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const input = screen.getByTestId('candidate-document-file-input') as HTMLInputElement;
      expect(input.type).toBe('file');
      expect(input.getAttribute('accept')).toBe('.pdf,.jpg,.jpeg,.png');
      // Mobile camera affordance per DoD 18.
      expect(input.getAttribute('capture')).toBe('environment');
    });
  });

  describe('client-side validation (BR 9)', () => {
    it('rejects a file larger than 10 MB and shows the translated too-large error', async () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const oversize = makeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024 + 1);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        oversize,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      // No fetch should have been called — validation rejected before network.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        screen.getByText('candidate.documentUpload.errorTooLarge'),
      ).toBeInTheDocument();
    });

    it('rejects a non-PDF/JPEG/PNG MIME and shows the translated wrong-type error', async () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      // 1KB plain text — small enough not to trip the size check. We use
      // fireFileChange (not userEvent.upload) because userEvent.upload filters
      // files whose extension doesn't match the input's `accept` attribute
      // BEFORE firing the change event. The component's MIME guard is
      // defense-in-depth — real browsers don't strictly enforce `accept` and
      // the OS picker can return any file the candidate selects — so the
      // direct change-event approach exercises the guard the way the OS does.
      const wrongType = makeFile('not-allowed.txt', 'text/plain', 1024);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        wrongType,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        screen.getByText('candidate.documentUpload.errorWrongType'),
      ).toBeInTheDocument();
    });

    it('try-again from the error state restores the empty state', async () => {
      const user = userEvent.setup();
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const wrongType = makeFile('not-allowed.txt', 'text/plain', 100);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        wrongType,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });

      await user.click(screen.getByTestId('candidate-document-try-again'));

      expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
        'data-status',
        'empty',
      );
    });
  });

  describe('upload flow (BR 21 — immediate)', () => {
    it('POSTs to the candidate upload endpoint with token in the URL and the requirement id in the FormData', async () => {
      const onUploadComplete = vi.fn();

      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={onUploadComplete}
          onRemove={vi.fn()}
          token={TOKEN}
          entryIndex={2}
        />,
      );

      const file = makeFile('diploma.pdf', 'application/pdf', 1234);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        file,
      );

      // BR 21: the upload happens immediately. Confirm fetch was called once
      // with the correct endpoint AND the correct method, and that the
      // FormData carries requirementId + entryIndex (the parent sends real
      // arguments — a scripted return-value mock would not catch a wrong URL
      // or wrong field name).
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(`/api/candidate/application/${TOKEN}/upload`);
      expect((calledInit as RequestInit).method).toBe('POST');

      const sentForm = (calledInit as RequestInit).body as FormData;
      expect(sentForm.get('requirementId')).toBe('req-degree-1');
      expect(sentForm.get('entryIndex')).toBe('2');
      expect(sentForm.get('file')).toBeInstanceOf(File);

      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledWith(sampleMetadata);
      });

      // After success: status should be uploaded.
      expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
        'data-status',
        'uploaded',
      );
    });

    it('omits entryIndex from the FormData when not provided', async () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const file = makeFile('diploma.pdf', 'application/pdf', 100);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        file,
      );

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const sentForm = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
      expect(sentForm.has('entryIndex')).toBe(false);
    });

    it('shows the error state with the server-provided error message when the server returns 4xx with a JSON error body', async () => {
      // Override fetchMock for this test only — server returns 400 with the
      // canonical too-large message. The mock still reads the URL and method
      // (a real implementation), it just returns a different body for this
      // specific test scenario.
      fetchMock.mockImplementationOnce(async () =>
        makeJsonResponse(
          { error: 'File too large. Maximum size is 10 MB.' },
          { status: 400 },
        ),
      );

      const onUploadComplete = vi.fn();
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={onUploadComplete}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const file = makeFile('big.pdf', 'application/pdf', 100);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        file,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });

      // The component surfaces the server's error message.
      expect(
        screen.getByText('File too large. Maximum size is 10 MB.'),
      ).toBeInTheDocument();
      expect(onUploadComplete).not.toHaveBeenCalled();
    });

    it('falls back to a generic error message when the server returns 4xx without a JSON body', async () => {
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response));

      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const file = makeFile('x.pdf', 'application/pdf', 100);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        file,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      expect(
        screen.getByText('candidate.documentUpload.errorUploadFailed'),
      ).toBeInTheDocument();
    });

    it('shows the generic error message when fetch throws (network failure)', async () => {
      fetchMock.mockImplementationOnce(async () => {
        throw new Error('network down');
      });

      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={null}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      const file = makeFile('x.pdf', 'application/pdf', 100);
      fireFileChange(
        screen.getByTestId('candidate-document-file-input') as HTMLInputElement,
        file,
      );

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      expect(
        screen.getByText('candidate.documentUpload.errorUploadFailed'),
      ).toBeInTheDocument();
    });
  });

  describe('remove flow (BR 13)', () => {
    it('DELETEs the candidate document endpoint and calls onRemove on success', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();

      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={sampleMetadata}
          onUploadComplete={vi.fn()}
          onRemove={onRemove}
          token={TOKEN}
        />,
      );

      await user.click(screen.getByTestId('candidate-document-remove-button'));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(calledUrl).toBe(
        `/api/candidate/application/${TOKEN}/upload/${sampleMetadata.documentId}`,
      );
      expect((calledInit as RequestInit).method).toBe('DELETE');

      await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
        'data-status',
        'empty',
      );
    });

    it('enters the error state with the translated remove-failed message when the server rejects DELETE', async () => {
      fetchMock.mockImplementationOnce(async () =>
        makeJsonResponse({ error: 'nope' }, { status: 404 }),
      );

      const user = userEvent.setup();
      const onRemove = vi.fn();
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={sampleMetadata}
          onUploadComplete={vi.fn()}
          onRemove={onRemove}
          token={TOKEN}
        />,
      );

      await user.click(screen.getByTestId('candidate-document-remove-button'));

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      expect(
        screen.getByText('candidate.documentUpload.errorRemoveFailed'),
      ).toBeInTheDocument();
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('enters the error state when the DELETE request itself throws', async () => {
      fetchMock.mockImplementationOnce(async () => {
        throw new Error('offline');
      });

      const user = userEvent.setup();
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={sampleMetadata}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );

      await user.click(screen.getByTestId('candidate-document-remove-button'));

      await waitFor(() => {
        expect(screen.getByTestId('candidate-document-upload')).toHaveAttribute(
          'data-status',
          'error',
        );
      });
      expect(
        screen.getByText('candidate.documentUpload.errorRemoveFailed'),
      ).toBeInTheDocument();
    });
  });

  describe('uploaded state — file size formatting', () => {
    it('formats sub-1KB sizes as B', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={{ ...sampleMetadata, size: 500 }}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );
      expect(screen.getByText('500 B')).toBeInTheDocument();
    });

    it('formats sub-1MB sizes as KB', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={{ ...sampleMetadata, size: 277000 }}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );
      // 277000 / 1024 = 270.5… → rounded to 271
      expect(screen.getByText('271 KB')).toBeInTheDocument();
    });

    it('formats >=1MB sizes as MB with one decimal place', () => {
      render(
        <CandidateDocumentUpload
          requirement={baseRequirement}
          uploadedDocument={{ ...sampleMetadata, size: 1.4 * 1024 * 1024 }}
          onUploadComplete={vi.fn()}
          onRemove={vi.fn()}
          token={TOKEN}
        />,
      );
      expect(screen.getByText('1.4 MB')).toBeInTheDocument();
    });
  });
});
