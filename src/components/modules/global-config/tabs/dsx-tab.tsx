// src/components/modules/global-config/tabs/dsx-tab.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { Button } from '@/components/ui/button';
import { Service, Requirement } from '@/types';
import { RequirementsDataTable } from '../tables/RequirementsDataTable';
import { FieldOrderSection } from './FieldOrderSection';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';

// List of location IDs that cause problems - don't ignore Afghanistan (32c804e1)
const IGNORED_LOCATION_IDS = new Set([]);

export function DSXTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCountryName, setSelectedCountryName] = useState<string>('');

  // Store requirements directly associated with the service
  const [serviceRequirements, setServiceRequirements] = useState<Requirement[]>([]);

  // Store all available requirements from Data RX tab
  const [availableRequirements, setAvailableRequirements] = useState<any[]>([]);

  // Store IDs of requirements selected in the UI
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, boolean>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);

  const { fetchWithAuth } = useAuth();
  
  // Load locations once at the DSX tab level
  useEffect(() => {
    
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        clientLogger.debug('Fetching locations for DSX tab');
        
        const response = await fetchWithAuth('/api/locations');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch locations: ${response.status}`);
        }
        
        const data = await response.json();
        clientLogger.info('Loaded locations data', {
          locationsCount: data?.length,
          hasData: !!data
        });
        setLocations(data);
        clientLogger.info('Successfully loaded locations in DSX tab');
      } catch (err) {
        clientLogger.error('Failed to load locations in DSX tab', {
          error: err.message
        });
        setError('Failed to load locations. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLocations();
  }, [fetchWithAuth]);
  
  // Fetch services when component mounts
  useEffect(() => {
    if (services.length > 0) return;
    
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        const response = await fetchWithAuth('/api/services?includeDisabled=false');
        
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        
        const data = await response.json();
        setServices(data.services || []);
      } catch (err) {
        clientLogger.error('Error fetching services', {
          error: err.message
        });
        setError('Failed to load services. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, [fetchWithAuth, services.length]);

  // Fetch all available requirements from Data RX tab
  useEffect(() => {
    const fetchAllRequirements = async () => {
      setIsLoadingRequirements(true);
      
      try {
        // Make parallel requests to fetch data fields and documents
        clientLogger.debug('Fetching all available requirements');
        const [fieldsResponse, documentsResponse] = await Promise.all([
          fetchWithAuth('/api/data-rx/fields?includeDisabled=false'),
          fetchWithAuth('/api/data-rx/documents?includeDisabled=false')
        ]);
        
        if (!fieldsResponse.ok || !documentsResponse.ok) {
          throw new Error('Failed to fetch requirements');
        }
        
        const fieldsData = await fieldsResponse.json();
        const documentsData = await documentsResponse.json();
        
        // Normalize data for consistent handling
        const fields = (fieldsData.fields || []).map((field: any) => ({
          ...field,
          type: 'field'
        }));
        
        const documents = (documentsData.documents || []).map((doc: any) => ({
          ...doc,
          type: 'document'
        }));
        
        // Combine all requirements
        const allRequirements = [...fields, ...documents];
        clientLogger.info('All available requirements loaded', {
          count: allRequirements.length
        });
        
        setAvailableRequirements(allRequirements);
      } catch (err) {
        clientLogger.error('Error fetching requirements', {
          error: err.message
        });
        setError('Failed to load requirements. Please try again.');
      } finally {
        setIsLoadingRequirements(false);
      }
    };
    
    fetchAllRequirements();
  }, [fetchWithAuth]);

  // Function to fetch DSX data for a specific service
  const fetchDSXData = useCallback(async (serviceId: string) => {
    if (!serviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      clientLogger.debug('Fetching DSX data for service', {
        serviceId
      });

      const response = await fetchWithAuth(`/api/dsx?serviceId=${serviceId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch DSX data');
      }

      const data = await response.json();
      clientLogger.info('DSX Tab: Received fresh data from API');
      clientLogger.debug('Requirements received from API', {
        count: data.requirements?.length,
        hasRequirements: !!data.requirements
      });
      clientLogger.debug('Mappings received', {
        mappingsCount: Object.keys(data.mappings || {}).length
      });
      const sampleKeys = Object.keys(data.mappings || {}).slice(0, 5);
      clientLogger.debug('Sample mapping keys', {
        sampleKeysCount: sampleKeys.length
      });
      clientLogger.debug('Sample mapping values received from API', {
        sampleCount: sampleKeys.length
      });

      // Set the requirements associated with this service
      setServiceRequirements(data.requirements || []);

      // Process mappings - back to simple booleans
      const filteredMappings: Record<string, boolean> = {};
      Object.entries(data.mappings || {}).forEach(([key, value]) => {
        const [locationId] = key.split('___');  // Fix: split returns array, take first element
        if (!IGNORED_LOCATION_IDS.has(locationId)) {
          // The API now returns true for any existing mapping
          filteredMappings[key] = value === true;
        }
      });
      clientLogger.debug('Filtered mappings processed', {
        filteredCount: Object.keys(filteredMappings).length
      });
      clientLogger.debug('Sample filtered mappings', {
        sampleCount: Object.entries(filteredMappings).slice(0, 3).length
      });
      setMappings(filteredMappings);
      clientLogger.debug('Mappings state will be updated', {
        mappingsCount: Object.keys(filteredMappings).length
      });
      
      // Process availability
      const filteredAvailability: Record<string, boolean> = {};
      Object.entries(data.availability || {}).forEach(([locationId, value]) => {
        if (!IGNORED_LOCATION_IDS.has(locationId)) {
          filteredAvailability[locationId] = value === true;
        }
      });
      setAvailability(filteredAvailability);
      
      // Set selected requirement IDs based on the requirements returned
      const requirementIds = (data.requirements || []).map((req: any) => req.id);
      setSelectedRequirementIds(requirementIds);

    } catch (err) {
      clientLogger.error('Error fetching DSX data', {
        error: err.message
      });
      setError('Failed to load DSX data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  // Handle service selection change
  const handleServiceChange = useCallback((value: string) => {
    if (isSaving) return; // Don't allow switching services while saving
    
    setSelectedService(value);
    
    // Find the service name
    const service = services.find(s => s.id === value);
    if (service) {
      setSelectedServiceName(service.name);
    } else {
      setSelectedServiceName('');
    }
    
    // Clear current data when service changes
    setServiceRequirements([]);
    setSelectedRequirementIds([]);
    setMappings({});
    setAvailability({});
    setError(null);
  }, [services, isSaving]);

  // Load DSX data when service changes
  useEffect(() => {
    if (selectedService) {
      // Always fetch fresh data when service changes
      clientLogger.debug('Service changed, fetching fresh data', {
        selectedService
      });
      fetchDSXData(selectedService);
    }
  }, [selectedService, fetchDSXData]);

  // Handle requirement selection toggle
  const handleRequirementToggle = useCallback((requirementId: string, checked: boolean) => {
    setSelectedRequirementIds(prev => {
      if (checked) {
        return [...prev, requirementId];
      } else {
        return prev.filter(id => id !== requirementId);
      }
    });
  }, []);

  // Save selected requirements to the service
const saveSelectedRequirements = async () => {
  if (!selectedService || isSavingRequirements) {
    clientLogger.warn('Cannot save: Service not selected or already saving');
    return;
  }
  
  // Keep current selected requirements to restore in case of error
  const previousSelectedRequirements = [...selectedRequirementIds];
  
  // Set saving state
  setIsSavingRequirements(true);
  setError(null);
  
  try {
    clientLogger.debug('Saving selected requirement IDs', {
      count: selectedRequirementIds.length
    });
    
    // Create an array of requirement objects from the available requirements
    const requirementsToSave = selectedRequirementIds.map((id: any) => {
      const requirement = availableRequirements.find(req => req.id === id);
      if (!requirement) {
        clientLogger.warn('Requirement not found in availableRequirements', {
          requirementId: id
        });
        return null;
      }
      return requirement;
    }).filter(Boolean); // Remove any null values
    
    clientLogger.debug('Requirements to save', {
      count: requirementsToSave.length
    });
    
    // Call the CORRECT API endpoint - use associate-requirements instead of requirements
    const response = await fetchWithAuth('/api/dsx/associate-requirements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: selectedService,
        requirements: requirementsToSave
      }),
    });
    
    if (!response.ok) {
      // Restore previous selected requirements
      setSelectedRequirementIds(previousSelectedRequirements);
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save requirements');
    }
    
    // Parse the response
    const responseData = await response.json();
    clientLogger.debug('Save response received', {
      hasResponse: !!responseData
    });

    // Refresh DSX data to get the updated requirements
    await fetchDSXData(selectedService);
    
    // Success response
    clientLogger.info('Requirements saved successfully');
  } catch (err) {
    clientLogger.error('Error saving requirements', {
      error: err.message
    });
    setError(`Failed to save requirements: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setIsSavingRequirements(false);
  }
};

  // Handle mapping changes from the requirements table
  const handleMappingChange = async (updatedMappings: Record<string, boolean>) => {
    if (!selectedService || isSaving) {
      clientLogger.warn('Cannot save: Service not selected or already saving');
      return;
    }
    
    clientLogger.debug('Received mappings from table', {
      mappingsCount: Object.keys(updatedMappings).length
    });
    
    // Filter out problematic location IDs
    const filteredMappings: Record<string, boolean> = {};
    Object.entries(updatedMappings).forEach(([key, value]) => {
      const [locationId] = key.split('-');
      if (!IGNORED_LOCATION_IDS.has(locationId)) {
        filteredMappings[key] = value;
      }
    });
    
    // Keep current mappings to restore in case of error
    const previousMappings = { ...mappings };
    
    // Update the state with the filtered mappings (optimistic update)
    setMappings(filteredMappings);
    
    // Set saving state
    setIsSaving(true);
    setError(null);
    
    try {
      // Extract mappings for each requirement
      const requirementMappings: Record<string, string[]> = {};
      
      // Create a mapping of requirementId -> locationIds where value is true
      Object.entries(filteredMappings).forEach(([key, value]) => {
        if (!value) return; // Skip if not checked
        
        // Use the '___' separator to avoid conflicts with UUID format
        const [locationId, requirementId] = key.split('___');
        if (!locationId || !requirementId) return; // Skip invalid keys
        
        if (!requirementMappings[requirementId]) {
          requirementMappings[requirementId] = [];
        }
        
        requirementMappings[requirementId].push(locationId);
      });
      
      clientLogger.debug('Saving mappings to server', {
        mappingsCount: Object.keys(requirementMappings).length
      });
      
      // Use the main /api/dsx endpoint instead of a non-existent endpoint
      const response = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'mappings',  // Important: specify the type for the main endpoint
          serviceId: selectedService,
          data: requirementMappings
        }),
      });
      
      if (!response.ok) {
        // Restore previous mappings
        setMappings(previousMappings);
        const errorData = await response.json().catch(() => ({}));
        
        // Create a more detailed error message that includes validation details if available
        let errorMessage = errorData.error || 'Failed to save mappings';
        
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
        
        clientLogger.error('Error response from server', {
          error: errorData
        });
        throw new Error(errorMessage);
      }
      
      // Success response
      clientLogger.info('Mappings saved successfully');
    } catch (err) {
      clientLogger.error('Error saving mappings', {
        error: err.message
      });
      setError(`Failed to save mappings: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle availability changes from the requirements table
  const handleAvailabilityChange = async (updatedAvailability: Record<string, boolean>) => {
    if (!selectedService || isSaving) {
      clientLogger.warn('Cannot save: Service not selected or already saving');
      return;
    }
    
    clientLogger.debug('Received availability from table', {
      availabilityCount: Object.keys(updatedAvailability).length
    });
    
    // Filter out problematic location IDs
    const filteredAvailability: Record<string, boolean> = {};
    Object.entries(updatedAvailability).forEach(([locationId, value]) => {
      if (!IGNORED_LOCATION_IDS.has(locationId)) {
        filteredAvailability[locationId] = value;
      }
    });
    
    // Keep current availability to restore in case of error
    const previousAvailability = { ...availability };
    
    // Update the state with the filtered availability (optimistic update)
    setAvailability(filteredAvailability);
    
    // Set saving state
    setIsSaving(true);
    setError(null);
    
    try {    
      clientLogger.debug('Saving availability to server', {
        availabilityCount: Object.keys(filteredAvailability).length
      });
      
      // Use the main /api/dsx endpoint instead of the non-existent /api/dsx/availability endpoint
      const response = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'availability',  // Important: specify the type for the main endpoint
          serviceId: selectedService,
          data: filteredAvailability  // Use "data" property as expected by the main endpoint
        }),
      });
      
      if (!response.ok) {
        // Restore previous availability
        setAvailability(previousAvailability);
        const errorData = await response.json().catch(() => ({}));
        
        // Create a more detailed error message that includes validation details if available
        let errorMessage = errorData.error || 'Failed to save availability';
        
        if (errorData.skippedCount) {
          errorMessage += ` (${errorData.skippedCount} locations were invalid)`;
        }
        
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
        
        clientLogger.error('Error response from server', {
          error: errorData
        });
        throw new Error(errorMessage);
      }
      
      // Success response
      clientLogger.info('Availability saved successfully');
    } catch (err) {
      clientLogger.error('Error saving availability', {
        error: err.message
      });
      setError(`Failed to save availability: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Convert services to dropdown options
  const serviceOptions = services.map((service: any) => ({
    id: service.id,
    value: service.id,
    label: service.name
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data & Document Requirement Selection (DSX)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              Map data fields and documents to specific services and locations.
              Use the Data Rx tab to create new data fields and documents.
            </p>
            
            <div className="flex flex-col space-y-2">
              <label htmlFor="service-select" className="font-medium">
                Select a Service:
              </label>
              <div className="flex w-full max-w-md">
                <StandardDropdown
                  id="service-select"
                  options={serviceOptions}
                  value={selectedService}
                  onChange={handleServiceChange}
                  placeholder="Select a service to configure requirements"
                  disabled={isSaving || isSavingRequirements}
                />
              </div>
            </div>

            {selectedService && (
              <p className="text-sm text-gray-500">
                Configure the data fields and documents required for{' '}
                <span className="font-medium">{selectedServiceName}</span>.
              </p>
            )}

            {error && (
              <div className="px-4 py-3 rounded bg-red-50 text-red-500 border border-red-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>{error}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                    className="ml-4 text-sm"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
            
            {isSaving && (
              <div className="px-4 py-2 rounded bg-blue-50 text-blue-500 border border-blue-200">
                Saving changes...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Requirements Selection Section */}
      {selectedService && (
        <Card>
          <CardHeader>
            <CardTitle>Select Requirements for {selectedServiceName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Check or uncheck requirements to add or remove them from this service. Click "Apply Requirements" to save your changes.
              </p>

              {isLoadingRequirements ? (
                <div className="py-4">Loading available requirements...</div>
              ) : (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead key="requirements-thead" className="bg-gray-100">
                        <tr key="header-row">
                          <th key="select-header" className="p-2 text-left border-b">Select</th>
                          <th key="name-header" className="p-2 text-left border-b">Requirement</th>
                          <th key="type-header" className="p-2 text-left border-b">Type</th>
                          <th key="desc-header" className="p-2 text-left border-b">Description</th>
                        </tr>
                      </thead>
                      <tbody key="requirements-tbody">
                        {availableRequirements.length === 0 ? (
                          <tr key="no-requirements-row">
                            <td key="no-requirements-cell" colSpan={4} className="p-4 text-center text-gray-500">
                              No requirements available. Please create requirements in the Data Rx tab first.
                            </td>
                          </tr>
                        ) : (
                          availableRequirements.map((requirement) => (
                            <tr key={`requirement-${requirement.id}`} className="border-b hover:bg-gray-50">
                              <td key={`checkbox-cell-${requirement.id}`} className="p-3">
                                <Checkbox
                                  id={`req-${requirement.id}`}
                                  checked={selectedRequirementIds.includes(requirement.id)}
                                  onCheckedChange={(checked) => 
                                    handleRequirementToggle(requirement.id, checked === true)
                                  }
                                />
                              </td>
                              <td key={`name-cell-${requirement.id}`} className="p-3">
                                <label htmlFor={`req-${requirement.id}`} className="font-medium">
                                  {requirement.name || requirement.fieldLabel || requirement.documentName}
                                </label>
                              </td>
                              <td key={`type-cell-${requirement.id}`} className="p-3">
                                {requirement.type === 'field' && requirement.dataType
                                  ? (requirement.dataType === 'address_block'
                                      ? 'Address Block'
                                      : requirement.dataType === 'select'
                                      ? 'Dropdown'
                                      : requirement.dataType === 'radio'
                                      ? 'Radio'
                                      : requirement.dataType === 'checkbox'
                                      ? 'Checkbox'
                                      : requirement.dataType.charAt(0).toUpperCase() + requirement.dataType.slice(1))
                                  : 'Document'}
                              </td>
                              <td key={`desc-cell-${requirement.id}`} className="p-3 text-sm text-gray-600">
                                {requirement.description || requirement.instructions || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                        {availableRequirements.length > 0 && (
                          <tr key="footer-row" className="bg-gray-50">
                            <td key="footer-cell" colSpan={4} className="p-4">
                              <div className="flex flex-col items-center text-center">
                                <p className="mb-2 text-gray-700">
                                  <span className="font-semibold">{selectedRequirementIds.length}</span> requirement(s) selected.
                                </p>
                                <div className="flex items-center">
                                  <Button
                                    onClick={saveSelectedRequirements}
                                    disabled={isSavingRequirements}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                    size="sm"
                                  >
                                    {isSavingRequirements ? 'Saving...' : 'Apply Requirements'}
                                  </Button>
                                  {serviceRequirements.length > 0 && (
                                    <span className="ml-2 text-sm text-green-600">
                                      ✓ {serviceRequirements.length} currently applied
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field Display Order Section */}
      {selectedService && serviceRequirements.length > 0 && (
        <FieldOrderSection
          serviceId={selectedService}
          serviceName={selectedServiceName}
          requirements={serviceRequirements}
          onOrderChanged={() => {
            // Field order has been saved successfully
            clientLogger.info('Field order saved, refreshing data');
            // Refresh to get the updated display order from the database
            fetchDSXData(selectedService);
          }}
        />
      )}

      {selectedService && serviceRequirements.length > 0 && (
        <>
          {locations.length === 0 && (
            <div className="px-4 py-3 mb-4 rounded bg-red-50 text-red-700 border border-red-200">
              <p>Warning: No locations loaded. The table cannot display without location data.</p>
              <p className="text-sm mt-1">Locations count: {locations.length}</p>
            </div>
          )}
          <RequirementsDataTable
            serviceName={selectedServiceName}
            requirements={serviceRequirements}
            onMappingChange={handleMappingChange}
            initialMappings={mappings}
            serviceId={selectedService}
            onAvailabilityChange={handleAvailabilityChange}
            initialAvailability={availability}
            isLoading={isLoading}
            disabled={isSaving}
            locations={locations}
          />
        </>
      )}

      {selectedService && isSavingRequirements && (
        <div className="px-4 py-3 rounded bg-blue-50 text-blue-700 border border-blue-200">
          <div className="flex items-center">
            <div className="mr-2 inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
            <p>Saving requirements and refreshing data...</p>
          </div>
        </div>
      )}
      
      {selectedService && selectedRequirementIds.length > 0 && serviceRequirements.length === 0 && !isSavingRequirements && (
        <div className="px-4 py-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
          <p>
            You've selected requirements for this service, but they haven't been applied yet. 
            Click the "Apply Requirements" button above to see them in the location configuration table.
          </p>
          <div className="mt-2">
            <button 
              onClick={() => {
                // Refresh DSX data
                fetchDSXData(selectedService);
              }}
              className="text-sm underline text-blue-600 hover:text-blue-800"
            >
              Refresh Data
            </button>
          </div>
        </div>
      )}

      {selectedService && selectedRequirementIds.length === 0 && !isSavingRequirements && (
        <div className="px-4 py-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
          <p>
            No requirements have been selected for this service. 
            Please select requirements from the section above and click "Apply Requirements" to configure them by location.
          </p>
        </div>
      )}
    </div>
  );
}