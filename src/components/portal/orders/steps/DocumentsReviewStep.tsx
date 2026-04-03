// /GlobalRX_v2/src/components/portal/orders/steps/DocumentsReviewStep.tsx
'use client';

import React from 'react';
import { DocumentTemplateButton } from '@/components/portal/orders/DocumentTemplateButton';
import { clientLogger } from '@/lib/client-logger';
import { useTranslation } from '@/contexts/TranslationContext';

// Types for order requirements and service items

// BUG FIX (April 3, 2026): Added AddressBlock interface to eliminate TypeScript 'any' usage
// PROBLEM: Previous code was using 'any' type for address objects, violating coding standards
// SOLUTION: Define proper interface with optional string fields for address components
// This ensures type safety when handling address data in order summaries
interface AddressBlock {
  street1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface DocumentRequirement {
  id: string;
  name: string;
  required: boolean;
  scope: 'per_case' | 'per_service';
  instructions?: string;
  documentData?: string | object;
}

interface SubjectField {
  id: string;
  name: string;
  required: boolean;
  dataType: string;
}

interface ServiceItem {
  itemId: string;
  serviceName: string;
  locationName: string;
}

interface OrderRequirements {
  documents: DocumentRequirement[];
  subjectFields: SubjectField[];
  searchFields: SubjectField[]; // Same structure as subjectFields
}

// Type for uploaded document metadata (not File object)
interface UploadedDocumentMetadata {
  documentId: string;
  filename: string;
  originalName: string;
  storagePath: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: string;
}

interface DocumentsReviewStepProps {
  requirements: OrderRequirements;
  serviceItems: ServiceItem[];
  subjectFieldValues: Record<string, unknown>;
  searchFieldValues: Record<string, Record<string, unknown>>;
  uploadedDocuments: Record<string, UploadedDocumentMetadata>;
  onDocumentUpload: (documentId: string, metadata: UploadedDocumentMetadata) => void;
  checkMissingRequirements?: () => {
    isValid: boolean;
    missing: {
      subjectFields: Array<{ fieldName: string; serviceLocation: string }>;
      searchFields: Array<{ fieldName: string; serviceLocation: string }>;
      documents: Array<{ documentName: string; serviceLocation: string }>;
    };
  };
}

export function DocumentsReviewStep({
  requirements,
  serviceItems,
  subjectFieldValues,
  searchFieldValues,
  uploadedDocuments,
  onDocumentUpload,
  checkMissingRequirements
}: DocumentsReviewStepProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('documents_review_title')}
      </h3>
      <p className="text-gray-600 mb-4">
        {t('documents_review_description')}
      </p>
      {requirements.documents.some((d) => d.required) && (
        <p className="text-sm text-gray-500 mb-6">
          <span className="text-red-500">*</span> {t('required_documents_notice')}
        </p>
      )}

