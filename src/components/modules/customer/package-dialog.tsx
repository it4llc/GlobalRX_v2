// src/components/modules/customer/package-dialog.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow } from '@/components/ui/form';
import { clientLogger } from '@/lib/client-logger';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { ScopeSelector } from './scope-selector';

// Validation schema
const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any() // This will be validated based on service type
  })).min(1, "At least one service must be selected")
});

type PackageFormValues = z.infer<typeof packageSchema>;

interface Service {
  id: string;
  name: string;
  category: string;
  functionalityType: string;
  description?: string;
}

interface PackageDialogProps {
  customerId: string;
  packageId: string | null; // null means creating a new package
  onClose: (refreshData: boolean) => void;
  open: boolean; // Add this prop
}

export function PackageDialog({ customerId, packageId, onClose, open }: PackageDialogProps) {
  clientLogger.debug('PackageDialog rendered', {
    hasCustomerId: !!customerId,
    hasPackageId: !!packageId,
    open
  });
  
  const dialogRef = useRef<DialogRef>(null);
  const { fetchWithAuth } = useAuth();
  
  // Use effect to open/close dialog when the open prop changes
  useEffect(() => {
    clientLogger.debug('open prop changed', { open });
    if (open && dialogRef.current) {
      clientLogger.debug('Calling showModal() on dialogRef');
      dialogRef.current.showModal();
    } else if (!open && dialogRef.current) {
      clientLogger.debug('Calling close() on dialogRef');
      dialogRef.current.close();
    }
  }, [open]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Record<string, any>>({});
  
  // Initialize form
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    reset
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      description: '',
      services: [] // Will be populated after service selection
    }
  });
  
  // Fetch customer services and package data if editing
  useEffect(() => {
    const fetchData = async () => {
      try {
        clientLogger.debug('Beginning data fetch', {
          hasCustomerId: !!customerId,
          hasPackageId: !!packageId
        });
        setIsLoading(true);
        setError(null);
        
        // Fetch customer to get available services
        clientLogger.debug('Fetching customer details');
        const customerResponse = await fetchWithAuth(`/api/customers/${customerId}`);
        
        if (!customerResponse.ok) {
          clientLogger.error('Customer API response not OK', {
            status: customerResponse.status
          });
          throw new Error('Failed to fetch customer details');
        }
        
        const customerData = await customerResponse.json();
        clientLogger.info('Customer data received', {
          hasCustomerData: !!customerData
        });
        const services = customerData.services || [];
        clientLogger.debug('Available services loaded', {
          servicesCount: services?.length
        });
        setAvailableServices(services);
        
        // If editing an existing package, fetch its details
        if (packageId) {
          clientLogger.debug('Fetching package details', {
            packageId
          });
          const packageResponse = await fetchWithAuth(`/api/packages/${packageId}`);
          
          clientLogger.debug('Package API response received', {
            status: packageResponse.status
          });
          
          if (!packageResponse.ok) {
            let errorText = "";
            try {
              const errorData = await packageResponse.json();
              errorText = errorData.error || "";
              clientLogger.error('Package API error', {
                error: errorData
              });
            } catch (e) {
              errorText = "Could not parse error response";
            }
            throw new Error(`Failed to fetch package details: ${errorText}`);
          }
          
          const packageData = await packageResponse.json();
          clientLogger.info('Package data received', {
            hasPackageData: !!packageData
          });
          
          // Verify package data structure
          if (!packageData || !packageData.services) {
            clientLogger.error('Invalid package data format', {
              hasPackageData: !!packageData
            });
            throw new Error('Package data is missing required fields');
          }
          
          clientLogger.debug('Setting form values with package data');
          
          // Set form values
          reset({
            name: packageData.name,
            description: packageData.description,
            services: packageData.services.map((svc: any) => ({
              serviceId: svc.serviceId,
              scope: svc.scope
            }))
          });
          
          // Set selected service IDs
          const serviceIds = packageData.services.map((svc: any) => svc.serviceId);
          clientLogger.debug('Selected service IDs', {
            serviceIdsCount: serviceIds?.length
          });
          setSelectedServiceIds(serviceIds);
          
          // Set scopes
          const scopeData: Record<string, any> = {};
          packageData.services.forEach((svc: any) => {
            scopeData[svc.serviceId] = svc.scope;
          });
          clientLogger.debug('Scope data loaded', {
            hasScopeData: !!scopeData
          });
          setScopes(scopeData);
        }
      } catch (err) {
        clientLogger.error('Error fetching data', {
          error: err.message
        });
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [customerId, packageId, fetchWithAuth, reset]);
  
  // Handle service selection
  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServiceIds(prev => [...prev, serviceId]);
    } else {
      setSelectedServiceIds(prev => prev.filter(id => id !== serviceId));
      // Also remove scope for this service
      setScopes(prev => {
        const newScopes = { ...prev };
        delete newScopes[serviceId];
        return newScopes;
      });
    }
  };
  
  // Handle scope change
  const handleScopeChange = (serviceId: string, scope: any) => {
    setScopes(prev => ({
      ...prev,
      [serviceId]: scope
    }));
  };
  
  // Update form value when selected services change
  useEffect(() => {
    // Map selected services to form format
    const servicesFormValue = selectedServiceIds.map(serviceId => ({
      serviceId,
      scope: scopes[serviceId] || null
    }));
    
    setValue('services', servicesFormValue, { shouldValidate: true });
  }, [selectedServiceIds, scopes, setValue]);
  
  // Handle form submission
  const onSubmit = async (data: PackageFormValues) => {
    try {
      clientLogger.debug('Form submitted', {
        hasData: !!data
      });
      setIsSubmitting(true);
      setError(null);
      
      // Check if all required scopes are defined
      const missingScopes = data.services.filter(svc => {
        const service = availableServices.find(s => s.id === svc.serviceId);
        if (!service) return false;
        
        // Require scope for verification services
        if (service.functionalityType.startsWith('verification') && !svc.scope) {
          return true;
        }
        
        return false;
      });
      
      if (missingScopes.length > 0) {
        const missingServices = missingScopes.map(svc => {
          const service = availableServices.find(s => s.id === svc.serviceId);
          return service?.name || 'Unknown service';
        });
        
        throw new Error(`Missing scope configuration for: ${missingServices.join(', ')}`);
      }
      
      // Format the data to match what the API expects
      const submitData = {
        name: data.name,
        description: data.description,
        services: data.services.map(svc => ({
          serviceId: svc.serviceId,
          scope: svc.scope
        }))
      };
      
      clientLogger.debug('Submitting data to API', {
        hasSubmitData: !!submitData
      });
      
      // Prepare data for API
      const url = packageId 
        ? `/api/packages/${packageId}` 
        : `/api/customers/${customerId}/packages`;
      
      const method = packageId ? 'PUT' : 'POST';
      
      clientLogger.debug('Sending API request', {
        method,
        hasUrl: !!url
      });
      
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(submitData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save package');
      }
      
      clientLogger.info('API request successful');
      
      // Close dialog and refresh data
      clientLogger.debug('Calling onClose to close dialog and refresh data');
      onClose(true);
    } catch (err) {
      clientLogger.error('Error saving package', {
        error: err.message
      });
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Group services by category
  const groupedServices = availableServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);
  
  return (
    <ModalDialog
      ref={dialogRef}
      title={packageId ? 'Edit Package' : 'Create Package'}
      maxWidth="2xl"
      open={open}
      footer={
        <DialogFooter
          onCancel={() => onClose(false)}
          onConfirm={handleSubmit(onSubmit)}
          disabled={isSubmitting || !isValid}
          loading={isSubmitting}
          confirmText={packageId ? 'Save Changes' : 'Create Package'}
        />
      }
    >
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <LoadingIndicator />
        </div>
      ) : (
        <div className="py-4">
          {error && (
            <AlertBox
              type="error"
              title="Error"
              message={error}
              className="mb-6"
            />
          )}
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-8">
              {/* Package Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Package Information</h3>
                <FormTable>
                  <FormRow
                    label="Package Name"
                    htmlFor="name"
                    required={true}
                    error={errors.name?.message}
                  >
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Enter package name"
                    />
                  </FormRow>
                  
                  <FormRow
                    label="Description"
                    htmlFor="description"
                    error={errors.description?.message}
                  >
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder="Enter package description"
                      rows={3}
                    />
                  </FormRow>
                </FormTable>
              </div>
              
              {/* Service Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Services</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Select services to include in this package and configure their scope.
                </p>
                
                {availableServices.length === 0 ? (
                  <AlertBox
                    type="info"
                    title="No Services Available"
                    message="This customer doesn't have any services available. Please add services to the customer first."
                  />
                ) : (
                  <>
                    <div className="grid gap-4">
                      {Object.entries(groupedServices).map(([category, services]) => (
                        <Card key={category}>
                          <CardContent className="p-4">
                            <h4 className="font-medium mb-3">{category}</h4>
                            <div className="space-y-4">
                              {services.map(service => (
                                <div key={service.id} className="space-y-2">
                                  <div className="flex items-start space-x-2">
                                    <Checkbox
                                      id={`service-${service.id}`}
                                      checked={selectedServiceIds.includes(service.id)}
                                      onCheckedChange={(checked) => handleServiceToggle(service.id, !!checked)}
                                    />
                                    <div>
                                      <label 
                                        htmlFor={`service-${service.id}`}
                                        className="text-sm font-medium cursor-pointer"
                                      >
                                        {service.name}
                                      </label>
                                      {service.description && (
                                        <p className="text-xs text-gray-500">{service.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Show scope selector for selected verification services */}
                                  {selectedServiceIds.includes(service.id) && 
                                   service.functionalityType.startsWith('verification') && (
                                    <div className="ml-6 border-l-2 border-gray-200 pl-4">
                                      <ScopeSelector
                                        serviceType={service.functionalityType}
                                        value={scopes[service.id]}
                                        onChange={(scope) => handleScopeChange(service.id, scope)}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {errors.services && (
                      <div className="text-red-500 text-sm mt-4">
                        {typeof errors.services.message === 'string' 
                          ? errors.services.message 
                          : 'Please select at least one service'}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </ModalDialog>
  );
}