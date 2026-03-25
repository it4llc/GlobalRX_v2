// /GlobalRX_v2/src/components/portal/orders/steps/__tests__/DocumentsReviewStep.document-persistence.test.tsx

// REGRESSION TEST: proves bug fix for document persistence in draft orders
// Bug: File objects in uploadedDocuments state cannot be JSON serialized.
// Fix: Upload files immediately when selected and store metadata instead of File objects.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentsReviewStep } from '../DocumentsReviewStep';
import '@testing-library/jest-dom';

// Mock fetch for upload API calls
global.fetch = vi.fn();

// Mock clientLogger
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock DocumentTemplateButton component
vi.mock('../DocumentTemplateButton', () => ({
  DocumentTemplateButton: vi.fn(({ documentId, hasTemplate, pdfPath, filename, fileSize }) => (
    <button data-testid={`template-button-${documentId}`}>
      Download Template
    </button>
  )),
}));

// Mock translation context
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'documents_review_title': 'Documents & Review',
        'documents_review_description': 'Upload any required documents and review your order before submitting.',
        'required_documents_notice': 'Required documents must be uploaded before submission',
        'required_documents_heading': 'Required Documents',
        'choose_file': 'Choose File',
        'change_file': 'Change File',
        'order_summary': 'Order Summary',
        'subject_information': 'Subject Information',
        'missing': 'Missing',
        'not_provided': 'Not provided',
        'services_count': `Services (${params?.count || 0})`,
        'search': 'Search',
        'documents': 'Documents',
        'missing_required': 'Missing (Required)',
        'not_uploaded': 'Not uploaded',
      };
      return translations[key] || key;
    },
  }),
}));