      {/* Documents Section */}
      {requirements.documents.length > 0 && (
        <div className="mb-8">
          <h4 className="text-md font-medium text-gray-900 mb-4">{t('required_documents_heading')}</h4>
          <div className="space-y-4">
            {requirements.documents.map((document) => {
              // Parse documentData to check for PDF template
              let documentData: Record<string, unknown> = {};
              try {
                if (document.documentData) {
                  // Handle both string and object formats
                  if (typeof document.documentData === 'string') {
                    documentData = JSON.parse(document.documentData);
                    // If it's still a string after parsing, parse again (double-stringified)
                    if (typeof documentData === 'string') {
                      documentData = JSON.parse(documentData as string);
                    }
                  } else {
                    documentData = document.documentData as Record<string, unknown>;
                  }
                }
              } catch (e) {
                clientLogger.warn('Failed to parse documentData', {
                  error: e instanceof Error ? e.message : String(e),
                  documentId: document.id,
                  documentName: document.name
                });
                documentData = {};
              }

              const hasTemplate = !!documentData.pdfPath && typeof documentData.pdfPath === 'string' && documentData.pdfPath.trim() !== '';

              // Remove debug logging - no longer needed

              return (
                <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-gray-900">
                        {document.name}
                        {document.required && <span className="text-red-500 ml-1">*</span>}
                      </h5>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex-1">
                          {(document.instructions || String(documentData.instructions || '')) && (
                            <p className="text-xs text-gray-500">{String(document.instructions || documentData.instructions || '')}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {t('scope_label')}: {document.scope === 'per_case' ? t('once_per_order') : t('per_service')}
                            {document.required && <span className="text-red-600 ml-2">({t('required')})</span>}
                          </p>
                        </div>
                        {hasTemplate && (
                          <div className="flex-shrink-0">
                            <DocumentTemplateButton
                              documentId={document.id}
                              hasTemplate={hasTemplate}
                              pdfPath={String(documentData.pdfPath || '')}
                              filename={String(documentData.pdfFilename || documentData.filename || '')}
                              fileSize={Number(documentData.pdfFileSize || documentData.fileSize || 0)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                    <input
                      type="file"
                      id={`doc-${document.id}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // BUG FIX: Upload file immediately to server instead of storing File object
                          // PROBLEM: File objects can't be JSON serialized - when draft orders save,
                          // JSON.stringify() turns File objects into empty {}, losing documents
                          // SOLUTION: Upload immediately when file is selected, store only metadata
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('documentId', document.id);

                            // If replacing an existing document, include the old file path
                            const existingDoc = uploadedDocuments[document.id];
                            if (existingDoc && existingDoc.storagePath) {
                              formData.append('previousFile', existingDoc.storagePath);
                            }

                            const response = await fetch('/api/portal/uploads', {
                              method: 'POST',
                              body: formData,
                            });

                            if (response.ok) {
                              const result = await response.json();
                              // BUG FIX: Pass metadata to parent, not the File object
                              // This ensures state contains only JSON-serializable data
                              onDocumentUpload(document.id, result.metadata);
                            } else {
                              // Handle upload error
                              const error = await response.json();
                              clientLogger.error('Document upload failed', {
                                documentId: document.id,
                                error: error.error || 'Unknown error',
                              });
                              // TODO: Show error message to user
                            }
                          } catch (error) {
                            clientLogger.error('Document upload error', {
                              documentId: document.id,
                              error: error instanceof Error ? error.message : String(error),
                            });
                            // TODO: Show error message to user
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor={`doc-${document.id}`}
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      {uploadedDocuments[document.id] ? t('change_file') : t('choose_file')}
                    </label>
                    {uploadedDocuments[document.id] && (
                      <p className="text-xs text-green-600 mt-1">
                        {uploadedDocuments[document.id].originalName || uploadedDocuments[document.id].filename}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">{t('order_summary')}</h4>

        {/* BUG FIX: Section ordering corrected (March 14, 2026)
            Subject Information now appears BEFORE Services section
            Previously Services appeared first, which was incorrect UX flow */}

        {/* Subject Fields Summary */}
        {requirements.subjectFields.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">{t('subject_information')}</h5>
            <div className="space-y-1">
              {requirements.subjectFields.map((field) => {
                const value = subjectFieldValues[field.id];

                // Check if it's an empty address block
                const isEmptyAddressBlock = field.dataType === 'address_block' &&
                  (!value || (typeof value === 'object' && value !== null &&
                    !(value as AddressBlock).street1 && !(value as AddressBlock).city && !(value as AddressBlock).state && !(value as AddressBlock).postalCode));

                // Don't show optional empty fields
                if ((!value || isEmptyAddressBlock) && !field.required) return null;

                return (
                  <div key={field.id} className="flex justify-between text-sm">
                    {/* BUG FIX: Removed asterisks from field names in order summary (March 14, 2026)
                        Order summary is a read-only display, not an input form.
                        Asterisks are only appropriate for form inputs, not summary displays.
                        BEFORE: {field.name}: {field.required && <span className="text-red-500 ml-1">*</span>}
                        AFTER: {field.name}: (no asterisk) */}
                    <span className="text-gray-600">{field.name}:</span>
                    <span className={((!value || isEmptyAddressBlock) && field.required) ? 'text-red-600 font-medium' : 'font-medium'}>
                      {!value || isEmptyAddressBlock ? (
                        field.required ? t('missing') : t('not_provided')
                      ) : Array.isArray(value) ? (
                        value.join(', ')
                      ) : (typeof value === 'object' && value !== null) ? (
                        // Handle address blocks and other objects
                        (value as AddressBlock).street1 || (value as AddressBlock).city || (value as AddressBlock).state || (value as AddressBlock).postalCode ? (
                          `${(value as AddressBlock).street1 || ''} ${(value as AddressBlock).city || ''} ${(value as AddressBlock).state || ''} ${(value as AddressBlock).postalCode || ''}`.trim()
                        ) : (
                          t('missing')
                        )
                      ) : (
                        String(value || '')
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Fields Summary */}
        {/* BUG FIX (April 3, 2026): Added missing search fields section to order summary
             PROBLEM: Search fields were missing from the order summary display, breaking UX consistency
             SOLUTION: Added complete search fields rendering section with proper per-service grouping
             This section shows search field values organized by service, matching the input flow */}
        {requirements.searchFields && requirements.searchFields.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">{t('search_fields')}</h5>
            <div className="space-y-1">
              {serviceItems.map((serviceItem) => {
                const serviceSearchValues = searchFieldValues[serviceItem.itemId] || {};

                return (
                  <div key={serviceItem.itemId} className="mb-3">
                    <div className="text-xs font-medium text-blue-700 mb-1">
                      {serviceItem.serviceName}: {serviceItem.locationName}
                    </div>
                    <div className="space-y-1 pl-2">
                      {requirements.searchFields.map((field) => {
                        const value = serviceSearchValues[field.id];

                        // Don't show optional empty fields
                        if ((!value || value === '') && !field.required) return null;

                        return (
                          <div key={field.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{field.name}:</span>
                            <span className={((!value || value === '') && field.required) ? 'text-red-600 font-medium' : 'font-medium'}>
                              {!value || value === '' ? (
                                field.required ? t('missing') : t('not_provided')
                              ) : Array.isArray(value) ? (
                                value.join(', ')
                              ) : typeof value === 'object' && value !== null ? (
                                JSON.stringify(value)
                              ) : (
                                String(value)
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Service Items */}
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">{t('services_count').replace('{count}', serviceItems.length.toString())}</h5>
          <div className="space-y-2">
            {serviceItems.map((item) => (
              <div key={item.itemId} className="flex justify-between text-sm">
                <span>{item.serviceName}: <span className="font-medium text-blue-700">{item.locationName}</span></span>
                <span className="text-gray-400">{t('search')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Documents Summary */}
        {requirements.documents.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">{t('documents')}</h5>
            <div className="space-y-1">
              {requirements.documents.map((document) => {
                const docMetadata = uploadedDocuments[document.id];
                return (
                  <div key={document.id} className="flex justify-between text-sm">
                    {/* BUG FIX: Removed asterisks from document names in order summary (March 14, 2026)
                        Same reasoning as field names - this is a read-only summary display */}
                    <span className="text-gray-600">{document.name}:</span>
                    <span className={docMetadata ? 'text-green-600' : (document.required ? 'text-red-600 font-medium' : 'text-gray-400')}>
                      {docMetadata ? (docMetadata.originalName || docMetadata.filename) : (document.required ? t('missing_required') : t('not_uploaded'))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Missing Requirements Summary */}
        {checkMissingRequirements && (() => {
          const { isValid, missing } = checkMissingRequirements();
          const totalMissing =
            missing.subjectFields.length +
            missing.searchFields.length +
            missing.documents.length;

          if (totalMissing > 0) {
            return (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800 mb-2">
                  ⚠️ Missing Required Information ({totalMissing} items)
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {missing.subjectFields.map((field, idx) => (
                    <li key={`sub-${idx}`}>• {field.fieldName} (Subject)</li>
                  ))}
                  {missing.searchFields.map((field, idx) => (
                    <li key={`search-${idx}`}>• {field.fieldName} ({field.serviceLocation})</li>
                  ))}
                  {missing.documents.map((doc, idx) => (
                    <li key={`doc-${idx}`}>• {doc.documentName} (Document)</li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 mt-2">
                  Order will be saved as draft if submitted with missing requirements.
                </p>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}