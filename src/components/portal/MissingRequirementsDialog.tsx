'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface MissingRequirement {
  subjectFields: Array<{ fieldName: string; serviceLocation: string }>;
  searchFields: Array<{ fieldName: string; serviceLocation: string }>;
  documents: Array<{ documentName: string; serviceLocation: string }>;
}

interface MissingRequirementsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsDraft: () => void;
  onGoBack: () => void;
  missingRequirements: MissingRequirement;
  isSubmitting?: boolean;
}

export function MissingRequirementsDialog({
  isOpen,
  onClose,
  onSaveAsDraft,
  onGoBack,
  missingRequirements,
  isSubmitting = false,
}: MissingRequirementsDialogProps) {
  const hasSubjectFields = missingRequirements.subjectFields.length > 0;
  const hasSearchFields = missingRequirements.searchFields.length > 0;
  const hasDocuments = missingRequirements.documents.length > 0;
  const totalMissing =
    missingRequirements.subjectFields.length +
    missingRequirements.searchFields.length +
    missingRequirements.documents.length;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                    <ExclamationTriangleIcon
                      className="h-6 w-6 text-yellow-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Missing Required Information
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Your order is missing {totalMissing} required{' '}
                        {totalMissing === 1 ? 'item' : 'items'}. You can either go back to
                        complete them or save the order as a draft. Draft orders cannot be
                        processed until all requirements are met.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 max-h-60 overflow-y-auto">
                    {/* Missing Subject Fields */}
                    {hasSubjectFields && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Missing Subject Information ({missingRequirements.subjectFields.length})
                        </h4>
                        <ul className="space-y-1">
                          {missingRequirements.subjectFields.map((field, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-600 flex items-start"
                            >
                              <span className="text-red-500 mr-2">•</span>
                              <div>
                                <span className="font-medium">{field.fieldName}</span>
                                <span className="text-xs text-gray-400 ml-1">
                                  ({field.serviceLocation})
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Search Fields */}
                    {hasSearchFields && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Missing Search Parameters ({missingRequirements.searchFields.length})
                        </h4>
                        <ul className="space-y-1">
                          {missingRequirements.searchFields.map((field, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-600 flex items-start"
                            >
                              <span className="text-red-500 mr-2">•</span>
                              <div>
                                <span className="font-medium">{field.fieldName}</span>
                                <span className="text-xs text-gray-400 ml-1">
                                  ({field.serviceLocation})
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing Documents */}
                    {hasDocuments && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Missing Documents ({missingRequirements.documents.length})
                        </h4>
                        <ul className="space-y-1">
                          {missingRequirements.documents.map((doc, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-600 flex items-start"
                            >
                              <span className="text-red-500 mr-2">•</span>
                              <div>
                                <span className="font-medium">{doc.documentName}</span>
                                <span className="text-xs text-gray-400 ml-1">
                                  ({doc.serviceLocation})
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onGoBack}
                    disabled={isSubmitting}
                  >
                    Go Back & Complete
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onSaveAsDraft}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-600 mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save as Draft'
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}