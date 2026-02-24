'use client';

import { useRouter } from 'next/navigation';
import { useOrderFormState } from '@/components/portal/orders/hooks/useOrderFormState';
import { OrderStepsIndicator } from '@/components/portal/orders/OrderStepsIndicator';
import { ServiceSelectionStep } from '@/components/portal/orders/steps/ServiceSelectionStep';
import { SubjectInfoStep } from '@/components/portal/orders/steps/SubjectInfoStep';
import { SearchDetailsStep } from '@/components/portal/orders/steps/SearchDetailsStep';
import { DocumentsReviewStep } from '@/components/portal/orders/steps/DocumentsReviewStep';
import { MissingRequirementsDialog } from '@/components/portal/MissingRequirementsDialog';
import clientLogger from '@/lib/client-logger';

export default function NewOrderPage() {
  const router = useRouter();
  const orderForm = useOrderFormState();

  // Handle next button navigation
  const handleNext = async () => {
    console.log('handleNext called - before clientLogger');

    // Try using clientLogger here to see if it fails
    try {
      clientLogger.debug('handleNext called', {
        currentStep: orderForm.step
      });
    } catch (error) {
      console.error('clientLogger.debug failed in handleNext:', error);
      alert('clientLogger error in handleNext: ' + String(error));
      return;
    }

    console.log('handleNext - after clientLogger.debug');

    if (orderForm.step === 1) {
      const validation = orderForm.validation.validateStep1(orderForm.serviceCart.serviceItems);
      if (!validation.isValid) {
        orderForm.setFormErrors(validation.errors);
        clientLogger.warn('Step 1 validation failed');
        return;
      }
      // Fetch requirements when moving from step 1 to 2
      clientLogger.debug('Fetching requirements');
      await orderForm.requirements.fetchRequirements(orderForm.serviceCart.serviceItems);
      orderForm.setStep(2);
      return;
    }

    if (orderForm.step === 2) {
      if (!orderForm.validation.validateStep2()) {
        clientLogger.warn('Step 2 (subject info) validation failed');
        return;
      }
      orderForm.setStep(3);
      return;
    }

    if (orderForm.step === 3) {
      if (!orderForm.validation.validateStep3()) {
        clientLogger.warn('Step 3 (search details) validation failed');
        return;
      }
      orderForm.setStep(4);
      return;
    }

    if (orderForm.step === 4) {
      // Step 4 is documents & review, then submit
      await handleSubmitOrder();
      return;
    }
  };

  // Submit order
  const handleSubmitOrder = async (forceDraft = false) => {
    if (!orderForm.validation.validateStep3()) {
      orderForm.setStep(3); // Go back to step 3 if validation fails
      return;
    }

    // Check for missing requirements unless forcing draft
    if (!forceDraft) {
      const { isValid, missing } = orderForm.validation.checkMissingRequirements(
        orderForm.requirements.requirements,
        orderForm.serviceCart.serviceItems,
        orderForm.subjectFieldValues,
        orderForm.searchFieldValues,
        orderForm.uploadedDocuments
      );
      if (!isValid) {
        orderForm.setMissingRequirements(missing);
        orderForm.setShowMissingRequirementsDialog(true);
        return;
      }
    }

    orderForm.setIsSubmitting(true);

    // Convert UUID-based field values to name-based field values for better storage
    const subjectFieldsByName = orderForm.validation.convertSubjectFieldsToNameBased(
      orderForm.subjectFieldValues,
      orderForm.requirements.requirements.subjectFields
    );

    const searchFieldsByName = orderForm.validation.convertSearchFieldsToNameBased(
      orderForm.searchFieldValues,
      orderForm.requirements.requirements.searchFields
    );

    try {
      // If in edit mode, update the existing order; otherwise create a new one
      const url = orderForm.isEditMode ? `/api/portal/orders/${orderForm.editOrderId}` : '/api/portal/orders';
      const method = orderForm.isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderForm.formData,
          subjectFieldValues: subjectFieldsByName, // Send name-based fields
          searchFieldValues: searchFieldsByName,   // Send name-based fields
          uploadedDocuments: orderForm.uploadedDocuments,
          status: forceDraft ? 'draft' : 'submitted', // Set status based on forceDraft
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const result = await response.json();

      // Check if server overrode status due to validation
      if (result.statusOverride === 'draft' && !forceDraft) {
        // Server forced to draft, show warning
        orderForm.setMissingRequirements(result.missingRequirements || orderForm.missingRequirements);
        orderForm.setShowMissingRequirementsDialog(true);
        orderForm.setIsSubmitting(false);
        return;
      }

      // Redirect to order details or orders list
      const orderId = result.order?.id || result.id;
      if (forceDraft || result.statusOverride === 'draft') {
        router.push('/portal/orders?draft=saved');
      } else {
        router.push(`/portal/orders?created=${orderId}`);
      }
    } catch (error: unknown) {
      clientLogger.error('Error creating order', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      orderForm.setFormErrors({
        submit: error instanceof Error ? error.message : 'Failed to create order',
      });
    } finally {
      orderForm.setIsSubmitting(false);
    }
  };

  // Save as draft
  const handleSaveAsDraft = async () => {
    if (orderForm.serviceCart.serviceItems.length === 0) {
      orderForm.setFormErrors({
        submit: 'Please add at least one service to save as draft',
      });
      return;
    }

    await handleSubmitOrder(true);
  };

  // Show loading state while loading order in edit mode
  if (orderForm.isLoadingOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading draft order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {orderForm.isEditMode ? 'Edit Draft Order' : 'Create New Order'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {orderForm.isEditMode ? 'Update your draft order before submitting' : 'Follow the steps below to place a new order'}
        </p>
      </div>

      {/* Steps Indicator */}
      <OrderStepsIndicator
        currentStep={orderForm.step}
        isStepComplete={orderForm.isStepComplete}
        isStepIncomplete={orderForm.isStepIncomplete}
        isStepStarted={orderForm.isStepStarted}
      />

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {orderForm.step === 1 && (
          <ServiceSelectionStep
            availableServices={orderForm.availableServices}
            loadingServices={orderForm.loadingServices}
            availableLocations={orderForm.availableLocations}
            loadingLocations={orderForm.loadingLocations}
            selectedServiceForLocation={orderForm.selectedServiceForLocation}
            selectedCountry={orderForm.selectedCountry}
            serviceItems={orderForm.serviceCart.serviceItems}
            errors={orderForm.errors}
            onServiceSelect={async (service) => {
              orderForm.setSelectedServiceForLocation(service);
              orderForm.setSelectedCountry('');
              // Fetch locations with availability for this specific service
              await orderForm.fetchAvailableLocations('root', service.id);
            }}
            onCountrySelect={async (countryId) => {
              orderForm.setSelectedCountry(countryId);
              if (countryId) {
                await orderForm.fetchAvailableLocations(countryId);
              }
            }}
            onAddToCart={(service, locationId, locationName) => {
              orderForm.serviceCart.addServiceToCart(service, locationId, locationName);
              orderForm.resetSelections();
              // Clear any service-related errors
              if (orderForm.errors.services) {
                orderForm.clearError('services');
              }
            }}
            onRemoveFromCart={(itemId) => {
              orderForm.serviceCart.removeServiceFromCart(itemId);
            }}
          />
        )}

        {orderForm.step === 2 && (
          <SubjectInfoStep
            requirements={orderForm.requirements.requirements}
            subjectFieldValues={orderForm.subjectFieldValues}
            errors={orderForm.errors}
            serviceItems={orderForm.serviceCart.serviceItems}
            onFieldChange={(fieldId, value) => {
              orderForm.setSubjectFieldValues(prev => ({
                ...prev,
                [fieldId]: value
              }));
            }}
            onFieldError={(fieldId) => {
              orderForm.clearError(fieldId);
            }}
          />
        )}

        {orderForm.step === 3 && (
          <SearchDetailsStep
            requirements={orderForm.requirements.requirements}
            serviceItems={orderForm.serviceCart.serviceItems}
            searchFieldValues={orderForm.searchFieldValues}
            errors={orderForm.errors}
            onFieldChange={(itemId, fieldId, value) => {
              orderForm.setSearchFieldValues(prev => ({
                ...prev,
                [itemId]: {
                  ...prev[itemId],
                  [fieldId]: value
                }
              }));
            }}
            onFieldError={(itemId, fieldId) => {
              const errorKey = `${itemId}_${fieldId}`;
              orderForm.clearError(errorKey);
            }}
          />
        )}

        {orderForm.step === 4 && (
          <DocumentsReviewStep
            requirements={orderForm.requirements.requirements}
            serviceItems={orderForm.serviceCart.serviceItems}
            subjectFieldValues={orderForm.subjectFieldValues}
            searchFieldValues={orderForm.searchFieldValues}
            uploadedDocuments={orderForm.uploadedDocuments}
            onDocumentUpload={(documentId, file) => {
              orderForm.setUploadedDocuments(prev => ({
                ...prev,
                [documentId]: file
              }));
            }}
            checkMissingRequirements={() =>
              orderForm.validation.checkMissingRequirements(
                orderForm.requirements.requirements,
                orderForm.serviceCart.serviceItems,
                orderForm.subjectFieldValues,
                orderForm.searchFieldValues,
                orderForm.uploadedDocuments
              )
            }
          />
        )}

        {/* Error Display */}
        {orderForm.errors.submit && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{orderForm.errors.submit}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-4">Step {orderForm.step} of 4 • Items in cart: {orderForm.serviceCart.itemCount}</p>
        </div>

        <div className="mt-4 flex justify-between border-t pt-6">
          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/portal/orders')}
              className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {orderForm.step > 1 && (
              <button
                onClick={() => orderForm.setStep(Math.max(1, orderForm.step - 1))}
                className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
            )}

            {orderForm.step >= 2 && (
              <button
                onClick={handleSaveAsDraft}
                disabled={orderForm.isSubmitting || orderForm.serviceCart.itemCount === 0}
                className="inline-flex items-center rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {orderForm.isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              console.log('Next button clicked - calling handleNext');
              handleNext();
            }}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={orderForm.isSubmitting}
          >
            {orderForm.isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>{orderForm.step === 4 ? 'Submit Order' : 'Next'}</>
            )}
          </button>
        </div>
      </div>

      {/* Missing Requirements Dialog */}
      <MissingRequirementsDialog
        isOpen={orderForm.showMissingRequirementsDialog}
        onClose={() => orderForm.setShowMissingRequirementsDialog(false)}
        onSaveAsDraft={async () => {
          orderForm.setShowMissingRequirementsDialog(false);
          await handleSubmitOrder(true); // Force save as draft
        }}
        onGoBack={() => {
          orderForm.setShowMissingRequirementsDialog(false);
          // Go to the first step with missing requirements
          if (orderForm.missingRequirements.subjectFields.length > 0) {
            orderForm.setStep(2);
          } else if (orderForm.missingRequirements.searchFields.length > 0) {
            orderForm.setStep(3);
          } else if (orderForm.missingRequirements.documents.length > 0) {
            orderForm.setStep(4);
          }
        }}
        missingRequirements={orderForm.missingRequirements}
        isSubmitting={orderForm.isSubmitting}
      />
    </div>
  );
}