'use client';
// src/components/modules/customer/customer-dialog.tsx
import clientLogger from '@/lib/client-logger';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Radio } from '@/components/ui/radio';
import { RadioGroup } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CustomerSelect } from './customer-select';
import { ServiceSelection } from './service-selection';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

// Form validation schema
const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  address: z.string().optional().nullish(),
  contactName: z.string().optional().nullish(),
  contactEmail: z.string().email("Invalid email address").optional().nullish(),
  contactPhone: z.string().optional().nullish(),
  accountType: z.enum(['master', 'subaccount']),
  masterAccountId: z.union([z.string().uuid(), z.literal('')]).optional(),
  billingType: z.enum(['independent', 'through_other']),
  billingAccountId: z.union([z.string().uuid(), z.literal('')]).optional(),
  invoiceTerms: z.string().optional().nullish(),
  invoiceContact: z.string().optional().nullish(),
  invoiceMethod: z.string().optional().nullish(),
  serviceIds: z.array(z.string().uuid()).default([])
})
// Add conditional validation
.refine(
  (data) => data.accountType !== 'subaccount' || (data.masterAccountId && data.masterAccountId.length > 0),
  {
    message: "Master account is required for subaccounts",
    path: ["masterAccountId"],
  }
)
.refine(
  (data) => data.billingType !== 'through_other' || (data.billingAccountId && data.billingAccountId.length > 0),
  {
    message: "Billing account is required when billing through another account",
    path: ["billingAccountId"],
  }
);

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerDialogProps {
  customerId: string | null; // null means adding a new customer
  onClose: (refreshData: boolean) => void;
}

