// /GlobalRx_v2/src/components/portal/orders/hooks/useOrderFormState.ts

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/contexts/TranslationContext';
import { OrderFormState, OrderFormData, SubjectInfo, AvailableService, AvailableLocation } from '../types';
import { useServiceCart } from './useServiceCart';
import { useOrderRequirements } from './useOrderRequirements';
import { useOrderValidation } from './useOrderValidation';
import clientLogger from '@/lib/client-logger';

// Type definitions for order data from API
interface OrderService {
  id: string;
  name: string;
  category?: string;
}

interface OrderLocation {
  id: string;
  name: string;
}

interface OrderDataEntry {
  fieldName: string;
  fieldValue: string;
  fieldType?: string;
}

interface OrderItem {
  id: string;
  service: OrderService;
  location: OrderLocation;
  data?: OrderDataEntry[];
}

interface OrderSubjectField {
  id: string;
  name: string;
  fieldKey: string;
  displayName?: string;
  dataType?: string;
  required?: boolean;
}

interface OrderSearchField {
  id: string;
  name: string;
  fieldKey: string;
  dataType?: string;
  required?: boolean;
  serviceId?: string;
  locationId?: string;
}

/**
 * Central state management hook for the order form
 * Combines all the extracted business logic hooks
 * Extracted from the large order form component
 */
