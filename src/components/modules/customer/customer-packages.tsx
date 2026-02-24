// src/components/modules/customer/customer-packages.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';
import { PackageDialog } from './package-dialog';
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
  services: PackageService[];
}

interface CustomerPackagesProps {
  customerId: string;
}

export default function CustomerPackages({ customerId }: CustomerPackagesProps) {
  const { checkPermission, fetchWithAuth } = useAuth();
  
  // State
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  
  // Debug state changes
  useEffect(() => {
    clientLogger.debug('showDialog state changed', { showDialog });
  }, [showDialog]);
  
  useEffect(() => {
    clientLogger.debug('editingPackageId state changed', { editingPackageId });
  }, [editingPackageId]);
  
  // Permissions
  const canEdit = checkPermission('customers', 'edit');
  
  // Fetch customer data and packages
  useEffect(() => {
    const fetchData = async () => {
      if (!customerId) {
        setError("No customer ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setDebugInfo(null);
        
        clientLogger.debug('Fetching customer data', { customerId });
        
        // Fetch customer details to get available services
        const customerResponse = await fetchWithAuth(`/api/customers/${customerId}`);
        
        if (!customerResponse.ok) {
          clientLogger.error('Customer API response not OK', {
            status: customerResponse.status
          });
          throw new Error(`Failed to fetch customer details: ${customerResponse.status}`);
        }
        
        const customerData = await customerResponse.json();
        clientLogger.info('Customer data received', {
          hasCustomerData: !!customerData
        });
        
        // Extract services from the customer data
        const customerServices = customerData.services || [];
        
        setCustomer({
          id: customerData.id,
          name: customerData.name,
          disabled: customerData.disabled,
          services: customerServices
        });
        
        clientLogger.debug("Successfully fetched customer data, now fetching packages");
        
        // Fetch packages for this customer
        const packagesResponse = await fetchWithAuth(`/api/customers/${customerId}/packages`);
        
        if (!packagesResponse.ok) {
          // Try to get more error details
          let errorDetail = "";
          try {
            const errorData = await packagesResponse.json();
            errorDetail = errorData.error || "";
          } catch (e) {
            errorDetail = "Could not parse error response";
          }
          
          clientLogger.error("Packages API response not OK:", packagesResponse.status, errorDetail);
          setDebugInfo(`API Status: ${packagesResponse.status}, Error: ${errorDetail}`);
          throw new Error(`Failed to fetch packages: ${errorDetail || packagesResponse.status}`);
        }
        
        let packagesData;
        try {
          packagesData = await packagesResponse.json();
          clientLogger.debug("Packages data:", packagesData);
          
          // Ensure we have an array of packages
          if (!Array.isArray(packagesData)) {
            clientLogger.error("Packages data is not an array:", packagesData);
            setDebugInfo(`Received non-array data: ${JSON.stringify(packagesData).substring(0, 100)}...`);
            throw new Error("Invalid packages data format received");
          }
          
          setPackages(packagesData);
        } catch (parseError) {
          clientLogger.error("Error parsing packages response:", parseError);
          setDebugInfo(`Parse error: ${parseError.message}, Response text: ${await packagesResponse.text()}`);
          throw new Error("Failed to parse packages data");
        }
      } catch (err) {
        clientLogger.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [customerId, fetchWithAuth]);
  
  // Handle dialog close
  const handleDialogClose = (refreshData: boolean) => {
    clientLogger.debug("handleDialogClose called with refreshData:", refreshData);
    setShowDialog(false);
    setEditingPackageId(null);
    clientLogger.debug("showDialog set to false, editingPackageId set to null");
    
    if (refreshData) {
      clientLogger.debug("Refreshing packages data...");
      // Refresh packages
      fetchWithAuth(`/api/customers/${customerId}/packages`)
        .then(response => {
          clientLogger.debug("Package refresh response status:", response.status);
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to refresh packages');
        })
        .then(data => {
          clientLogger.debug("Received refreshed packages data:", data);
          if (Array.isArray(data)) {
            setPackages(data);
            clientLogger.debug("Packages state updated with", data.length, "packages");
          } else {
            clientLogger.error("Received non-array data after refresh:", data);
          }
        })
        .catch(err => {
          clientLogger.error('Error refreshing packages:', err);
        });
    }
  };
  
  // Handle package creation
  const handleAddPackage = () => {
    clientLogger.debug("Create Package button clicked");
    setEditingPackageId(null);
    setShowDialog(true);
    clientLogger.debug("showDialog set to:", true);
  };
  
  // Handle package edit
  const handleEditPackage = (packageId: string) => {
    clientLogger.debug("Edit Package button clicked for packageId:", packageId);
    setEditingPackageId(packageId);
    setShowDialog(true);
    clientLogger.debug("showDialog set to:", true, "editingPackageId set to:", packageId);
  };
  
  // Handle package deletion
  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) {
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/packages/${packageId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete package');
      }
      
      // Remove package from state
      setPackages(prevPackages => prevPackages.filter(pkg => pkg.id !== packageId));
    } catch (err) {
      clientLogger.error('Error deleting package:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Group packages by functionality type for easier navigation
  const groupPackagesByFunctionalityType = () => {
    // Extract functionality types from services in packages
    const allFunctionalityTypes = packages.flatMap(pkg => 
      (pkg.services || []).map((svc: any) => svc.service?.functionalityType || 'other')
    );
    
    // Get unique functionality types
    const uniqueTypes = [...new Set(allFunctionalityTypes)];
    
    // Group packages by functionality type
    const grouped: Record<string, CustomerPackage[]> = {};
    
    // Initialize with empty arrays for all types
    uniqueTypes.forEach(type => {
      grouped[type] = [];
    });
    
    // Add packages to appropriate groups
    packages.forEach(pkg => {
      // Skip packages without services or with invalid service structure
      if (!pkg.services || !Array.isArray(pkg.services)) {
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(pkg);
        return;
      }
      
      // Get functionality types in this package
      const typesInPackage = pkg.services.map((svc: any) => svc.service?.functionalityType || 'other');
      
      // Get unique types in this package
      const uniqueTypesInPackage = [...new Set(typesInPackage)];
      
      // If no valid types found, add to 'other'
      if (uniqueTypesInPackage.length === 0) {
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(pkg);
        return;
      }
      
      // Add package to each relevant group
      uniqueTypesInPackage.forEach(type => {
        if (!grouped[type]) {
          grouped[type] = [];
        }
        
        if (!grouped[type].some(p => p.id === pkg.id)) {
          grouped[type].push(pkg);
        }
      });
    });
    
    return grouped;
  };
  
  // Format functionality type for display
  const formatFunctionalityType = (type: string): string => {
    switch (type) {
      case 'verification-edu':
        return 'Educational Verifications';
      case 'verification-emp':
        return 'Employment Verifications';
      case 'record':
        return 'Records';
      case 'other':
        return 'Other Services';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
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
          <Button onClick={() => window.location.reload()}>Retry</Button>
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{customer.name}</h2>
            <p className="text-gray-500">Configure service packages for this customer</p>
          </div>
          
          {canEdit && (
            <Button onClick={handleAddPackage}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Package
            </Button>
          )}
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
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
          </CardContent>
        </Card>
        
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
  
  // Group packages by functionality type
  const groupedPackages = groupPackagesByFunctionalityType();
  
  // Render packages grouped by functionality type
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{customer.name}</h2>
          <p className="text-gray-500">
            {packages.length} {packages.length === 1 ? 'package' : 'packages'} configured
          </p>
        </div>
        
        {canEdit && (
          <Button onClick={handleAddPackage}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Package
          </Button>
        )}
      </div>
      
      <div className="space-y-10">
        {Object.entries(groupedPackages).map(([type, pkgs]) => (
          pkgs.length > 0 && (
            <div key={type} className="space-y-4">
              <h3 className="text-lg font-semibold">{formatFunctionalityType(type)}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pkgs.map((pkg: any) => (
                  <Card key={pkg.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        
                        {canEdit && (
                          <ActionDropdown
                            options={[
                              {
                                label: 'Edit',
                                onClick: () => handleEditPackage(pkg.id),
                                color: 'rgb(37, 99, 235)',
                              },
                              {
                                label: 'Delete',
                                onClick: () => handleDeletePackage(pkg.id),
                                color: 'rgb(220, 38, 38)',
                              },
                            ]}
                          />
                        )}
                      </div>
                      
                      {pkg.description && (
                        <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                      )}
                    </CardHeader>
                    
                    <CardContent className="pb-4">
                      <p className="text-sm font-medium mb-2">Services:</p>
                      <div className="flex flex-wrap gap-2">
                        {pkg.services && Array.isArray(pkg.services) && pkg.services.map((svc: any) => (
                          <Badge 
                            key={svc.service?.id || `service-${Math.random()}`} 
                            variant="outline" 
                            className="font-normal"
                          >
                            {svc.service?.name || 'Unnamed Service'}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-0 text-xs text-gray-500">
                      {pkg.services && Array.isArray(pkg.services) ? (
                        <>
                          {pkg.services.length} {pkg.services.length === 1 ? 'service' : 'services'} included
                        </>
                      ) : (
                        'No services defined'
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )
        ))}
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