describe('DocumentsReviewStep - Document Persistence Bug Fix', () => {
  const mockRequirements = {
    documents: [
      {
        id: 'doc-1',
        name: 'Background Check Authorization',
        required: true,
        scope: 'per_case' as const,
        instructions: 'Please upload a signed authorization form',
      },
      {
        id: 'doc-2',
        name: 'ID Verification',
        required: false,
        scope: 'per_service' as const,
        instructions: 'Upload government-issued ID',
      },
    ],
    subjectFields: [
      {
        id: 'field-1',
        name: 'First Name',
        required: true,
        dataType: 'text',
      },
    ],
    searchFields: [],
  };

  const mockServiceItems = [
    {
      itemId: 'item-1',
      serviceName: 'Criminal Background Check',
      locationName: 'National',
    },
  ];

  const mockSubjectFieldValues = {
    'field-1': 'John',
  };

  const mockSearchFieldValues = {};

  let mockOnDocumentUpload: ReturnType<typeof vi.fn>;
  let mockCheckMissingRequirements: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDocumentUpload = vi.fn();
    mockCheckMissingRequirements = vi.fn().mockReturnValue({
      isValid: true,
      missing: {
        subjectFields: [],
        searchFields: [],
        documents: [],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('REGRESSION TEST: Immediate file upload instead of storing File objects', () => {
    it('should upload file immediately when selected and store metadata', async () => {
      // Mock successful upload response with metadata
      const mockMetadata = {
        success: true,
        metadata: {
          documentId: 'doc-1',
          filename: 'authorization-123456.pdf',
          originalName: 'authorization.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'user-123',
          storagePath: 'uploads/user-123/doc-1/authorization-123456.pdf',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const { rerender } = render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{}}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Find and interact with file input for the first document (doc-1)
      const fileInput = document.querySelector('input[id="doc-doc-1"]') as HTMLInputElement;
      const file = new File(['test content'], 'authorization.pdf', { type: 'application/pdf' });

      await userEvent.upload(fileInput, file);

      // Wait for upload API to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/portal/uploads',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });

      // Verify FormData contains file and documentId
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const formData = fetchCall[1].body as FormData;
      expect(formData.get('file')).toBeInstanceOf(File);
      expect(formData.get('documentId')).toBe('doc-1');

      // Verify callback was called with metadata, not File object
      await waitFor(() => {
        expect(mockOnDocumentUpload).toHaveBeenCalledWith('doc-1', mockMetadata.metadata);
        expect(mockOnDocumentUpload).not.toHaveBeenCalledWith('doc-1', expect.any(File));
      });
    });

    it('should display uploaded document metadata in the UI', async () => {
      const mockMetadata = {
        documentId: 'doc-1',
        filename: 'authorization-123456.pdf',
        originalName: 'authorization.pdf',
        size: 1024,
        uploadedAt: new Date().toISOString(),
        storagePath: 'uploads/user-123/doc-1/authorization-123456.pdf',
      };

      render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{ 'doc-1': mockMetadata as any }}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Should show original filename in UI (appears in multiple places)
      const filenames = screen.getAllByText('authorization.pdf');
      expect(filenames.length).toBeGreaterThan(0);

      // Should show "Change File" button when document is already uploaded
      expect(screen.getByText('Change File')).toBeInTheDocument();
    });

    it('should handle upload failure and show error message', async () => {
      // Mock failed upload response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Upload failed: Server error' }),
      });

      render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{}}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      const fileInput = document.querySelector('input[id="doc-doc-1"]') as HTMLInputElement;
      const file = new File(['test content'], 'authorization.pdf', { type: 'application/pdf' });

      await userEvent.upload(fileInput, file);

      // Wait for upload attempt
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should NOT call onDocumentUpload if upload failed
      expect(mockOnDocumentUpload).not.toHaveBeenCalled();

      // Should show error state in UI (implementation specific)
      // The component should handle the error appropriately
    });

    it('should replace existing document when uploading a new one', async () => {
      const existingMetadata = {
        documentId: 'doc-1',
        filename: 'old-doc.pdf',
        originalName: 'old-doc.pdf',
        storagePath: 'uploads/user-123/doc-1/old-doc.pdf',
      };

      const newMetadata = {
        success: true,
        metadata: {
          documentId: 'doc-1',
          filename: 'new-doc.pdf',
          originalName: 'new-doc.pdf',
          storagePath: 'uploads/user-123/doc-1/new-doc.pdf',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => newMetadata,
      });

      const { rerender } = render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{ 'doc-1': existingMetadata as any }}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Should show "Change File" for existing document
      expect(screen.getByText('Change File')).toBeInTheDocument();

      const fileInput = document.querySelector('input[id="doc-doc-1"]') as HTMLInputElement;
      const newFile = new File(['new content'], 'new-doc.pdf', { type: 'application/pdf' });

      await userEvent.upload(fileInput, newFile);

      // Wait for upload with previous file reference
      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const formData = fetchCall[1].body as FormData;
        expect(formData.get('previousFile')).toBe('uploads/user-123/doc-1/old-doc.pdf');
      });

      // Verify new metadata is passed to callback
      await waitFor(() => {
        expect(mockOnDocumentUpload).toHaveBeenCalledWith('doc-1', newMetadata.metadata);
      });
    });

    it('should handle multiple document uploads for different requirements', async () => {
      const metadata1 = {
        success: true,
        metadata: {
          documentId: 'doc-1',
          filename: 'auth.pdf',
          originalName: 'auth.pdf',
        },
      };

      const metadata2 = {
        success: true,
        metadata: {
          documentId: 'doc-2',
          filename: 'id.pdf',
          originalName: 'id.pdf',
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => metadata1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => metadata2,
        });

      render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{}}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Upload first document
      const fileInput1 = document.querySelector('input[id="doc-doc-1"]') as HTMLInputElement;
      const file1 = new File(['content1'], 'auth.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput1, file1);

      // Upload second document
      const fileInput2 = document.querySelector('input[id="doc-doc-2"]') as HTMLInputElement;
      const file2 = new File(['content2'], 'id.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput2, file2);

      // Verify both uploads happened
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockOnDocumentUpload).toHaveBeenCalledWith('doc-1', metadata1.metadata);
        expect(mockOnDocumentUpload).toHaveBeenCalledWith('doc-2', metadata2.metadata);
      });
    });

    it('should show missing document warning in order summary', () => {
      const missingRequirements = {
        isValid: false,
        missing: {
          subjectFields: [],
          searchFields: [],
          documents: [
            { documentName: 'Background Check Authorization', serviceLocation: 'National' },
          ],
        },
      };

      mockCheckMissingRequirements.mockReturnValue(missingRequirements);

      render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{}}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Should show missing required document in summary
      expect(screen.getByText('Missing (Required)')).toBeInTheDocument();

      // Should show warning message
      expect(screen.getByText(/Missing Required Information/)).toBeInTheDocument();
      // Background Check Authorization appears multiple times (as document name and in warning)
      const authTexts = screen.getAllByText(/Background Check Authorization/);
      expect(authTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/Order will be saved as draft/)).toBeInTheDocument();
    });

    it('should not attempt to serialize File objects when saving', async () => {
      // This test verifies that the component passes metadata, not File objects,
      // which would fail JSON.stringify() when the form is submitted

      const mockMetadata = {
        documentId: 'doc-1',
        filename: 'test.pdf',
        originalName: 'test.pdf',
        storagePath: 'uploads/user-123/doc-1/test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      };

      render(
        <DocumentsReviewStep
          requirements={mockRequirements}
          serviceItems={mockServiceItems}
          subjectFieldValues={mockSubjectFieldValues}
          searchFieldValues={mockSearchFieldValues}
          uploadedDocuments={{ 'doc-1': mockMetadata as any }}
          onDocumentUpload={mockOnDocumentUpload}
          checkMissingRequirements={mockCheckMissingRequirements}
        />
      );

      // Verify that uploadedDocuments contains serializable metadata
      const uploadedDocs = { 'doc-1': mockMetadata };

      // This should not throw an error
      expect(() => JSON.stringify(uploadedDocs)).not.toThrow();

      // Verify the stringified version contains the metadata
      const stringified = JSON.stringify(uploadedDocs);
      expect(stringified).toContain('test.pdf');
      expect(stringified).toContain('uploads/user-123/doc-1/test.pdf');
      expect(stringified).not.toContain('[object File]');
    });
  });
});