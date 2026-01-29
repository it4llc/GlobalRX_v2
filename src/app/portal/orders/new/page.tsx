'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DynamicFieldInput } from '@/components/dynamic-field-input';

interface SubjectInfo {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
}

interface AvailableService {
  id: string;
  name: string;
  category: string;
}

interface AvailableLocation {
  id: string;
  name: string;
  code2?: string;
  code?: string;
  available: boolean;
  hasSublocations: boolean;
  level?: number;
}

interface ServiceItem {
  serviceId: string;
  serviceName: string;
  locationId: string;
  locationName: string;
  itemId: string; // Unique ID for this service+location combination
}

interface OrderFormData {
  serviceItems: ServiceItem[];
  subject: SubjectInfo;
  notes: string;
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>({
    serviceItems: [],
    subject: {
      firstName: '',
      lastName: '',
      middleName: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      address: '',
    },
    notes: '',
  });
  const [selectedServiceForLocation, setSelectedServiceForLocation] = useState<AvailableService | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [availableLocations, setAvailableLocations] = useState<AvailableLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [sublocations, setSublocations] = useState<{[parentId: string]: AvailableLocation[]}>({});

  // Requirements and dynamic fields state
  const [requirements, setRequirements] = useState<{
    subjectFields: any[];
    searchFields: any[];
    documents: any[];
  }>({ subjectFields: [], searchFields: [], documents: [] });
  const [subjectFieldValues, setSubjectFieldValues] = useState<Record<string, any>>({});
  const [searchFieldValues, setSearchFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, File>>({});

  // Note: Subregion selection removed - now handled through address blocks

  // Fetch available services for the customer
  useEffect(() => {
    if (session?.user?.customerId) {
      fetchAvailableServices();
      fetchAvailableLocations('root');
    }
  }, [session]);

  const fetchAvailableServices = async () => {
    try {
      setLoadingServices(true);
      const response = await fetch('/api/portal/services');
      if (response.ok) {
        const services = await response.json();
        setAvailableServices(services);
      } else {
        console.error('Failed to fetch services');
        setErrors({ submit: 'Failed to load available services' });
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setErrors({ submit: 'Failed to load available services' });
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchAvailableLocations = async (parentId: string = 'root') => {
    try {
      setLoadingLocations(true);
      const response = await fetch(`/api/portal/locations?parentId=${parentId}`);
      if (response.ok) {
        const locations = await response.json();

        if (parentId === 'root') {
          setAvailableLocations(locations);
        } else {
          setSublocations(prev => ({
            ...prev,
            [parentId]: locations
          }));
        }

        return locations;
      } else {
        console.error('Failed to fetch locations');
        return [];
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    } finally {
      setLoadingLocations(false);
    }
  };

  // Note: Subregion fetching removed - now handled through address blocks

  // Update form data
  const updateSubject = (field: keyof SubjectInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      subject: {
        ...prev.subject,
        [field]: value,
      },
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  // Add service+location to cart
  const addServiceToCart = (service: AvailableService, locationId: string, locationName: string) => {
    const itemId = `${service.id}-${locationId}-${Date.now()}`; // Unique ID for this combination

    setFormData(prev => ({
      ...prev,
      serviceItems: [
        ...prev.serviceItems,
        {
          serviceId: service.id,
          serviceName: service.name,
          locationId: locationId,
          locationName: locationName,
          itemId: itemId,
        },
      ],
    }));

    // Reset selections
    setSelectedServiceForLocation(null);
    setSelectedCountry('');

    // Clear any service-related errors
    if (errors.services) {
      setErrors(prev => ({
        ...prev,
        services: '',
      }));
    }
  };

  // Remove item from cart
  const removeServiceFromCart = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      serviceItems: prev.serviceItems.filter(item => item.itemId !== itemId),
    }));
  };

  // Fetch requirements based on selected service+location pairs
  const fetchRequirements = async () => {
    if (formData.serviceItems.length === 0) {
      console.log('No service items to fetch requirements for');
      return;
    }

    console.log('Fetching requirements for service items:', formData.serviceItems);

    try {
      const requestBody = {
        items: formData.serviceItems.map(item => ({
          serviceId: item.serviceId,
          locationId: item.locationId,
        })),
      };

      console.log('Requirements request body:', requestBody);

      const response = await fetch('/api/portal/orders/requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Requirements response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Requirements data received:', data);
        setRequirements(data);
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch requirements. Status:', response.status, 'Response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching requirements:', error);
    }
  };


  // Validate step 1 (service and location selection)
  const validateStep1 = (): boolean => {
    console.log('validateStep1 called, service items count:', formData.serviceItems.length);
    const newErrors: Record<string, string> = {};

    if (formData.serviceItems.length === 0) {
      newErrors.services = 'Please add at least one service to your order';
      console.log('Validation error: No services added to cart');
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    console.log('Step 1 validation result:', isValid);
    return isValid;
  };

  // Validate step 2 (subject information)
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate required subject fields from dynamic requirements
    requirements.subjectFields.forEach(field => {
      if (field.required && !subjectFieldValues[field.id]) {
        newErrors[field.id] = `${field.name} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate step 3 (search details)
  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate search-level fields for each service item
    formData.serviceItems.forEach(item => {
      const itemFields = requirements.searchFields.filter(
        field => field.serviceId === item.serviceId && field.locationId === item.locationId
      );

      itemFields.forEach(field => {
        if (field.required && !searchFieldValues[item.itemId]?.[field.id]) {
          newErrors[`${item.itemId}_${field.id}`] = `${field.name} is required`;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if a step is complete (for status indicators)
  const isStepComplete = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return formData.serviceItems.length > 0;
      case 2:
        // Only consider complete if we have requirements and all required fields are filled
        if (requirements.subjectFields.length === 0 && step > 2) {
          return true; // No fields required, and we've moved past this step
        }
        return requirements.subjectFields.length > 0 &&
               requirements.subjectFields.every(field =>
                 !field.required || subjectFieldValues[field.id]
               );
      case 3:
        // Only consider complete if we've been to step 3 and filled all required fields
        if (step < 3) return false;
        return formData.serviceItems.every(item => {
          const itemFields = requirements.searchFields.filter(
            field => field.serviceId === item.serviceId && field.locationId === item.locationId
          );
          // If no fields for this item, it's complete
          if (itemFields.length === 0) return true;
          return itemFields.every(field =>
            !field.required || searchFieldValues[item.itemId]?.[field.id]
          );
        });
      case 4:
        // Only consider complete if we've been to step 4 and uploaded all required documents
        if (step < 4) return false;
        if (requirements.documents.length === 0) return true; // No documents required
        return requirements.documents.every(document =>
          !document.required || uploadedDocuments[document.id]
        );
      default:
        return false;
    }
  };

  // Check if a step has been started but not completed (for red status)
  const isStepIncomplete = (stepNumber: number): boolean => {
    if (step < stepNumber) return false; // Not reached yet
    return step >= stepNumber && !isStepComplete(stepNumber);
  };

  // Check if a step has been visited/started
  const isStepStarted = (stepNumber: number): boolean => {
    return step >= stepNumber;
  };

  // Handle next button
  const handleNext = async () => {
    console.log('handleNext called, current step:', step);
    console.log('formData.serviceItems:', formData.serviceItems);

    if (step === 1) {
      if (!validateStep1()) {
        console.log('Step 1 validation failed');
        return;
      }
      // Fetch requirements when moving from step 1 to 2
      console.log('Fetching requirements...');
      await fetchRequirements();
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateStep2()) {
        console.log('Step 2 (subject info) validation failed');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!validateStep3()) {
        console.log('Step 3 (search details) validation failed');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      // Step 4 is documents & review, then submit
      handleSubmitOrder();
      return;
    }
  };

  // Submit order
  const handleSubmitOrder = async () => {
    if (!validateStep3()) {
      setStep(3); // Go back to step 3 if validation fails
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const order = await response.json();

      // Redirect to order details or orders list
      router.push(`/portal/orders?created=${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create order',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save as draft
  const handleSaveAsDraft = async () => {
    if (formData.serviceItems.length === 0) {
      setErrors({
        submit: 'Please add at least one service to save as draft',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/portal/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: formData.serviceItems,
          subject: formData.subject,
          notes: formData.notes || 'Draft order',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save draft');
      }

      const order = await response.json();
      router.push('/portal/orders?draft=saved');
    } catch (error) {
      console.error('Error saving draft:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to save draft',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
        <p className="mt-1 text-sm text-gray-600">
          Follow the steps below to place a new order
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((stepNum) => {
            const isComplete = isStepComplete(stepNum);
            const isIncomplete = isStepIncomplete(stepNum);
            const hasBeenStarted = isStepStarted(stepNum);
            const isCurrent = step === stepNum;
            const stepLabels = [
              'Services & Locations',
              'Subject Information',
              'Search Details',
              'Documents & Review'
            ];

            // Determine the status color and style
            let statusColor = 'text-gray-500'; // Not started (default)
            let circleColor = 'border-gray-300 text-gray-500'; // Not started (default)

            if (!hasBeenStarted) {
              // Step not reached yet - keep gray/neutral
              statusColor = 'text-gray-500';
              circleColor = 'border-gray-300 text-gray-500';
            } else if (isComplete) {
              // Step completed successfully
              statusColor = 'text-green-600';
              circleColor = 'border-green-600 bg-green-600 text-white';
            } else if (isCurrent) {
              // Currently active step
              if (!isComplete) {
                // Current step but incomplete - show red
                statusColor = 'text-red-600';
                circleColor = 'border-red-600 bg-red-600 text-white';
              } else {
                // Current step and complete - show green
                statusColor = 'text-green-600';
                circleColor = 'border-green-600 bg-green-600 text-white';
              }
            } else if (hasBeenStarted && !isComplete) {
              // Past step that's incomplete - show red
              statusColor = 'text-red-600';
              circleColor = 'border-red-600 bg-red-600 text-white';
            }

            return (
              <div key={stepNum} className={`flex items-center ${statusColor}`}>
                <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${circleColor}`}>
                  {isComplete && stepNum < step ? '✓' : stepNum}
                </div>
                <span className="ml-2 text-sm font-medium">{stepLabels[stepNum - 1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select Services & Locations
            </h3>
            <p className="text-gray-600 mb-6">
              Choose services and their locations. You can add multiple instances of the same service with different locations.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service Selection Column */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Available Services</h4>
                {loadingServices ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading services...</span>
                  </div>
                ) : availableServices.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No services available.</p>
                    <p className="text-sm text-gray-400 mt-2">Please contact support.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableServices.map((service) => {
                      const isSelected = selectedServiceForLocation?.id === service.id;
                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            setSelectedServiceForLocation(service);
                            setSelectedCountry('');
                          }}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-sm font-medium text-gray-900">
                                {service.name}
                              </h5>
                              <p className="text-xs text-gray-500 mt-1">
                                {service.category}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="text-xs text-blue-600 font-medium">
                                Select location →
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Location Selection Column */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Location Selection</h4>
                {selectedServiceForLocation ? (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-3">
                      Select location for: {selectedServiceForLocation.name}
                    </p>

                    {/* Country Dropdown */}
                    <div className="mb-3">
                      <label htmlFor="inline-country" className="block text-xs font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <select
                        id="inline-country"
                        value={selectedCountry}
                        onChange={async (e) => {
                          const countryId = e.target.value;
                          setSelectedCountry(countryId);

                          if (countryId) {
                            await fetchAvailableLocations(countryId);
                          }
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Country --</option>
                        {availableLocations.map((location) => (
                          <option
                            key={location.id}
                            value={location.id}
                            disabled={!location.available}
                          >
                            {location.name} {location.code2 ? `(${location.code2})` : ''}
                            {!location.available && ' - Not Available'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Add Button */}
                    {selectedCountry && (
                      <button
                        onClick={() => {
                          if (selectedServiceForLocation && selectedCountry) {
                            const country = availableLocations.find(l => l.id === selectedCountry);
                            if (country) {
                              addServiceToCart(
                                selectedServiceForLocation,
                                selectedCountry,
                                country.name
                              );
                            }
                          }
                        }}
                        className="w-full mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add to Order
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                    <p className="text-sm text-gray-500">
                      Select a service to choose its location
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Shopping Cart */}
            {formData.serviceItems.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-3">
                  Order Summary ({formData.serviceItems.length} items)
                </h4>
                <div className="space-y-2">
                  {formData.serviceItems.map((item) => (
                    <div key={item.itemId} className="flex items-center justify-between bg-white rounded-md p-2">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{item.serviceName}</span>
                        <span className="text-xs text-gray-500 ml-2">→ {item.locationName}</span>
                      </div>
                      <button
                        onClick={() => removeServiceFromCart(item.itemId)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.services && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{errors.services}</p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Subject Information
            </h3>
            <p className="text-gray-600 mb-6">
              Enter information about the person this order is for. This information will be collected once for the entire order.
            </p>

            {requirements.subjectFields.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No subject information fields required for this order.</p>
                <p className="text-xs text-gray-400 mt-2">
                  Debug: {JSON.stringify(requirements, null, 2)}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {requirements.subjectFields.map((field) => (
                  <div key={field.id} className={field.dataType === 'textarea' ? 'md:col-span-2' : ''}>
                    <DynamicFieldInput
                      field={field}
                      value={subjectFieldValues[field.id]}
                      onChange={(value) => {
                        setSubjectFieldValues(prev => ({
                          ...prev,
                          [field.id]: value
                        }));
                        // Clear error when user updates field
                        if (errors[field.id]) {
                          setErrors(prev => ({
                            ...prev,
                            [field.id]: ''
                          }));
                        }
                      }}
                      error={errors[field.id]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Search Details
            </h3>
            <p className="text-gray-600 mb-6">
              Provide details for each service in your order.
            </p>

            <div className="space-y-6">
              {formData.serviceItems.map((item) => {
                const itemFields = requirements.searchFields.filter(
                  field => field.serviceId === item.serviceId && field.locationId === item.locationId
                );

                return (
                  <div key={item.itemId} className="border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-1">
                      {item.serviceName}
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Country: {item.locationName}
                    </p>

                    {/* Service-specific Fields */}
                    <div>
                      <h5 className="text-md font-medium text-gray-700 mb-3">Search Parameters</h5>
                      {itemFields.length === 0 ? (
                        <div className="text-center py-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-500">No additional search parameters required for this service.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {itemFields.map((field) => (
                            <div key={field.id} className={field.dataType === 'textarea' ? 'md:col-span-2' : ''}>
                              <DynamicFieldInput
                                field={field}
                                value={searchFieldValues[item.itemId]?.[field.id]}
                                onChange={(value) => {
                                  setSearchFieldValues(prev => ({
                                    ...prev,
                                    [item.itemId]: {
                                      ...prev[item.itemId],
                                      [field.id]: value
                                    }
                                  }));
                                  // Clear error when user updates field
                                  const errorKey = `${item.itemId}_${field.id}`;
                                  if (errors[errorKey]) {
                                    setErrors(prev => ({
                                      ...prev,
                                      [errorKey]: ''
                                    }));
                                  }
                                }}
                                error={errors[`${item.itemId}_${field.id}`]}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Documents & Review
            </h3>
            <p className="text-gray-600 mb-6">
              Upload any required documents and review your order before submitting.
            </p>

            {/* Documents Section */}
            {requirements.documents.length > 0 && (
              <div className="mb-8">
                <h4 className="text-md font-medium text-gray-900 mb-4">Required Documents</h4>
                <div className="space-y-4">
                  {requirements.documents.map((document) => (
                    <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900">{document.name}</h5>
                          {document.instructions && (
                            <p className="text-xs text-gray-500 mt-1">{document.instructions}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Scope: {document.scope === 'per_case' ? 'Once per order' : 'Per service'}
                          </p>
                        </div>
                        <div>
                          <input
                            type="file"
                            id={`doc-${document.id}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setUploadedDocuments(prev => ({
                                  ...prev,
                                  [document.id]: file
                                }));
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
                <h5 className="text-sm font-medium text-gray-700 mb-2">Services ({formData.serviceItems.length})</h5>
                <div className="space-y-2">
                  {formData.serviceItems.map((item) => (
                    <div key={item.itemId} className="flex justify-between text-sm">
                      <span>{item.serviceName}</span>
                      <span className="text-gray-500">{item.locationName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject Fields Summary */}
              {requirements.subjectFields.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Subject Information</h5>
                  <div className="space-y-1">
                    {requirements.subjectFields.map((field) => {
                      const value = subjectFieldValues[field.id];
                      if (!value) return null;
                      return (
                        <div key={field.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{field.name}:</span>
                          <span className="font-medium">
                            {Array.isArray(value) ? value.join(', ') : value}
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
                    {requirements.documents.map((document) => {
                      const file = uploadedDocuments[document.id];
                      return (
                        <div key={document.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{document.name}:</span>
                          <span className={file ? 'text-green-600' : 'text-red-600'}>
                            {file ? file.name : 'Not uploaded'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {errors.submit && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-4">Step {step} of 4 • Items in cart: {formData.serviceItems.length}</p>
        </div>

        <div className="mt-4 flex justify-between border-t pt-6">
          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/portal/orders')}
              className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {step > 1 && (
              <button
                onClick={() => setStep(Math.max(1, step - 1))}
                className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
            )}

            {step >= 2 && (
              <button
                onClick={handleSaveAsDraft}
                disabled={isSubmitting || formData.serviceItems.length === 0}
                className="inline-flex items-center rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
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
              console.log('Next button clicked!');
              handleNext();
            }}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>{step === 4 ? 'Submit Order' : 'Next'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}