export function CustomerDialog({ customerId, onClose }: CustomerDialogProps) {
  const dialogRef = useRef<DialogRef>(null);
  const { fetchWithAuth } = useAuth();
  
  const [isLoading, setIsLoading] = useState(!!customerId);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create form state for controlled inputs
  const [formInputs, setFormInputs] = useState({
    name: '',
    address: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    accountType: 'master' as 'master' | 'subaccount',
    masterAccountId: '',
    billingType: 'independent' as 'independent' | 'through_other',
    billingAccountId: '',
    invoiceTerms: '',
    invoiceContact: '',
    invoiceMethod: '',
    serviceIds: [] as string[]
  });
  
  // Initialize the form
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    trigger
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: formInputs
  });
  
  // Update form validation when inputs change
  useEffect(() => {
    // Set React Hook Form values to match our local state
    Object.entries(formInputs).forEach(([key, value]) => {
      setValue(key as keyof CustomerFormValues, value as any);
    });
    
    // Trigger validation
    trigger();
    
    // Debug validation state without including in dependencies
    clientLogger.info("Form validation state:", {
      isValid,
      errors,
      formValues: formInputs
    });
  }, [formInputs, setValue, trigger]);
  
  // Show the dialog when the component mounts
  useEffect(() => {
    // Ensure the dialog opens when the component mounts
    if (dialogRef.current) {
      setTimeout(() => {
        dialogRef.current?.showModal();
      }, 100);
    }
  }, []);
  
  // Load customer data if editing
  useEffect(() => {
    if (customerId) {
      const fetchCustomer = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          const response = await fetchWithAuth(`/api/customers/${customerId}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch customer details');
          }
          
          const data = await response.json();
          
          // Map the received data to the form inputs using state
          const updatedInputs = {
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
            serviceIds: data.serviceIds || []
          };
          
          setFormInputs(updatedInputs);
          
        } catch (err) {
          clientLogger.error('Error fetching customer:', err);
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchCustomer();
    }
  }, [customerId, fetchWithAuth]);
  
  // Handle closing the dialog properly
  const handleCloseDialog = (refresh: boolean) => {
    // Make sure the dialog is closed
    if (dialogRef.current) {
      dialogRef.current.close();
    }
    
    // Wait a moment before executing onClose callback
    setTimeout(() => {
      onClose(refresh);
    }, 100);
  };
  
  // Handle form submission
  const onSubmit = async (data: CustomerFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
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
        serviceIds: data.serviceIds || []
      };
      
      // Determine if we're creating or updating
      const method = customerId ? 'PUT' : 'POST';
      const url = customerId ? `/api/customers/${customerId}` : '/api/customers';
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(customerData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${customerId ? 'update' : 'create'} customer`);
      }
      
      // Close the dialog and refresh data
      handleCloseDialog(true);
    } catch (err) {
      clientLogger.error(`Error ${customerId ? 'updating' : 'creating'} customer:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle input changes
  const handleInputChange = (field: keyof typeof formInputs, value: any) => {
    setFormInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <ModalDialog
      ref={dialogRef}
      title={customerId ? 'Edit Customer' : 'Add Customer'}
      maxWidth="2xl"
      onClose={() => handleCloseDialog(false)}
      footer={
        <>
          {/* Debug info for form validation */}
          <div className="text-xs text-gray-500 mb-2">
            Form valid: {isValid ? 'Yes' : 'No'} | 
            Required fields: name: "{formInputs.name}" | 
            Account type: "{formInputs.accountType}" | 
            {formInputs.accountType === 'subaccount' && `Master: "${formInputs.masterAccountId}" | `}
            Billing: "{formInputs.billingType}" |
            {formInputs.billingType === 'through_other' && `Billing Account: "${formInputs.billingAccountId}" | `}
            Errors: {Object.keys(errors).length > 0 ? Object.keys(errors).join(', ') : 'None'}
          </div>
          <DialogFooter
            onCancel={() => handleCloseDialog(false)}
            onConfirm={handleSubmit(onSubmit)}
            disabled={isSubmitting || !isValid}
            loading={isSubmitting}
            confirmText={customerId ? 'Save Changes' : 'Create Customer'}
          />
        </>
      }
    >
      {isLoading ? (
        <div className="py-4 flex justify-center">
          <LoadingIndicator />
        </div>
      ) : (
        <div style={{ width: '800px', maxWidth: '100%' }}>
          {error && (
            <AlertBox
              type="error"
              title="Error"
              message={error}
              className="mb-4"
            />
          )}
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              {/* Basic Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                <FormTable>
                  <FormRow
                    label="Customer Name"
                    htmlFor="name"
                    required={true}
                    error={errors.name?.message}
                  >
                    <Input
                      id="name"
                      value={formInputs.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Address"
                    htmlFor="address"
                    error={errors.address?.message}
                  >
                    <Input
                      id="address"
                      value={formInputs.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter address"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Contact Name"
                    htmlFor="contactName"
                    error={errors.contactName?.message}
                  >
                    <Input
                      id="contactName"
                      value={formInputs.contactName}
                      onChange={(e) => handleInputChange('contactName', e.target.value)}
                      placeholder="Enter contact person's name"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Contact Email"
                    htmlFor="contactEmail"
                    error={errors.contactEmail?.message}
                  >
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formInputs.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      placeholder="Enter contact email"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Contact Phone"
                    htmlFor="contactPhone"
                    error={errors.contactPhone?.message}
                  >
                    <Input
                      id="contactPhone"
                      value={formInputs.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="Enter contact phone number"
                    />
                  </FormRow>
                </FormTable>
              </div>
              
              {/* Account Relationship Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Account Relationship</h3>
                <FormTable>
                  <FormRow
                    label="Account Type"
                    htmlFor="accountType"
                    required={true}
                    error={errors.accountType?.message}
                  >
                    <Controller
                      name="accountType"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={formInputs.accountType}
                          onValueChange={(value) => handleInputChange('accountType', value)}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center">
                            <Radio
                              id="account-type-master"
                              value="master"
                              checked={formInputs.accountType === "master"}
                            />
                            <Label htmlFor="account-type-master" className="ml-2">Master Account</Label>
                          </div>
                          <div className="flex items-center">
                            <Radio
                              id="account-type-subaccount"
                              value="subaccount"
                              checked={formInputs.accountType === "subaccount"}
                            />
                            <Label htmlFor="account-type-subaccount" className="ml-2">Subaccount</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </FormRow>
                  
                  {formInputs.accountType === 'subaccount' && (
                    <FormRow
                      label="Master Account"
                      htmlFor="masterAccountId"
                      required={true}
                      error={errors.masterAccountId?.message}
                    >
                      <CustomerSelect
                        id="masterAccountId"
                        value={formInputs.masterAccountId}
                        onChange={(value) => handleInputChange('masterAccountId', value)}
                        placeholder="Select master account"
                        excludeIds={customerId ? [customerId] : []}
                      />
                    </FormRow>
                  )}
                </FormTable>
              </div>
              
              {/* Invoicing Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Invoicing</h3>
                <FormTable>
                  <FormRow
                    label="Billing Type"
                    htmlFor="billingType"
                    required={true}
                    error={errors.billingType?.message}
                  >
                    <Controller
                      name="billingType"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={formInputs.billingType}
                          onValueChange={(value) => handleInputChange('billingType', value)}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center">
                            <Radio
                              id="billing-type-independent"
                              value="independent"
                              checked={formInputs.billingType === "independent"}
                            />
                            <Label htmlFor="billing-type-independent" className="ml-2">Bills Independently</Label>
                          </div>
                          <div className="flex items-center">
                            <Radio
                              id="billing-type-through-other"
                              value="through_other"
                              checked={formInputs.billingType === "through_other"}
                            />
                            <Label htmlFor="billing-type-through-other" className="ml-2">Bills Through Another</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </FormRow>
                  
                  {formInputs.billingType === 'through_other' && (
                    <FormRow
                      label="Billing Account"
                      htmlFor="billingAccountId"
                      required={true}
                      error={errors.billingAccountId?.message}
                    >
                      <CustomerSelect
                        id="billingAccountId"
                        value={formInputs.billingAccountId}
                        onChange={(value) => handleInputChange('billingAccountId', value)}
                        placeholder="Select billing account"
                        excludeIds={customerId ? [customerId] : []}
                      />
                    </FormRow>
                  )}
                  
                  <FormRow
                    label="Invoice Terms"
                    htmlFor="invoiceTerms"
                    error={errors.invoiceTerms?.message}
                  >
                    <Input
                      id="invoiceTerms"
                      value={formInputs.invoiceTerms}
                      onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                      placeholder="Enter invoice terms"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Invoice Contact"
                    htmlFor="invoiceContact"
                    error={errors.invoiceContact?.message}
                  >
                    <Input
                      id="invoiceContact"
                      value={formInputs.invoiceContact}
                      onChange={(e) => handleInputChange('invoiceContact', e.target.value)}
                      placeholder="Enter invoice contact"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Invoice Method"
                    htmlFor="invoiceMethod"
                    error={errors.invoiceMethod?.message}
                  >
                    <Input
                      id="invoiceMethod"
                      value={formInputs.invoiceMethod}
                      onChange={(e) => handleInputChange('invoiceMethod', e.target.value)}
                      placeholder="Enter invoice delivery method"
                    />
                  </FormRow>
                </FormTable>
              </div>
              
              {/* Services Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Available Services</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Select which services are available to this customer.
                </p>
                
                <ServiceSelection
                  value={formInputs.serviceIds}
                  onChange={(selectedIds) => handleInputChange('serviceIds', selectedIds)}
                />
                
                {errors.serviceIds && (
                  <div className="text-red-500 text-sm mt-2">
                    {typeof errors.serviceIds.message === 'string' 
                      ? errors.serviceIds.message 
                      : 'Please select at least one service'}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </ModalDialog>
  );
}