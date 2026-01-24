// src/components/modules/global-config/tabs/dsx-tab.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { Button } from '@/components/ui/button';
import { Service, Requirement } from '@/types';
import { RequirementsDataTable } from '../tables/RequirementsDataTable';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle } from 'lucide-react';

// List of location IDs that cause problems - don't ignore Afghanistan (32c804e1)
const IGNORED_LOCATION_IDS = new Set([]);

export function DSXTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  
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
  
  // Use refs to track the service ID that we've already fetched data for
  const lastFetchedServiceRef = useRef<string | null>(null);
  const locationsLoadedRef = useRef(false);
  
  const { fetchWithAuth } = useAuth();
  
  // Load locations once at the DSX tab level
  useEffect(() => {
    if (locationsLoadedRef.current) return;
    
    const fetchLocations = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching locations for DSX tab...');
        
        const response = await fetchWithAuth('/api/locations');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch locations: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Loaded locations data:', {
          locationsCount: data?.length,
          firstLocation: data?.[0],
          data: data
        });
        setLocations(data);
        locationsLoadedRef.current = true;
        console.log('Successfully loaded locations in DSX tab');
      } catch (err) {
        console.error('Failed to load locations in DSX tab:', err);
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
        console.error('Error fetching services:', err);
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
        console.log('Fetching all available requirements...');
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
        const fields = (fieldsData.fields || []).map(field => ({
          ...field,
          type: 'field'
        }));
        
        const documents = (documentsData.documents || []).map(doc => ({
          ...doc,
          type: 'document'
        }));
        
        // Combine all requirements
        const allRequirements = [...fields, ...documents];
        console.log('All available requirements:', allRequirements.length);
        
        setAvailableRequirements(allRequirements);
      } catch (err) {
        console.error('Error fetching requirements:', err);
        setError('Failed to load requirements. Please try again.');
      } finally {
        setIsLoadingRequirements(false);
      }
    };
    
    fetchAllRequirements();
  }, [fetchWithAuth]);

  // Function to fetch DSX data for a specific service
  const fetchDSXData = useCallback(async (serviceId: string) => {
    // Skip if this is the service we've already fetched
    if (!serviceId || serviceId === lastFetchedServiceRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching DSX data for service: ${serviceId}`);
      
      // Use the URL with the service ID parameter
      const response = await fetchWithAuth(`/api/dsx?serviceId=${serviceId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch DSX data');
      }
      
      const data = await response.json();
      console.log("Received DSX data:", data);

      // Set the requirements associated with this service
      setServiceRequirements(data.requirements || []);
      
      // Process mappings
      const filteredMappings: Record<string, boolean> = {};
      Object.entries(data.mappings || {}).forEach(([key, value]) => {
        const [locationId] = key.split('-');
        if (!IGNORED_LOCATION_IDS.has(locationId)) {
          filteredMappings[key] = value === true;
        }
      });
      setMappings(filteredMappings);
      
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
      
      // Update the last fetched service ref
      lastFetchedServiceRef.current = serviceId;
    } catch (err) {
      console.error('Error fetching DSX data:', err);
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
    if (value !== lastFetchedServiceRef.current) {
      setServiceRequirements([]);
      setSelectedRequirementIds([]);
      setMappings({});
      setAvailability({});
      setError(null);
    }
  }, [services, isSaving]);

  // Load DSX data when service changes
  useEffect(() => {
    if (selectedService && selectedService !== lastFetchedServiceRef.current) {
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
    console.error("Cannot save: Service not selected or already saving");
    return;
  }
  
  // Keep current selected requirements to restore in case of error
  const previousSelectedRequirements = [...selectedRequirementIds];
  
  // Set saving state
  setIsSavingRequirements(true);
  setError(null);
  
  try {
    console.log('Saving selected requirement IDs:', selectedRequirementIds);
    
    // Create an array of requirement objects from the available requirements
    const requirementsToSave = selectedRequirementIds.map(id => {
      const requirement = availableRequirements.find(req => req.id === id);
      if (!requirement) {
        console.warn(`Requirement with ID ${id} not found in availableRequirements`);
        return null;
      }
      return requirement;
    }).filter(Boolean); // Remove any null values
    
    console.log('Requirements to save:', requirementsToSave);
    
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
    console.log('Save response:', responseData);
    
    // Refresh DSX data to get the updated requirements
    lastFetchedServiceRef.current = null; // Reset to force refresh
    await fetchDSXData(selectedService);
    
    // Success response
    console.log('Requirements saved successfully');
  } catch (err) {
    console.error('Error saving requirements:', err);
    setError(`Failed to save requirements: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setIsSavingRequirements(false);
  }
};

  // Handle mapping changes from the requirements table
  const handleMappingChange = async (updatedMappings: Record<string, boolean>) => {
    if (!selectedService || isSaving) {
      console.error("Cannot save: Service not selected or already saving");
      return;
    }
    
    console.log("Received mappings from table:", updatedMappings);
    
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
      
      console.log('Saving mappings to server:', requirementMappings);
      
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
        
        console.error('Error response from server:', errorData);
        throw new Error(errorMessage);
      }
      
      // Success response
      console.log('Mappings saved successfully');
    } catch (err) {
      console.error('Error saving mappings:', err);
      setError(`Failed to save mappings: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle availability changes from the requirements table
  const handleAvailabilityChange = async (updatedAvailability: Record<string, boolean>) => {
    if (!selectedService || isSaving) {
      console.error("Cannot save: Service not selected or already saving");
      return;
    }
    
    console.log("Received availability from table:", updatedAvailability);
    
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
      console.log('Saving availability to server:', filteredAvailability);
      
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
        
        console.error('Error response from server:', errorData);
        throw new Error(errorMessage);
      }
      
      // Success response
      console.log('Availability saved successfully');
    } catch (err) {
      console.error('Error saving availability:', err);
      setError(`Failed to save availability: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Convert services to dropdown options
  const serviceOptions = services.map(service => ({
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
                                {requirement.type.charAt(0).toUpperCase() + requirement.type.slice(1)}
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
                // Force refresh of DSX data
                lastFetchedServiceRef.current = null;
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