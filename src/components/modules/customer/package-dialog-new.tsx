'use client';
import clientLogger from '@/lib/client-logger';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow } from '@/components/ui/form';
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
  open: boolean;
}

export function PackageDialog({ customerId, packageId, onClose, open }: PackageDialogProps) {
  const dialogRef = useRef<DialogRef>(null);
  const { fetchWithAuth } = useAuth();
  
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPackageDisabled, setIsPackageDisabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [forceEnabled, setForceEnabled] = useState(false);
  
  // Services state
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Record<string, any>>({});
  
  // Initialize form with resolver
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty: formIsDirty, dirtyFields },
    setValue,
    reset,
    watch
  } = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      description: '',
      services: [] 
    },
    mode: 'onChange'
  });
  
  // Debug info for form state
  const isDirtyName = Boolean(dirtyFields.name);
  const isDirtyDesc = Boolean(dirtyFields.description);
  const isDirtyServices = Boolean(dirtyFields.services);
  
  // Watch form values for debugging
  const watchedName = watch('name');
  
  // Load data only once on initialization - using a ref to track if data has been loaded
  const dataLoadedRef = useRef(false);
  
  // Keep track of original values for explicit dirty checking
  const originalName = useRef<string>('');
  const originalDescription = useRef<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    // Only load data once when dialog opens
    if (!open || dataLoadedRef.current) return;
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load available services
        const customerResponse = await fetchWithAuth(`/api/customers/${customerId}`);
        
        if (!customerResponse.ok) {
          throw new Error('Failed to load customer data');
        }
        
        const customerData = await customerResponse.json();
        
        if (!isMounted) return; // Don't update state if unmounted
        
        const services = customerData.services || [];
        setAvailableServices(services);
        
        // If editing, load package data
        if (packageId) {
          const packageResponse = await fetchWithAuth(`/api/packages/${packageId}`);
          
          if (!packageResponse.ok) {
            throw new Error('Failed to load package data');
          }
          
          const packageData = await packageResponse.json();
          
          if (!isMounted) return; // Don't update state if unmounted
          
          if (!packageData || !packageData.services) {
            throw new Error('Invalid package data');
          }
          
          // Log package data for debugging
          clientLogger.info("Package data received:", packageData);
          clientLogger.info("Package name:", packageData.name);
          clientLogger.info("Package disabled status:", packageData.disabled);
          
          // Store the package disabled status
          setIsPackageDisabled(Boolean(packageData.disabled));
          
          // Store original values for explicit dirty checking
          originalName.current = packageData.name || '';
          originalDescription.current = packageData.description;
          
          // Extract data all at once to minimize state updates
          const serviceIds = packageData.services.map((svc: any) => svc.serviceId);
          const scopeMap: Record<string, any> = {};
          
          packageData.services.forEach((svc: any) => {
            scopeMap[svc.serviceId] = svc.scope;
          });
          
          // First, update services data separately
          const servicesData = packageData.services.map((svc: any) => ({
            serviceId: svc.serviceId,
            scope: svc.scope
          }));
          
          // First update the basic fields in a sequential way
          clientLogger.info("Setting basic fields first...");
          setValue('name', packageData.name || '', { shouldDirty: false });
          setValue('description', packageData.description || '', { shouldDirty: false });
          
          // Then update services 
          clientLogger.info("Setting services field...");
          setValue('services', servicesData, { shouldDirty: false });
          
          clientLogger.info("Current values after setValues:", {
            name: watch('name'),
            description: watch('description'),
            serviceCount: watch('services')?.length
          });
          
          // Update service selection separately
          setSelectedServiceIds(serviceIds);
          setScopes(scopeMap);
        }
        
        // Mark data as loaded to prevent reloading
        dataLoadedRef.current = true;
      } catch (err) {
        clientLogger.error("Error loading data:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
      // Reset the data loaded flag when the component unmounts
      if (!open) {
        dataLoadedRef.current = false;
      }
    };
  }, [customerId, packageId, fetchWithAuth, open, reset]);
  
  // Handle service toggling
  const handleServiceToggle = useCallback((serviceId: string, checked: boolean) => {
    let newServiceIds;
    let newScopes;
    
    if (checked) {
      // Add service
      newServiceIds = [...selectedServiceIds, serviceId];
      newScopes = { ...scopes };
    } else {
      // Remove service
      newServiceIds = selectedServiceIds.filter(id => id !== serviceId);
      newScopes = { ...scopes };
      delete newScopes[serviceId];
    }
    
    // Update state
    setSelectedServiceIds(newServiceIds);
    setScopes(newScopes);
    setIsDirty(true);
    
    // Update form directly
    const formServices = newServiceIds.map(id => ({
      serviceId: id,
      scope: newScopes[id] || null
    }));
    
    setValue('services', formServices, { shouldValidate: true, shouldDirty: true });
  }, [selectedServiceIds, scopes, setValue]);
  
  // Handle scope changes
  const handleScopeChange = useCallback((serviceId: string, scope: any) => {
    // Update scopes
    const newScopes = {
      ...scopes,
      [serviceId]: scope
    };
    
    setScopes(newScopes);
    setIsDirty(true);
    
    // Update form directly
    const formServices = selectedServiceIds.map(id => ({
      serviceId: id,
      scope: newScopes[id] || null
    }));
    
    setValue('services', formServices, { shouldValidate: true, shouldDirty: true });
  }, [scopes, selectedServiceIds, setValue]);
  
  // Form submission handler
  const onSubmit = useCallback(async (data: PackageFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // For disabled packages when we force enable the button, 
      // ensure data has all required fields
      const completeData = {
        name: data.name || originalName.current,
        description: data.description,
        services: data.services || selectedServiceIds.map(id => ({
          serviceId: id,
          scope: scopes[id] || null
        }))
      };
      
      clientLogger.info("Submitting package data:", completeData);
      
      // API URL and method
      const url = packageId
        ? `/api/packages/${packageId}`
        : `/api/customers/${customerId}/packages`;
      
      const method = packageId ? 'PUT' : 'POST';
      
      // Submit to API
      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(completeData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save package');
      }
      
      // Close dialog with refresh
      onClose(true);
    } catch (err) {
      clientLogger.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }, [customerId, packageId, fetchWithAuth, onClose, originalName, selectedServiceIds, scopes]);
  
  // Dialog cancel handler - stable reference
  const handleCancel = useCallback(() => {
    onClose(false);
  }, [onClose]);
  
  // Group services by category for display
  const groupedServices = availableServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);
  
  // Track form changes
  useEffect(() => {
    if (!isLoading && packageId) {
      clientLogger.info("Current watched name:", watchedName);
      
      // Get all form values
      const allValues = watch();
      clientLogger.info("All form values:", allValues);
      clientLogger.info("Form state:", { 
        isValid, 
        formIsDirty, 
        dirtyFields: { name: isDirtyName, description: isDirtyDesc, services: isDirtyServices },
        isPackageDisabled
      });
      
      // Check if any original values have changed by direct comparison
      const nameChanged = Boolean(packageId) && typeof watchedName === 'string' && watchedName !== originalName.current;
      const descChanged = Boolean(packageId) && watch('description') !== originalDescription.current;
      
      clientLogger.info("Direct value comparison:", {
        nameChanged,
        descChanged,
        originalName: originalName.current,
        currentName: watchedName,
        originalDesc: originalDescription.current,
        currentDesc: watch('description')
      });
      
      // Override dirty state for disabled packages if we detect any changes directly
      if (isPackageDisabled && (nameChanged || descChanged || isDirtyServices)) {
        clientLogger.info("Forcing dirty state for disabled package due to detected changes");
        setIsDirty(true);
        setForceEnabled(true);
      } else {
        // Standard dirty check
        setIsDirty(formIsDirty || isDirtyName || isDirtyDesc || isDirtyServices);
        
        // Only update forceEnabled if we're dealing with a non-disabled package
        if (!isPackageDisabled) {
          setForceEnabled(false);
        }
      }
    }
  }, [isLoading, packageId, watch, watchedName, formIsDirty, isDirtyName, isDirtyDesc, isDirtyServices, isValid, isPackageDisabled]);
  
  // Render dialog
  return (
    <ModalDialog
      ref={dialogRef}
      title={packageId ? 'Edit Package' : 'Create Package'}
      maxWidth="2xl"
      open={open}
      onClose={handleCancel}
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={forceEnabled ? () => {
            // Manual form submission for disabled packages
            const formData = watch();
            onSubmit(formData as PackageFormValues);
          } : handleSubmit(onSubmit)}
          disabled={isSubmitting || (!isValid && !forceEnabled) || (!isDirty && !forceEnabled && packageId)}
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
          
          <form onSubmit={(e) => {
            e.preventDefault(); // Prevent default submission - handled by footer button
          }}>
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
                      value={watchedName || ''} 
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setValue('name', newValue, { shouldValidate: true, shouldDirty: true });
                        setIsDirty(true);
                        
                        // For disabled packages, check direct value change
                        if (isPackageDisabled && newValue !== originalName.current) {
                          clientLogger.info("Name changed for disabled package", { original: originalName.current, new: newValue });
                          setForceEnabled(true);
                        }
                      }}
                      placeholder="Enter package name"
                    />
                    {/* Debug statement */}
                    <div className="text-xs text-gray-500 mt-1">
                      Debug - Current name: {watchedName || 'empty'}
                    </div>
                  </FormRow>
                  
                  <FormRow
                    label="Description"
                    htmlFor="description"
                    error={errors.description?.message}
                  >
                    <Textarea
                      id="description"
                      value={watch('description') || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setValue('description', newValue, { shouldValidate: true, shouldDirty: true });
                        setIsDirty(true);
                        
                        // For disabled packages, check direct value change 
                        if (isPackageDisabled && newValue !== originalDescription.current) {
                          clientLogger.info("Description changed for disabled package", { original: originalDescription.current, new: newValue });
                          setForceEnabled(true);
                        }
                      }}
                      placeholder="Enter package description"
                      rows={3}
                    />
                    {/* Debug statement */}
                    <div className="text-xs text-gray-500 mt-1">
                      Debug - Current description: {watch('description') || 'empty'}
                    </div>
                    
                    {/* Form state debug info */}
                    <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded border border-gray-200">
                      <div>Form State: {formIsDirty ? 'Dirty' : 'Clean'}</div>
                      <div>Is Package Disabled: {isPackageDisabled ? 'Yes' : 'No'}</div>
                      <div>Is Valid: {isValid ? 'Yes' : 'No'}</div>
                      <div>Is Dirty (local): {isDirty ? 'Yes' : 'No'}</div>
                      <div>Name Changed: {isDirtyName ? 'Yes' : 'No'}</div>
                      <div>Description Changed: {isDirtyDesc ? 'Yes' : 'No'}</div>
                      <div>Services Changed: {isDirtyServices ? 'Yes' : 'No'}</div>
                      <div>Force Button Enabled: {forceEnabled ? 'Yes' : 'No'}</div>
                      <div>Button Should Be Enabled: {(isValid || forceEnabled) && (isDirty || forceEnabled || !packageId) ? 'Yes' : 'No'}</div>
                    </div>
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