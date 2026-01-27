'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const [selectedSubregions, setSelectedSubregions] = useState<{[level: number]: string}>({});
  const [sublocations, setSublocations] = useState<{[parentId: string]: AvailableLocation[]}>({});

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
    setSelectedSubregions({});

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

  // Validate step 3 (subject information)
  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.subject.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (formData.subject.email && !/\S+@\S+\.\S+/.test(formData.subject.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next button
  const handleNext = () => {
    console.log('handleNext called, current step:', step);
    console.log('formData.serviceItems:', formData.serviceItems);

    if (step === 1 && !validateStep1()) {
      console.log('Step 1 validation failed');
      return;
    }
    if (step === 2 && !validateStep3()) {  // Step 2 is now subject info
      console.log('Step 2 validation failed');
      return;
    }

    if (step === 3) {  // Step 3 is now review & submit
      handleSubmitOrder();
      return;
    }

    const nextStep = Math.min(3, step + 1);
    console.log('Moving to next step:', nextStep);
    setStep(nextStep);
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
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Services & Locations</span>
          </div>
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 2 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Subject Information</span>
          </div>
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`rounded-full h-8 w-8 flex items-center justify-center border-2 ${step >= 3 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Review & Submit</span>
          </div>
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
                            setSelectedSubregions({});
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
                          setSelectedSubregions({});

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
              Enter information about the person this order is for.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.subject.firstName}
                  onChange={(e) => updateSubject('firstName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue ${
                    errors.firstName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter first name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.subject.lastName}
                  onChange={(e) => updateSubject('lastName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue ${
                    errors.lastName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  id="middleName"
                  name="middleName"
                  value={formData.subject.middleName}
                  onChange={(e) => updateSubject('middleName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue"
                  placeholder="Enter middle name (optional)"
                />
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.subject.dateOfBirth}
                  onChange={(e) => updateSubject('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.subject.email}
                  onChange={(e) => updateSubject('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.subject.phone}
                  onChange={(e) => updateSubject('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={formData.subject.address}
                  onChange={(e) => updateSubject('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue"
                  placeholder="Enter full address"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Review & Submit
            </h3>
            <p className="text-gray-600">
              Review your order before submitting.
            </p>
            {/* Order review will be added here */}
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
          <p className="text-xs text-gray-500 mb-4">Step {step} of 3 • Items in cart: {formData.serviceItems.length}</p>
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
              <>{step === 3 ? 'Submit Order' : 'Next'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}