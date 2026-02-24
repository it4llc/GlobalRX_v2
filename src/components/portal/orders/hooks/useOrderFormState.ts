import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderFormState, OrderFormData, SubjectInfo, AvailableService, AvailableLocation } from '../types';
import { useServiceCart } from './useServiceCart';
import { useOrderRequirements } from './useOrderRequirements';
import { useOrderValidation } from './useOrderValidation';
import clientLogger from '@/lib/client-logger';

/**
 * Central state management hook for the order form
 * Combines all the extracted business logic hooks
 * Extracted from the large order form component
 */
export function useOrderFormState() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get('edit');

  // Basic form state
  const [step, setStep] = useState(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Subject and form data
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo>({
    firstName: '',
    lastName: '',
    middleName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
  });
  const [notes, setNotes] = useState('');

  // Field values state
  const [subjectFieldValues, setSubjectFieldValues] = useState<Record<string, any>>({});
  const [searchFieldValues, setSearchFieldValues] = useState<Record<string, Record<string, any>>>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, File>>({});

  // Service and location selection
  const [selectedServiceForLocation, setSelectedServiceForLocation] = useState<AvailableService | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [availableLocations, setAvailableLocations] = useState<AvailableLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [sublocations, setSublocations] = useState<{[parentId: string]: AvailableLocation[]}>({});

  // Missing requirements dialog state
  const [showMissingRequirementsDialog, setShowMissingRequirementsDialog] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState({
    subjectFields: [],
    searchFields: [],
    documents: []
  });

  // Initialize hooks
  const serviceCart = useServiceCart();
  const requirementsHook = useOrderRequirements();
  const validation = useOrderValidation();

  /**
   * Get current form data in the expected format
   */
  const getFormData = useCallback((): OrderFormData => {
    return {
      serviceItems: serviceCart.serviceItems,
      subject: subjectInfo,
      notes: notes
    };
  }, [serviceCart.serviceItems, subjectInfo, notes]);

  /**
   * Update subject information
   */
  const updateSubject = useCallback((field: keyof SubjectInfo, value: string) => {
    setSubjectInfo(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  }, [errors]);

  /**
   * Clear error for a specific field
   */
  const clearError = useCallback((field: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: '',
    }));
  }, []);

  /**
   * Set multiple errors at once
   */
  const setFormErrors = useCallback((newErrors: Record<string, string>) => {
    setErrors(newErrors);
  }, []);

  /**
   * Check if a step is complete
   */
  const isStepComplete = useCallback((stepNumber: number): boolean => {
    return validation.isStepComplete(
      stepNumber,
      serviceCart.serviceItems,
      requirementsHook.requirements,
      subjectFieldValues,
      searchFieldValues,
      uploadedDocuments,
      step
    );
  }, [validation, serviceCart.serviceItems, requirementsHook.requirements, subjectFieldValues, searchFieldValues, uploadedDocuments, step]);

  /**
   * Check if a step has been started but not completed
   */
  const isStepIncomplete = useCallback((stepNumber: number): boolean => {
    if (step < stepNumber) return false; // Not reached yet
    return step >= stepNumber && !isStepComplete(stepNumber);
  }, [step, isStepComplete]);

  /**
   * Check if a step has been visited/started
   */
  const isStepStarted = useCallback((stepNumber: number): boolean => {
    return step >= stepNumber;
  }, [step]);

  /**
   * Fetch available services for the customer
   */
  const fetchAvailableServices = useCallback(async () => {
    try {
      setLoadingServices(true);
      const response = await fetch('/api/portal/services');
      if (response.ok) {
        const services = await response.json();
        setAvailableServices(services);
      } else {
        clientLogger.error('Failed to fetch services');
        setErrors({ submit: 'Failed to load available services' });
      }
    } catch (error: unknown) {
      clientLogger.error('Error fetching services', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setErrors({ submit: 'Failed to load available services' });
    } finally {
      setLoadingServices(false);
    }
  }, []);

  /**
   * Fetch available locations for a service
   */
  const fetchAvailableLocations = useCallback(async (parentId: string = 'root', serviceId?: string) => {
    try {
      setLoadingLocations(true);
      const params = new URLSearchParams({ parentId });
      if (serviceId) {
        params.append('serviceId', serviceId);
      }
      const response = await fetch(`/api/portal/locations?${params.toString()}`);
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
        clientLogger.error('Failed to fetch locations');
        return [];
      }
    } catch (error: unknown) {
      clientLogger.error('Error fetching locations', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  /**
   * Reset selection state
   */
  const resetSelections = useCallback(() => {
    setSelectedServiceForLocation(null);
    setSelectedCountry('');
  }, []);

  /**
   * Load existing order for editing
   */
  const loadOrderForEdit = useCallback(async (orderId: string) => {
    if (!session?.user?.customerId) return;

    setIsLoadingOrder(true);
    try {
      const response = await fetch(`/api/portal/orders/${orderId}`);
      if (!response.ok) {
        throw new Error('Failed to load order');
      }

      const order = await response.json();

      // Check if order is a draft
      if (order.statusCode !== 'draft') {
        setErrors({ submit: 'Only draft orders can be edited' });
        router.push('/portal/orders');
        return;
      }

      // Set edit mode
      setIsEditMode(true);

      // Populate service items using cart hook
      const serviceItems = order.items.map((item: any) => ({
        serviceId: item.service.id,
        serviceName: item.service.name,
        locationId: item.location.id,
        locationName: item.location.name,
        itemId: `${item.service.id}-${item.location.id}-${Date.now()}`,
      }));

      serviceCart.setCart(serviceItems);

      // Update subject info
      if (order.subject) {
        setSubjectInfo(order.subject);
      }

      // Update notes
      setNotes(order.notes || '');

      // Load field values from order data
      if (order.items && order.items.length > 0) {
        const searchFields: Record<string, Record<string, any>> = {};

        order.items.forEach((item: any, index: number) => {
          const itemId = serviceItems[index].itemId;
          searchFields[itemId] = {};

          if (item.data && item.data.length > 0) {
            item.data.forEach((dataEntry: any) => {
              searchFields[itemId][dataEntry.fieldName] = dataEntry.fieldValue;
            });
          }
        });

        setSearchFieldValues(searchFields);
      }

      // Store the order subject data for later field mapping
      if (order.subject) {
        sessionStorage.setItem(`order_${orderId}_subject`, JSON.stringify(order.subject));
      }

      // Start at step 2 since we already have services selected
      setStep(2);

      // Fetch requirements for the loaded services
      if (serviceItems.length > 0) {
        await requirementsHook.fetchRequirementsForEdit(serviceItems, orderId, (data) => {
          // Map stored subject data to field IDs
          const storedSubject = sessionStorage.getItem(`order_${orderId}_subject`);
          if (storedSubject) {
            const subjectData = JSON.parse(storedSubject);
            const fieldValues: Record<string, any> = {};

            data.subjectFields.forEach((field: any) => {
              // Map field names to stored data
              const fieldNameLower = field.name.toLowerCase();

              if (subjectData[field.name]) {
                fieldValues[field.id] = subjectData[field.name];
              } else if (fieldNameLower.includes('first') && fieldNameLower.includes('name') && subjectData.firstName) {
                fieldValues[field.id] = subjectData.firstName;
              } else if (fieldNameLower.includes('last') && fieldNameLower.includes('name') && subjectData.lastName) {
                fieldValues[field.id] = subjectData.lastName;
              } else if (fieldNameLower.includes('middle') && fieldNameLower.includes('name') && subjectData.middleName) {
                fieldValues[field.id] = subjectData.middleName;
              } else if (fieldNameLower.includes('email') && subjectData.email) {
                fieldValues[field.id] = subjectData.email;
              } else if (fieldNameLower.includes('phone') && subjectData.phone) {
                fieldValues[field.id] = subjectData.phone;
              } else if ((fieldNameLower.includes('birth') || fieldNameLower.includes('dob')) && subjectData.dateOfBirth) {
                fieldValues[field.id] = subjectData.dateOfBirth;
              } else if (fieldNameLower.includes('address') && subjectData.address) {
                fieldValues[field.id] = subjectData.address;
              }
            });

            setSubjectFieldValues(fieldValues);
            sessionStorage.removeItem(`order_${orderId}_subject`);
          }
        });
      }
    } catch (error: unknown) {
      clientLogger.error('Error loading order for edit', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setErrors({ submit: 'Failed to load order for editing' });
    } finally {
      setIsLoadingOrder(false);
    }
  }, [session, router, serviceCart, requirementsHook]);

  /**
   * Initialize form state on mount
   */
  useEffect(() => {
    if (session?.user?.customerId && !editOrderId) {
      fetchAvailableServices();
    }
  }, [session, editOrderId, fetchAvailableServices]);

  /**
   * Load order for editing if edit mode
   */
  useEffect(() => {
    if (editOrderId) {
      loadOrderForEdit(editOrderId);
    }
  }, [editOrderId, loadOrderForEdit]);

  return {
    // State
    step,
    isEditMode,
    isLoadingOrder,
    isSubmitting,
    errors,
    subjectInfo,
    notes,
    subjectFieldValues,
    searchFieldValues,
    uploadedDocuments,
    selectedServiceForLocation,
    selectedCountry,
    availableServices,
    loadingServices,
    availableLocations,
    loadingLocations,
    sublocations,
    showMissingRequirementsDialog,
    missingRequirements,

    // Computed state
    formData: getFormData(),

    // Actions
    setStep,
    setIsSubmitting,
    updateSubject,
    setNotes,
    setSubjectFieldValues,
    setSearchFieldValues,
    setUploadedDocuments,
    setSelectedServiceForLocation,
    setSelectedCountry,
    setShowMissingRequirementsDialog,
    setMissingRequirements,
    clearError,
    setFormErrors,
    resetSelections,
    fetchAvailableServices,
    fetchAvailableLocations,

    // Status checks
    isStepComplete,
    isStepIncomplete,
    isStepStarted,

    // Hooks
    serviceCart,
    requirements: requirementsHook,
    validation
  };
}