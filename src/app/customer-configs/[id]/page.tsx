'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logger from '@/lib/client-logger';

// Import modular section components
import { BasicInformationSection } from '@/components/customer-configs/basic-information-section';
import { AccountRelationshipsSection } from '@/components/customer-configs/account-relationships-section';
import { BrandingSection } from '@/components/customer-configs/branding-section';
import { ServicesSection } from '@/components/customer-configs/services-section';

// Import types
import { CustomerDetails } from '@/types/customer';

// Form data interface with proper typing
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
  dataRetentionDays: number;
}

export default function CustomerConfigsPage() {
  const { id } = useParams();
  const { fetchWithAuth, checkPermission } = useAuth();
  const { t } = useTranslation();

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
    dataRetentionDays: 0
  });

  // Permission checks
  const canView = checkPermission('customers', 'view');
  const canEdit = checkPermission('customers', 'edit');

  // Validation functions
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Empty email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Customer name is required';
    }

    if (formData.contactEmail && !validateEmail(formData.contactEmail)) {
      return 'Invalid email format';
    }

    // Prevent circular references
    if (formData.accountType === 'subaccount' && formData.masterAccountId === id) {
      return 'A customer cannot be its own master account';
    }

    if (formData.billingType === 'through_other' && formData.billingAccountId === id) {
      return 'A customer cannot be its own billing account';
    }

    return null;
  };

  // Data loading
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      if (!canView) {
        setError('You do not have permission to view customer details');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetchWithAuth(`/api/customers/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Customer not found');
          }
          throw new Error('Failed to fetch customer information');
        }

        const data = await response.json();
        setCustomer(data);

        // Initialize form data
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
          dataRetentionDays: data.dataRetentionDays || 0
        });
      } catch (err) {
        logger.error('Error fetching customer info', { error: err });
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchCustomerInfo();
    }
  }, [id, fetchWithAuth, canView]);

  // Form handling
  const handleInputChange = (field: string, value: string | string[] | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  const uploadLogo = async (customerId: string, file: File) => {
    logger.debug('Uploading logo', { fileName: file.name, fileType: file.type, fileSize: file.size });

    const formDataForUpload = new FormData();
    formDataForUpload.append('logo', file, file.name);

    try {
      const response = await fetch(`/api/customers/${customerId}/upload-logo`, {
        method: 'POST',
        body: formDataForUpload,
        credentials: 'include'
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
      return result;
    } catch (err) {
      logger.error('Error in logo upload', { error: err });
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (!customer) return;

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Transform form data to API format
      const customerData = {
        name: formData.name,
        address: formData.address,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        masterAccountId: formData.accountType === 'subaccount' ? formData.masterAccountId : null,
        billingAccountId: formData.billingType === 'through_other' ? formData.billingAccountId : null,
        invoiceTerms: formData.invoiceTerms,
        invoiceContact: formData.invoiceContact,
        invoiceMethod: formData.invoiceMethod,
        serviceIds: formData.serviceIds,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        accentColor: formData.accentColor,
        dataRetentionDays: formData.dataRetentionDays === 0 ? null : formData.dataRetentionDays
      };

      // Update customer
      const response = await fetchWithAuth(`/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }

      const updatedData = await response.json();
      setCustomer(updatedData);

      // Upload logo if one was selected
      if (logoFile) {
        try {
          logger.debug('Logo file selected, attempting upload...');
          const uploadResult = await uploadLogo(id as string, logoFile);

          if (uploadResult && uploadResult.logoUrl) {
            setCustomer(prev => prev ? {
              ...prev,
              logoUrl: uploadResult.logoUrl
            } : null);
          }
        } catch (logoErr) {
          logger.error('Error uploading logo', { error: logoErr });
          setError(`Customer saved, but logo upload failed: ${logoErr instanceof Error ? logoErr.message : 'Unknown error'}`);
        }
      }

      // Exit edit mode only on success
      setIsEditMode(false);
      setLogoFile(null);
    } catch (err) {
      logger.error('Error updating customer', { error: err });
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      // Don't exit edit mode on error - let user see error and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        address: customer.address || '',
        contactName: customer.contactName || '',
        contactEmail: customer.contactEmail || '',
        contactPhone: customer.contactPhone || '',
        accountType: customer.masterAccountId ? 'subaccount' : 'master',
        masterAccountId: customer.masterAccountId || '',
        billingType: customer.billingAccountId ? 'through_other' : 'independent',
        billingAccountId: customer.billingAccountId || '',
        invoiceTerms: customer.invoiceTerms || '',
        invoiceContact: customer.invoiceContact || '',
        invoiceMethod: customer.invoiceMethod || '',
        serviceIds: customer.serviceIds || [],
        logoUrl: customer.logoUrl || '',
        primaryColor: customer.primaryColor || '',
        secondaryColor: customer.secondaryColor || '',
        accentColor: customer.accentColor || '',
        dataRetentionDays: customer.dataRetentionDays || 0
      });
    }

    setLogoFile(null);
    setIsEditMode(false);
    setError(null);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator data-testid="loading-indicator" />
      </div>
    );
  }

  // Render permission denied
  if (!canView) {
    return (
      <AlertBox
        type="error"
        title="Forbidden"
        message="You do not have permission to view customer details."
      />
    );
  }

  // Render error state
  if (error && !customer) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Customer"
        message={error}
        action={
          <Button onClick={() => window.location.reload()}>Retry</Button>
        }
      />
    );
  }

  // Render customer not found
  if (!customer) {
    return (
      <AlertBox
        type="warning"
        title="Customer Not Found"
        message="This customer does not exist or you don't have permission to view it."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {t('module.customerConfig.customerDetails')}
        </h2>

        <div className="flex space-x-3">
          {!isEditMode && canEdit && (
            <Button onClick={() => setIsEditMode(true)}>
              {t('module.customerConfig.editCustomer')}
            </Button>
          )}

          {isEditMode && (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <AlertBox
          type="error"
          title="Error"
          message={error}
          className="mb-6"
        />
      )}

      <div className="space-y-8">
        <BasicInformationSection
          customer={customer}
          isEditMode={isEditMode}
          formData={{
            name: formData.name,
            address: formData.address,
            contactName: formData.contactName,
            contactEmail: formData.contactEmail,
            contactPhone: formData.contactPhone,
          }}
          onInputChange={handleInputChange}
        />

        <AccountRelationshipsSection
          customer={customer}
          isEditMode={isEditMode}
          formData={{
            accountType: formData.accountType,
            masterAccountId: formData.masterAccountId,
            billingType: formData.billingType,
            billingAccountId: formData.billingAccountId,
          }}
          onInputChange={handleInputChange}
          customerId={typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''}
        />

        <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
            <h3 className="text-sm font-semibold text-gray-900">Invoice Details</h3>
          </div>

          <div className="divide-y divide-gray-200">
            <div className="px-6 py-3 flex justify-between">
              <span className="text-sm font-medium text-gray-900 w-48">Invoice Terms</span>
              <div className="flex-1">
                {isEditMode ? (
                  <Input
                    value={formData.invoiceTerms}
                    onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                    placeholder="Enter invoice terms"
                    className="w-full"
                  />
                ) : (
                  <span className="text-sm text-gray-500">{customer.invoiceTerms || 'Not specified'}</span>
                )}
              </div>
            </div>

            <div className="px-6 py-3 flex justify-between">
              <span className="text-sm font-medium text-gray-900 w-48">Invoice Contact</span>
              <div className="flex-1">
                {isEditMode ? (
                  <Input
                    value={formData.invoiceContact}
                    onChange={(e) => handleInputChange('invoiceContact', e.target.value)}
                    placeholder="Enter invoice contact"
                    className="w-full"
                  />
                ) : (
                  <span className="text-sm text-gray-500">{customer.invoiceContact || 'Not specified'}</span>
                )}
              </div>
            </div>

            <div className="px-6 py-3 flex justify-between">
              <span className="text-sm font-medium text-gray-900 w-48">Invoice Method</span>
              <div className="flex-1">
                {isEditMode ? (
                  <Input
                    value={formData.invoiceMethod}
                    onChange={(e) => handleInputChange('invoiceMethod', e.target.value)}
                    placeholder="Enter invoice delivery method"
                    className="w-full"
                  />
                ) : (
                  <span className="text-sm text-gray-500">{customer.invoiceMethod || 'Not specified'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <BrandingSection
          customer={customer}
          isEditMode={isEditMode}
          formData={{
            logoUrl: formData.logoUrl,
            primaryColor: formData.primaryColor,
            secondaryColor: formData.secondaryColor,
            accentColor: formData.accentColor,
          }}
          onInputChange={handleInputChange}
          onLogoChange={handleLogoChange}
        />

        <ServicesSection
          customer={customer}
          isEditMode={isEditMode}
          formData={{
            serviceIds: formData.serviceIds,
            dataRetentionDays: formData.dataRetentionDays,
          }}
          onInputChange={handleInputChange}
        />
      </div>
    </div>
  );
}