export function useOrderFormState() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
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
  const [subjectFieldValues, setSubjectFieldValues] = useState<Record<string, string | number | boolean | object>>({});
  const [searchFieldValues, setSearchFieldValues] = useState<Record<string, Record<string, string | number | boolean | object>>>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, {
    fileName: string;
    filePath: string;
    fileSize: number;
    documentId?: string;
    filename?: string;
    originalName?: string;
    storagePath?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
    uploadedBy?: string;
  }>>({});

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
        const data = await response.json();
        setAvailableServices(data.services || data);
      } else {
        clientLogger.error('Failed to fetch services');
        setErrors({ submit: t('error.failedToLoadServices') });
      }
    } catch (error: unknown) {
      clientLogger.error('Error fetching services', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setErrors({ submit: t('error.failedToLoadServices') });
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
   *
   * Handles the complex process of loading a draft order and restoring all field values,
   * including proper parsing of address block fields from JSON strings back to objects.
   *
   * Address Block Bug Fix:
   * - Search-level address blocks: Parsed from JSON strings in field remapping callback
   * - Subject-level address blocks: Parsed from JSON strings stored in order_data
   * - Both types maintain structure (street1, city, etc. as separate properties)
   *
   * @param orderId - The ID of the order to load for editing
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
        setErrors({ submit: t('error.onlyDraftOrdersCanBeEdited') });
        router.push('/portal/orders');
        return;
      }

      // Set edit mode
      setIsEditMode(true);

      // Populate service items using cart hook
      const serviceItems = order.items.map((item: OrderItem) => ({
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

      // Load field values from order data - store temporarily for remapping
      let searchFieldsByName: Record<string, Record<string, any>> = {};
      let documentMetadata: Record<string, any> = {};
      let subjectFieldsById: Record<string, any> = {};

      if (order.items && order.items.length > 0) {
        order.items.forEach((item: OrderItem, index: number) => {
          const itemId = serviceItems[index].itemId;
          searchFieldsByName[itemId] = {};

          if (item.data && item.data.length > 0) {
            item.data.forEach((dataEntry: OrderDataEntry) => {
              // BUG FIX: Separate document data from search field data when loading drafts
              // CONTEXT: Documents are now stored as order_data entries with fieldType='document'
              // containing JSON-serialized metadata (not File objects which can't be serialized)
              if (dataEntry.fieldType === 'document') {
                // Parse document metadata from JSON
                try {
                  const metadata = JSON.parse(dataEntry.fieldValue);
                  documentMetadata[dataEntry.fieldName] = metadata;
                } catch (error) {
                  clientLogger.warn('Failed to parse document metadata', {
                    fieldName: dataEntry.fieldName,
                    fieldValue: dataEntry.fieldValue,
                  });
                }
              } else {
                // Regular search field data
                // Check if this is a subject field (stored with fieldType: 'subject')
                if (dataEntry.fieldType === 'subject') {
                  // Subject fields are order-level, not item-specific
                  // fieldName is the field UUID, fieldValue may need JSON parsing for address blocks
                  subjectFieldsById[dataEntry.fieldName] = dataEntry.fieldValue;
                } else {
                  // Search fields are item-specific
                  searchFieldsByName[itemId][dataEntry.fieldName] = dataEntry.fieldValue;
                }
              }
            });
          }
        });

        // BUG FIX: Don't set searchFieldValues here - they will be set after remapping to field IDs in the callback
        // ISSUE: Form expects field values keyed by UUID (field.id) but draft data comes with field names as keys
        // This caused DSX field values to not appear when editing draft orders
        // SOLUTION: Store field data temporarily and remap field names -> field IDs after requirements load
      }

      // BUG FIX: Load document metadata into state for display when editing drafts
      // CONTEXT: Documents are uploaded immediately when selected and their metadata
      // is stored in order_data. When editing a draft, this metadata is loaded back
      // into component state so uploaded documents appear in the UI.
      if (Object.keys(documentMetadata).length > 0) {
        setUploadedDocuments(documentMetadata);
      }

      // Store the order subject data for later field mapping
      // Merge basic subject data with any subject field data from order_data
      if (order.subject || Object.keys(subjectFieldsById).length > 0) {
        const mergedSubjectData = {
          ...order.subject,
          ...subjectFieldsById // Subject fields from order_data take precedence (they're not flattened)
        };
        sessionStorage.setItem(`order_${orderId}_subject`, JSON.stringify(mergedSubjectData));
      }

      // Store the search field values for later remapping
      if (Object.keys(searchFieldsByName).length > 0) {
        sessionStorage.setItem(`order_${orderId}_searchFields`, JSON.stringify(searchFieldsByName));
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

            data.subjectFields.forEach((field: OrderSubjectField) => {
              // Map field names to stored data
              const fieldNameLower = field.name.toLowerCase();
              let fieldValue: string | Record<string, any> | undefined = undefined;

              // FIRST: Check if we have a value stored by field UUID (from order_data)
              // This takes highest priority as it preserves structured data
              if (subjectData[field.id]) {
                fieldValue = subjectData[field.id];
              }
              // Then try to get the field value based on field name mapping
              else if (subjectData[field.name]) {
                fieldValue = subjectData[field.name];
              } else if (fieldNameLower.includes('first') && fieldNameLower.includes('name') && subjectData.firstName) {
                fieldValue = subjectData.firstName;
              } else if (fieldNameLower.includes('last') && fieldNameLower.includes('name') && subjectData.lastName) {
                fieldValue = subjectData.lastName;
              } else if (fieldNameLower.includes('middle') && fieldNameLower.includes('name') && subjectData.middleName) {
                fieldValue = subjectData.middleName;
              } else if (fieldNameLower.includes('email') && subjectData.email) {
                fieldValue = subjectData.email;
              } else if (fieldNameLower.includes('phone') && subjectData.phone) {
                fieldValue = subjectData.phone;
              } else if ((fieldNameLower.includes('birth') || fieldNameLower.includes('dob')) && subjectData.dateOfBirth) {
                fieldValue = subjectData.dateOfBirth;
              } else if (fieldNameLower.includes('address')) {
                // For address fields, check if there's a matching field in subjectData
                // First try exact match with field name
                if (subjectData[field.name]) {
                  fieldValue = subjectData[field.name];
                }
                // Then try the generic 'address' property
                else if (subjectData.address) {
                  fieldValue = subjectData.address;
                }
              }

              // Process the field value - handle null and parse JSON for address_block fields
              if (fieldValue !== undefined) {
                let processedValue = fieldValue;

                // Handle null values - convert to undefined for consistency
                if (fieldValue === null) {
                  processedValue = undefined;
                }
                // Address Block JSON Parsing Fix:
                // Address block fields are stored as JSON strings in the database but need
                // to be objects for the AddressBlockInput component to display them properly.
                // This parsing ensures fields like {street1: "123 Main", city: "Boston"}
                // are restored as objects instead of strings.
                else if (field.dataType === 'address_block') {
                  // Only parse if it's a string that looks like JSON
                  if (typeof fieldValue === 'string' && fieldValue.startsWith('{') && fieldValue.endsWith('}')) {
                    try {
                      processedValue = JSON.parse(fieldValue);
                    } catch {
                      // If parsing fails, keep original value (graceful degradation)
                      processedValue = fieldValue;
                    }
                  }
                }
                // For fields without explicit dataType, check if value looks like JSON and try to parse
                // This handles backward compatibility for fields where dataType isn't specified
                else if (!field.dataType && typeof fieldValue === 'string' &&
                         fieldValue.startsWith('{') && fieldValue.endsWith('}')) {
                  try {
                    processedValue = JSON.parse(fieldValue);
                  } catch {
                    // If parsing fails, keep original value
                    processedValue = fieldValue;
                  }
                }

                fieldValues[field.id] = processedValue;
              }
            });

            setSubjectFieldValues(fieldValues);
            sessionStorage.removeItem(`order_${orderId}_subject`);
          }

          // Remap search field values from field names to field IDs
          // This fixes the bug where DSX field values don't appear when editing draft orders
          const storedSearchFields = sessionStorage.getItem(`order_${orderId}_searchFields`);
          if (data.searchFields && data.searchFields.length > 0 && storedSearchFields) {
            const searchFieldsByName = JSON.parse(storedSearchFields);
            const remappedSearchFieldValues: Record<string, Record<string, any>> = {};

            // For each item in the cart
            Object.keys(searchFieldsByName).forEach((itemId) => {
              remappedSearchFieldValues[itemId] = {};
              const itemFieldValues = searchFieldsByName[itemId];

              // For each field name/value pair in that item
              Object.entries(itemFieldValues).forEach(([fieldName, fieldValue]) => {
                // Find the matching field in data.searchFields where field.name === fieldName
                const matchingField = data.searchFields.find((field: OrderSearchField) => field.name === fieldName);

                if (matchingField) {
                  // Check if this is an address_block field that needs JSON parsing
                  let processedValue = fieldValue;

                  // Handle null values - convert to undefined for consistency
                  if (fieldValue === null) {
                    processedValue = undefined;
                  }
                  // Address Block JSON Parsing Fix (Search Fields):
                  // Same logic as subject fields - parse JSON strings back to objects
                  // for proper display in AddressBlockInput components
                  else if (matchingField.dataType === 'address_block') {
                    // Only parse if it's a string that looks like JSON
                    if (typeof fieldValue === 'string' && fieldValue.startsWith('{') && fieldValue.endsWith('}')) {
                      try {
                        processedValue = JSON.parse(fieldValue);
                      } catch {
                        // If parsing fails, keep original value (graceful degradation)
                        processedValue = fieldValue;
                      }
                    }
                  }
                  // For fields without explicit dataType, check if value looks like JSON and try to parse
                  // This handles backward compatibility for fields where dataType isn't specified
                  else if (!matchingField.dataType && typeof fieldValue === 'string' &&
                           fieldValue.startsWith('{') && fieldValue.endsWith('}')) {
                    try {
                      processedValue = JSON.parse(fieldValue);
                    } catch {
                      // If parsing fails, keep original value
                      processedValue = fieldValue;
                    }
                  }

                  // Use field.id as the key in the new object
                  remappedSearchFieldValues[itemId][matchingField.id] = processedValue;
                }
                // If no matching field is found, the value is ignored (doesn't exist in requirements)
              });
            });

            // Update the search field values with the remapped object
            setSearchFieldValues(remappedSearchFieldValues);
            sessionStorage.removeItem(`order_${orderId}_searchFields`);
          }
        });
      }
    } catch (error: unknown) {
      clientLogger.error('Error loading order for edit', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setErrors({ submit: t('error.failedToLoadOrder') });
    } finally {
      setIsLoadingOrder(false);
    }
  }, [session, router]);  // BUG FIX: Removed serviceCart and requirementsHook from dependencies to prevent infinite loop
  // The functions we use (serviceCart.setCart and requirementsHook.fetchRequirementsForEdit) are already
  // memoized with empty dependency arrays in their respective hooks (useServiceCart and useOrderRequirements),
  // making them stable references that don't change across renders

  /**
   * Initialize form state on mount
   */
  useEffect(() => {
    // BUG FIX: Always load services when customer session exists, regardless of edit mode
    // Previous bug: Services wouldn't load when editing draft orders because of the
    // !editOrderId condition, causing the services dropdown to be empty during editing.
    // Fix: Removed !editOrderId condition - services are needed in both create and edit modes.
    if (session?.user?.customerId) {
      fetchAvailableServices();
    }
  }, [session, fetchAvailableServices]);

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
    currentStep: step, // Alias for backward compatibility
    isEditMode,
    isLoadingOrder,
    loading: isLoadingOrder, // Alias for backward compatibility
    isSubmitting,
    errors,
    error: errors.submit || errors.general, // Alias for backward compatibility
    subjectInfo,
    notes,
    subjectFieldValues,
    searchFieldValues,
    uploadedDocuments,
    selectedServiceForLocation,
    selectedCountry,
    availableServices,
    loadingServices,
    servicesLoading: loadingServices, // Alias for backward compatibility
    availableLocations,
    loadingLocations,
    sublocations,
    showMissingRequirementsDialog,
    missingRequirements,
    editOrderId, // Expose the edit order ID

    // Computed state
    formData: getFormData(),

    // Actions
    setStep,
    setCurrentStep: setStep, // Alias for backward compatibility
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