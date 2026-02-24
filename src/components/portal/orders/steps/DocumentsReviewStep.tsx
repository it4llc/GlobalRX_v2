'use client';

interface DocumentsReviewStepProps {
  requirements: any;
  serviceItems: any[];
  subjectFieldValues: Record<string, any>;
  searchFieldValues: Record<string, Record<string, any>>;
  uploadedDocuments: Record<string, File>;
  onDocumentUpload: (documentId: string, file: File) => void;
  checkMissingRequirements: () => {
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
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Documents & Review
      </h3>
      <p className="text-gray-600 mb-4">
        Upload any required documents and review your order before submitting.
      </p>
      {requirements.documents.some((d: any) => d.required) && (
        <p className="text-sm text-gray-500 mb-6">
          <span className="text-red-500">*</span> Required documents must be uploaded before submission
        </p>
      )}

      {/* Documents Section */}
      {requirements.documents.length > 0 && (
        <div className="mb-8">
          <h4 className="text-md font-medium text-gray-900 mb-4">Required Documents</h4>
          <div className="space-y-4">
            {requirements.documents.map((document: any) => (
              <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900">
                      {document.name}
                      {document.required && <span className="text-red-500 ml-1">*</span>}
                    </h5>
                    {document.instructions && (
                      <p className="text-xs text-gray-500 mt-1">{document.instructions}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Scope: {document.scope === 'per_case' ? 'Once per order' : 'Per service'}
                      {document.required && <span className="text-red-600 ml-2">(Required)</span>}
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      id={`doc-${document.id}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onDocumentUpload(document.id, file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor={`doc-${document.id}`}
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      {uploadedDocuments[document.id] ? 'Change File' : 'Choose File'}
                    </label>
                    {uploadedDocuments[document.id] && (
                      <p className="text-xs text-green-600 mt-1">
                        {uploadedDocuments[document.id].name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Order Summary</h4>

        {/* Service Items */}
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Services ({serviceItems.length})</h5>
          <div className="space-y-2">
            {serviceItems.map((item: any) => (
              <div key={item.itemId} className="flex justify-between text-sm">
                <span>{item.serviceName}: <span className="font-medium text-blue-700">{item.locationName}</span></span>
                <span className="text-gray-400">Search</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subject Fields Summary */}
        {requirements.subjectFields.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Subject Information</h5>
            <div className="space-y-1">
              {requirements.subjectFields.map((field: any) => {
                const value = subjectFieldValues[field.id];

                // Check if it's an empty address block
                const isEmptyAddressBlock = field.dataType === 'address_block' &&
                  (!value || (typeof value === 'object' &&
                    !value.street1 && !value.city && !value.state && !value.postalCode));

                // Don't show optional empty fields
                if ((!value || isEmptyAddressBlock) && !field.required) return null;

                return (
                  <div key={field.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {field.name}:
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                    <span className={((!value || isEmptyAddressBlock) && field.required) ? 'text-red-600 font-medium' : 'font-medium'}>
                      {!value || isEmptyAddressBlock ? (
                        field.required ? 'Missing' : 'Not provided'
                      ) : Array.isArray(value) ? (
                        value.join(', ')
                      ) : (typeof value === 'object' && value !== null) ? (
                        // Handle address blocks and other objects
                        value.street1 || value.city || value.state || value.postalCode ? (
                          `${value.street1 || ''} ${value.city || ''} ${value.state || ''} ${value.postalCode || ''}`.trim()
                        ) : (
                          'Missing'
                        )
                      ) : (
                        value
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents Summary */}
        {requirements.documents.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Documents</h5>
            <div className="space-y-1">
              {requirements.documents.map((document: any) => {
                const file = uploadedDocuments[document.id];
                return (
                  <div key={document.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {document.name}:
                      {document.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                    <span className={file ? 'text-green-600' : (document.required ? 'text-red-600 font-medium' : 'text-gray-400')}>
                      {file ? file.name : (document.required ? 'Missing (Required)' : 'Not uploaded')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Missing Requirements Summary */}
        {(() => {
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