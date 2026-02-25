/**
 * useCustomerConfig Hook
 *
 * Encapsulates all business logic for customer configuration management
 * Following the clarified business rules:
 * - Email validation: Optional but must be valid format if provided
 * - Required fields: Only customer name
 * - Data retention: Defaults to "Delete at Global Rule" (null)
 * - Permissions: All data requires view permission
 * - Error handling: Stay in edit mode on failure
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/client-logger';
import { CustomerDetails } from '@/types/customer';

interface FormData {
  name: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  accountType: 'master' | 'subaccount';
  masterAccountId: string;
  billingType: 'independent' | 'through_other';
  billingAccountId: string;
  invoiceTerms: string;
  invoiceContact: string;
  invoiceMethod: string;
  serviceIds: string[];
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  dataRetentionDays: number | null; // null means "Delete at Global Rule"
}

interface UpdateResult {
  success: boolean;
  isInEditMode: boolean;
  error: string | null;
  failingField?: string;
}

interface LogoValidation {
  isValid: boolean;
  error: string | null;
}

// Logo file requirements (best practices)
const LOGO_REQUIREMENTS = {
  maxSize: 5 * 1024 * 1024, // 5MB
  acceptedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'],
  acceptedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg'],
  displayFormats: 'JPG, PNG, GIF, SVG',
};

export function useCustomerConfig(customerId: string | null) {
  const { fetchWithAuth, checkPermission } = useAuth();

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    accountType: 'master',
    masterAccountId: '',
    billingType: 'independent',
    billingAccountId: '',
    invoiceTerms: '',
    invoiceContact: '',
    invoiceMethod: '',
    serviceIds: [],
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    dataRetentionDays: null, // Default to "Delete at Global Rule"
  });

  // Permission checks
  const canView = checkPermission('customers', 'view');
  const canEdit = checkPermission('customers', 'edit');

  // Email validation - empty is OK, but if provided must be valid format
  const validateEmail = useCallback((email: string | null | undefined): boolean => {
    // Empty/null/undefined emails are valid
    if (!email || email.trim() === '') return true;

    // Basic email format validation (no domain verification)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Form validation based on business rules
  const validateForm = useCallback((data: Partial<FormData>, currentCustomerId: string): string | null => {
    // Only customer name is required
    if (!data.name || !data.name.trim()) {
      return 'Customer name is required';
    }

    // Validate email format if provided
    if (data.contactEmail && !validateEmail(data.contactEmail)) {
      return 'Invalid email format';
    }

    // Prevent circular references
    if (data.accountType === 'subaccount' && data.masterAccountId === currentCustomerId) {
      return 'A customer cannot be its own master account';
    }

    if (data.billingType === 'through_other' && data.billingAccountId === currentCustomerId) {
      return 'A customer cannot be its own billing account';
    }

    return null;
  }, [validateEmail]);

  // Validate logo file based on best practices
  const validateLogoFile = useCallback((file: File): LogoValidation => {
    // Check file type
    if (!LOGO_REQUIREMENTS.acceptedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Logo must be in one of the supported formats: ${LOGO_REQUIREMENTS.displayFormats}`,
      };
    }

    // Check file size
    if (file.size > LOGO_REQUIREMENTS.maxSize) {
      return {
        isValid: false,
        error: `Logo file size must be less than 5MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      };
    }

    return {
      isValid: true,
      error: null,
    };
  }, []);

  // Load customer data
  useEffect(() => {
    const loadCustomer = async () => {
      // No customer data visible without permission
      if (!canView) {
        setError('You do not have permission to view customer details');
        setIsLoading(false);
        return;
      }

      if (!customerId) {
        // New customer scenario
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetchWithAuth(`/api/customers/${customerId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Customer not found');
          }
          throw new Error('Failed to fetch customer information');
        }

        const data = await response.json();
        setCustomer(data);

        // Initialize form data with proper defaults
        setFormData({
          name: data.name || '',
          address: data.address || '',
          contactName: data.contactName || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          accountType: data.masterAccountId ? 'subaccount' : 'master',
          masterAccountId: data.masterAccountId || '',
          billingType: data.billingAccountId ? 'through_other' : 'independent',
          billingAccountId: data.billingAccountId || '',
          invoiceTerms: data.invoiceTerms || '',
          invoiceContact: data.invoiceContact || '',
          invoiceMethod: data.invoiceMethod || '',
          serviceIds: data.serviceIds || [],
          logoUrl: data.logoUrl || '',
          primaryColor: data.primaryColor || '',
          secondaryColor: data.secondaryColor || '',
          accentColor: data.accentColor || '',
          // Default to null (Delete at Global Rule) if not specified
          dataRetentionDays: data.dataRetentionDays === undefined ? null : data.dataRetentionDays,
        });
      } catch (err) {
        logger.error('Error fetching customer info', { error: err });
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomer();
  }, [customerId, fetchWithAuth, canView]);

  // Upload logo with clear error messages
  const uploadLogo = useCallback(async (customerId: string, file: File): Promise<string | null> => {
    logger.debug('Uploading logo', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    const formData = new FormData();
    formData.append('logo', file, file.name);

    try {
      const response = await fetch(`/api/customers/${customerId}/upload-logo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Error parsing response', { error: parseError });
        throw new Error(`Failed to parse server response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        logger.error('Logo upload failed', { result });
        throw new Error(`Failed to upload logo: ${result.error || response.statusText}`);
      }

      logger.debug('Logo upload successful', { result });
      return result.logoUrl || null;
    } catch (err) {
      logger.error('Error in logo upload', { error: err });
      throw err;
    }
  }, []);

  // Update customer with different behavior for create vs update
  const updateCustomer = useCallback(async (
    data: FormData,
    logoFile: File | null,
    isCreate: boolean
  ): Promise<UpdateResult> => {
    // Validate form first
    const validationError = validateForm(data, customerId || 'new');
    if (validationError) {
      return {
        success: false,
        isInEditMode: true,
        error: validationError,
      };
    }

    // Validate logo if provided
    if (logoFile) {
      const logoValidation = validateLogoFile(logoFile);
      if (!logoValidation.isValid) {
        return {
          success: false,
          isInEditMode: true,
          error: logoValidation.error,
        };
      }
    }

    try {
      // For UPDATE mode: Upload logo first, fail if it fails
      if (!isCreate && logoFile && customerId) {
        try {
          await uploadLogo(customerId, logoFile);
        } catch (logoErr) {
          return {
            success: false,
            isInEditMode: true, // Stay in edit mode
            error: `Logo upload failed: ${logoErr instanceof Error ? logoErr.message : 'Unknown error'}`,
          };
        }
      }

      // Transform form data to API format
      const customerData = {
        name: data.name,
        address: data.address,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        masterAccountId: data.accountType === 'subaccount' ? data.masterAccountId : null,
        billingAccountId: data.billingType === 'through_other' ? data.billingAccountId : null,
        invoiceTerms: data.invoiceTerms,
        invoiceContact: data.invoiceContact,
        invoiceMethod: data.invoiceMethod,
        serviceIds: data.serviceIds,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        dataRetentionDays: data.dataRetentionDays, // null means "Delete at Global Rule"
      };

      // Save customer data
      const endpoint = isCreate ? '/api/customers' : `/api/customers/${customerId}`;
      const method = isCreate ? 'POST' : 'PUT';

      const response = await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          isInEditMode: true, // Stay in edit mode
          error: errorData.error || 'Failed to save customer',
          failingField: errorData.field, // Highlight failing field if provided
        };
      }

      const updatedData = await response.json();
      setCustomer(updatedData);

      // For CREATE mode: Try to upload logo after customer is created, but don't fail
      if (isCreate && logoFile && updatedData.id) {
        try {
          const logoUrl = await uploadLogo(updatedData.id, logoFile);
          if (logoUrl) {
            setCustomer(prev => prev ? { ...prev, logoUrl } : null);
          }
        } catch (logoErr) {
          // For create, save succeeded but logo failed - show warning but exit edit mode
          return {
            success: true,
            isInEditMode: false, // Exit edit mode
            error: `Customer saved, but logo upload failed: ${logoErr instanceof Error ? logoErr.message : 'Unknown error'}`,
          };
        }
      }

      return {
        success: true,
        isInEditMode: false, // Exit edit mode on success
        error: null,
      };
    } catch (err) {
      logger.error('Error updating customer', { error: err });
      return {
        success: false,
        isInEditMode: true, // Stay in edit mode
        error: err instanceof Error ? err.message : 'An unknown error occurred',
      };
    }
  }, [customerId, fetchWithAuth, uploadLogo, validateForm, validateLogoFile]);

  return {
    // Data
    customer,
    formData,
    isLoading,
    error,

    // Permissions
    canView,
    canEdit,

    // Actions
    setFormData,
    setError,
    updateCustomer,
    uploadLogo,

    // Validation
    validateEmail,
    validateForm,
    validateLogoFile,
  };
}