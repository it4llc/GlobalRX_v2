'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { PackageDialog } from './package-dialog-new.tsx';
import { ScopeDialog } from './scope-dialog-new.tsx';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Package } from 'lucide-react';

interface CustomerInfo {
  id: string;
  name: string;
  disabled: boolean;
  services: {
    id: string;
    name: string;
    category: string;
    functionalityType: string;
  }[];
}

interface PackageService {
  service: {
    id: string;
    name: string;
    category: string;
    functionalityType: string;
  };
  scope: any;
}

interface CustomerPackage {
  id: string;
  name: string;
  description?: string;
  disabled?: boolean;
  services: PackageService[];
}

interface CustomerPackagesProps {
  customerId: string;
  customerName?: string | null;
}

export default function CustomerPackages({ customerId, customerName: initialCustomerName }: CustomerPackagesProps) {
  const { checkPermission, fetchWithAuth } = useAuth();
  const { t } = useTranslation();
  
  // State
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(initialCustomerName);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Scope editing state
  const [scopeDialog, setScopeDialog] = useState<{
    open: boolean;
    packageId: string;
    serviceId: string;
    serviceName: string;
    serviceType: string;
    scope: any;
  }>({
    open: false,
    packageId: '',
    serviceId: '',
    serviceName: '',
    serviceType: '',
    scope: null
  });
  
  // Permissions
  const canEdit = checkPermission('customers', 'edit');
  
  // Handle toggle for disabled packages
  const handleToggleDisabled = useCallback((checked: boolean) => {
    console.log("Toggle disabled packages to:", checked);
    setShowDisabled(checked);
    setRefreshKey(prev => prev + 1);
  }, []);
  
  // Fetch customer data and packages
  useEffect(() => {
    let isMounted = true; // Flag to track if component is still mounted
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    const fetchData = async () => {
      if (!customerId) {
        setError("No customer ID provided");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching with showDisabled:", showDisabled, "refreshKey:", refreshKey);
      
      try {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
          setDebugInfo(null);
        }
        
        // Fetch customer details to get available services
        const customerResponse = await fetchWithAuth(`/api/customers/${customerId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!customerResponse.ok) {
          throw new Error(`Failed to fetch customer details: ${customerResponse.status}`);
        }
        
        const customerData = await customerResponse.json();
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        // Extract services from the customer data
        const customerServices = customerData.services || [];
        
        setCustomer({
          id: customerData.id,
          name: customerData.name,
          disabled: customerData.disabled,
          services: customerServices
        });
        
        // Set customer name if not already provided
        if (!customerName) {
          setCustomerName(customerData.name);
        }
        
        // Construct the API URL with proper cache busting
        const packagesUrl = `/api/customers/${customerId}/packages`;
        const timestamp = new Date().getTime();
        const queryParams = showDisabled 
          ? `?includeDisabled=true&t=${timestamp}` 
          : `?t=${timestamp}`;
        const fullUrl = packagesUrl + queryParams;
        
        console.log("Fetching packages with URL:", fullUrl);
        
        // Check if component is still mounted before continuing
        if (!isMounted) return;
        
        // Fetch packages for this customer
        const packagesResponse = await fetchWithAuth(fullUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!packagesResponse.ok) {
          // Try to get more error details
          let errorDetail = "";
          try {
            const errorData = await packagesResponse.json();
            errorDetail = errorData.error || "";
          } catch (e) {
            errorDetail = "Could not parse error response";
          }
          
          if (isMounted) {
            setDebugInfo(`API Status: ${packagesResponse.status}, Error: ${errorDetail}`);
          }
          throw new Error(`Failed to fetch packages: ${errorDetail || packagesResponse.status}`);
        }
        
        let packagesData;
        try {
          packagesData = await packagesResponse.json();
          
          // Ensure we have an array of packages
          if (!Array.isArray(packagesData)) {
            if (isMounted) {
              setDebugInfo(`Received non-array data: ${JSON.stringify(packagesData).substring(0, 100)}...`);
            }
            throw new Error("Invalid packages data format received");
          }
          
          console.log(`Loaded ${packagesData.length} packages. ShowDisabled: ${showDisabled}`);
          if (isMounted) {
            setPackages(packagesData);
          }
        } catch (parseError) {
          if (isMounted) {
            setDebugInfo(`Parse error: ${parseError.message}`);
          }
          throw new Error("Failed to parse packages data");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          console.log('Fetch aborted');
          return;
        }
        console.error('Error fetching data:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false; // Mark component as unmounted
      
      try {
        // We've removed the use of the AbortController entirely 
        // to avoid the error with abort() being called on cleanup
      } catch (err) {
        console.log('Cleanup error (ignored):', err);
      }
    };
  }, [customerId, fetchWithAuth, showDisabled, refreshKey, customerName]);
  
  // Handle dialog close
  const handleDialogClose = (refreshData: boolean) => {
    // Close the dialog
    setShowDialog(false);
    setEditingPackageId(null);
    
    // If refresh is requested, increment refreshKey to trigger the useEffect
    if (refreshData) {
      console.log("Refreshing packages after dialog close");
      setRefreshKey(prev => prev + 1);
    }
  };
  
  // Handle package creation
  const handleAddPackage = () => {
    setEditingPackageId(null);
    setShowDialog(true);
  };
  
  // Handle package edit
  const handleEditPackage = (packageId: string) => {
    setEditingPackageId(packageId);
    setShowDialog(true);
  };
  
  // Handle toggling package disabled status
  const handleTogglePackageStatus = async (packageId: string, currentlyDisabled: boolean) => {
    const action = currentlyDisabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} this package?`)) {
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/packages/${packageId}/toggle-status`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} package`);
      }
      
      // Update the package in the state
      setPackages(prevPackages => 
        prevPackages.map(pkg => 
          pkg.id === packageId 
            ? { ...pkg, disabled: !pkg.disabled } 
            : pkg
        )
      );
    } catch (err) {
      console.error(`Error ${action}ing package:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Handle scope dialog close - simplified
  const handleScopeDialogClose = (savedScope?: any) => {
    console.log("Scope dialog closed with saved scope:", savedScope);
    
    // Start by closing the dialog to avoid state updates while processing
    setScopeDialog({
      open: false,
      packageId: '',
      serviceId: '',
      serviceName: '',
      serviceType: '',
      scope: null
    });
    
    // Only update if we have a valid saved scope
    if (savedScope && scopeDialog.packageId && scopeDialog.serviceId) {
      // API update
      fetchWithAuth(`/api/packages/${scopeDialog.packageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          services: packages
            .find(p => p.id === scopeDialog.packageId)
            ?.services.map(s => ({
              serviceId: s.service.id,
              scope: s.service.id === scopeDialog.serviceId ? savedScope : s.scope
            }))
        })
      })
      .then(response => {
        if (!response.ok) {
          console.error("Failed to update scope:", response.status);
        } else {
          console.log("Scope updated successfully");
          // Refresh data by incrementing refreshKey
          setRefreshKey(prev => prev + 1);
        }
      })
      .catch(err => {
        console.error("Error updating scope:", err);
      });
    }
  };
  
  // Format scope for display
  const formatScopeDisplay = (scope: any, serviceType: string) => {
    if (!scope) return 'Standard';
    
    switch (serviceType) {
      case 'verification-edu':
        switch (scope.type) {
          case 'highest-degree':
            return 'Highest Degree (post high school)';
          case 'highest-degree-inc-highschool':
            return 'Highest Degree (including high school)';
          case 'all-degrees':
            return 'All Degrees (post high school)';
          default:
            return 'Standard Educational Verification';
        }
        
      case 'verification-emp':
        switch (scope.type) {
          case 'most-recent':
            return 'Most Recent Employment';
          case 'most-recent-x':
            return `Most Recent ${scope.quantity || 1} Employments`;
          case 'past-x-years':
            return `All Employments (past ${scope.years || 7} years)`;
          default:
            return 'Standard Employment Verification';
        }
        
      case 'record':
        switch (scope.type) {
          case 'current-address':
            return 'Current Address Only';
          case 'last-x-addresses':
            return `Last ${scope.quantity || 1} Addresses`;
          case 'past-x-years':
            return `All Addresses (past ${scope.years || 7} years)`;
          default:
            return 'Standard Record Check';
        }
        
      default:
        return 'Standard';
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Data"
        message={`${error}${debugInfo ? `\n\nDebug info: ${debugInfo}` : ''}`}
        action={
          <Button onClick={() => setRefreshKey(prev => prev + 1)}>Retry</Button>
        }
      />
    );
  }
  
  // Render no access state
  if (!customer) {
    return (
      <AlertBox
        type="error"
        title="Customer Not Found"
        message="The requested customer could not be found or you don't have access to it."
      />
    );
  }
  
  // Render customer disabled state
  if (customer.disabled) {
    return (
      <AlertBox
        type="warning"
        title="Customer Disabled"
        message={`Customer "${customer.name}" is currently disabled. Enable the customer to manage packages.`}
      />
    );
  }
  
  // Render no services state
  if (!customer.services || customer.services.length === 0) {
    return (
      <AlertBox
        type="info"
        title="No Services Available"
        message={`Customer "${customer.name}" doesn't have any services available. Please add services to the customer before creating packages.`}
      />
    );
  }
  
  // Render no packages state
  if (!packages || packages.length === 0) {
    return (
      <div className="space-y-6" style={{width: "100%", maxWidth: "100%", overflowX: "visible"}}>
        <div className="w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            {customerName ? `Customer Packages - ${customerName}` : 'Customer Packages'}
          </h1>
          
          <div className="flex items-center gap-6">
            {canEdit && (
              <Button onClick={handleAddPackage}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Package
              </Button>
            )}
            
            <div className="flex items-center bg-white border border-gray-300 rounded px-3 py-1.5">
              <label htmlFor="showDisabled" className="mr-2 text-sm font-medium text-gray-700">
                Show Disabled Packages
              </label>
              <input
                id="showDisabled"
                type="checkbox"
                checked={showDisabled}
                onChange={e => handleToggleDisabled(e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-md p-12 flex flex-col items-center justify-center" style={{width: "100%"}}>
          <Package className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Packages Created</h3>
          <p className="text-gray-500 text-center max-w-md mb-6">
            This customer doesn't have any service packages yet. Create a package to define which services the customer can use.
          </p>
          
          {canEdit && (
            <Button onClick={handleAddPackage}>
              Create First Package
            </Button>
          )}
        </div>
        
        {showDialog && (
          <PackageDialog
            customerId={customerId}
            packageId={editingPackageId}
            onClose={handleDialogClose}
            open={showDialog}
          />
        )}
      </div>
    );
  }
  
  // Render packages in tabular format
  return (
    <div className="space-y-6" style={{width: "100%", maxWidth: "100%", overflowX: "visible"}}>
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {customerName ? `Customer Packages - ${customerName}` : 'Customer Packages'}
        </h1>
        
        <div className="flex items-center gap-6">
          {canEdit && (
            <Button onClick={handleAddPackage}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Package
            </Button>
          )}
          
          <div className="flex items-center bg-white border border-gray-300 rounded px-3 py-1.5">
            <label htmlFor="showDisabled" className="mr-2 text-sm font-medium text-gray-700">
              Show Disabled Packages
            </label>
            <input
              id="showDisabled"
              type="checkbox"
              checked={showDisabled}
              onChange={e => handleToggleDisabled(e.target.checked)}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded"
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-8" style={{width: "100%", maxWidth: "100%", overflowX: "visible"}}>
        {[...packages].sort((a, b) => a.name.localeCompare(b.name)).map((pkg) => (
          <div key={pkg.id} className="overflow-visible rounded-md border border-gray-200" style={{width: "100%", marginBottom: "2rem"}}>
            {/* Package Header - Full Width Banner with Left-Aligned Text */}
            <div style={{
              width: "100%", 
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: pkg.disabled ? "#f9f9f9" : "#f3f4f6", 
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e5e7eb"
            }}>
              <div style={{display: "flex", alignItems: "baseline", flexGrow: 1}}>
                <h3 className={`font-semibold mr-3 ${pkg.disabled ? 'text-gray-500' : ''}`} style={{marginBottom: 0, marginTop: 0}}>
                  {pkg.name}
                  {pkg.disabled && (
                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">Disabled</span>
                  )}
                </h3>
                {pkg.description && (
                  <span className="text-sm text-gray-500" style={{display: "inline", marginLeft: "4px"}}>{pkg.description}</span>
                )}
              </div>
              
              {canEdit && (
                <div>
                  <ActionDropdown
                    options={[
                      {
                        label: 'Edit Package',
                        onClick: () => handleEditPackage(pkg.id),
                        color: 'rgb(37, 99, 235)',
                      },
                      {
                        label: pkg.disabled ? 'Enable Package' : 'Disable Package',
                        onClick: () => handleTogglePackageStatus(pkg.id, !!pkg.disabled),
                        color: pkg.disabled ? 'rgb(22, 163, 74)' : 'rgb(217, 119, 6)',
                      }
                    ]}
                  />
                </div>
              )}
            </div>
            
            {/* Package Services Table */}
            <table style={{width: "100%", tableLayout: "fixed", borderCollapse: "collapse"}} className="divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500" style={{width: "30%"}}>
                    Service
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500" style={{width: "15%"}}>
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-gray-500" style={{width: "40%"}}>
                    Scope
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-gray-500" style={{width: "15%"}}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pkg.services && pkg.services.length > 0 ? (
                  pkg.services.map((svc) => (
                    <tr key={svc.service?.id || `service-${Math.random()}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {svc.service?.name || 'Unnamed Service'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Badge variant="secondary">
                          {svc.service?.category || 'Uncategorized'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatScopeDisplay(svc.scope, svc.service.functionalityType)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        {canEdit && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const scopeData = {
                                packageId: pkg.id,
                                serviceId: svc.service.id,
                                serviceName: svc.service.name || 'Unknown Service',
                                serviceType: svc.service.functionalityType || 'other',
                                scope: svc.scope || {}
                              };
                              
                              console.log("Edit scope clicked for:", scopeData);
                              
                              // Safely open the scope dialog with validated data
                              setScopeDialog({
                                open: true,
                                packageId: scopeData.packageId,
                                serviceId: scopeData.serviceId,
                                serviceName: scopeData.serviceName,
                                serviceType: scopeData.serviceType,
                                scope: scopeData.scope
                              });
                            }}
                          >
                            Edit Scope
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No services in this package
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      
      {/* Package Dialog */}
      {showDialog && (
        <PackageDialog
          customerId={customerId}
          packageId={editingPackageId}
          onClose={handleDialogClose}
          open={showDialog}
        />
      )}
      
      {/* Scope Dialog */}
      {scopeDialog.open && (
        <ScopeDialog
          open={scopeDialog.open}
          onClose={handleScopeDialogClose}
          serviceName={scopeDialog.serviceName}
          serviceType={scopeDialog.serviceType}
          initialScope={scopeDialog.scope}
        />
      )}
    </div>
  );
}