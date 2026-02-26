// src/components/modules/global-config/tabs/dsx-tab.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Service, Requirement } from '@/types';
import { RequirementsDataTable } from '../tables/RequirementsDataTable';
import { FieldOrderSection } from './FieldOrderSection';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useDsxTab } from '@/hooks/useDsxTab';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/client-logger';

// Helper function to format data type labels
function getDataTypeLabel(dataType: string): string {
  const typeLabels: Record<string, string> = {
    'text': 'Text',
    'number': 'Number',
    'date': 'Date',
    'select': 'Select',
    'checkbox': 'Checkbox',
    'radio': 'Radio',
    'textarea': 'Text Area',
    'email': 'Email',
    'phone': 'Phone',
    'url': 'URL',
    'file': 'File Upload'
  };
  return typeLabels[dataType] || dataType;
}

export function DSXTab() {
  // Use the new DSX hook for all business logic
  const {
    selectedService,
    services,
    locations,
    requirements,
    locationRequirements,
    locationAvailability,
    isLoading,
    isSaving,
    error,
    successMessage,
    handleServiceSelect,
    handleAvailabilityToggle,
    handleRequirementToggle,
    handleSave,
  } = useDsxTab();

  const { fetchWithAuth } = useAuth();

  // Local UI state
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [availableRequirements, setAvailableRequirements] = useState<any[]>([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);

  // Fetch all available requirements from Data RX tab on mount
  useEffect(() => {
    const fetchAllRequirements = async () => {
      setIsLoadingRequirements(true);

      try {
        // Make parallel requests to fetch data fields and documents
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
        setAvailableRequirements(allRequirements);
      } catch (err) {
        logger.error('Error fetching requirements:', { error: err });
      } finally {
        setIsLoadingRequirements(false);
      }
    };

    fetchAllRequirements();
  }, [fetchWithAuth]);

  // Update selected requirement IDs when requirements from hook change or service changes
  useEffect(() => {
    if (requirements && requirements.length > 0) {
      setSelectedRequirementIds(requirements.map(req => req.id));
    } else if (!selectedService) {
      // Clear when no service is selected
      setSelectedRequirementIds([]);
    }
  }, [requirements, selectedService]);

  // Merge the requirements from DSX with the full data from Data RX to get complete field info
  const enrichedRequirements = requirements.map(req => {
    // Find the full requirement data from availableRequirements
    const fullReq = availableRequirements.find(ar => ar.id === req.id);
    return fullReq ? { ...req, ...fullReq } : req;
  });

  // Handle service selection change
  const handleServiceChange = useCallback(async (value: string) => {
    if (isSaving) return;

    // Find the service name for UI display
    const service = services.find(s => s.id === value);
    if (service) {
      setSelectedServiceName(service.name);
    }

    // Update the hook's state
    await handleServiceSelect(value);
  }, [services, isSaving, handleServiceSelect]);

  // Handle requirement selection in the UI
  const handleRequirementSelection = useCallback((requirementId: string, checked: boolean) => {
    setSelectedRequirementIds(prev => {
      const newIds = checked
        ? [...prev, requirementId]
        : prev.filter(id => id !== requirementId);

      logger.info('Requirement selection changed', {
        requirementId,
        checked,
        totalSelected: newIds.length
      });

      return newIds;
    });
  }, []);

  // Handle bulk selection of all requirements
  const handleSelectAllRequirements = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedRequirementIds(availableRequirements.map(req => req.id));
    } else {
      setSelectedRequirementIds([]);
    }
  }, [availableRequirements]);

  // Apply selected requirements to the service
  const handleApplyRequirements = useCallback(async () => {
    if (!selectedService || selectedRequirementIds.length === 0) {
      return;
    }

    setIsSavingRequirements(true);
    logger.info('Applying requirements to service', {
      serviceId: selectedService,
      requirementIds: selectedRequirementIds,
      count: selectedRequirementIds.length
    });

    try {
      // Filter requirements to get only those that are selected
      const requirementsToApply = availableRequirements.filter(req =>
        selectedRequirementIds.includes(req.id)
      );

      // Use the /api/dsx/associate-requirements endpoint to associate requirements
      // The API expects the full requirement objects, not just IDs
      const payload = {
        serviceId: selectedService,
        requirements: requirementsToApply
      };

      const response = await fetchWithAuth('/api/dsx/associate-requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseData = await response.json();
        logger.error('Failed to apply requirements', {
          status: response.status,
          error: responseData
        });
        throw new Error(responseData.error || 'Failed to apply requirements');
      }

      const result = await response.json();
      logger.info('Requirements applied successfully', { result });

      // Add a small delay to ensure backend has processed the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh to show the updated data
      await handleServiceSelect(selectedService);

    } catch (err: any) {
      logger.error('Error applying requirements to service:', { error: err });
    } finally {
      setIsSavingRequirements(false);
    }
  }, [selectedService, selectedRequirementIds, availableRequirements, fetchWithAuth, handleServiceSelect]);

  // Handle mapping changes from the data table (legacy compatibility)
  const handleMappingChange = useCallback((mappingKey: string, checked: boolean) => {
    // Parse the legacy mapping key format
    const [locationId, requirementId] = mappingKey.split('___');
    handleRequirementToggle(locationId, requirementId);
  }, [handleRequirementToggle]);

  // Handle availability changes from the data table (legacy compatibility)
  const handleAvailabilityChange = useCallback((locationId: string, checked: boolean) => {
    handleAvailabilityToggle(locationId);
  }, [handleAvailabilityToggle]);

  // Convert hook data to legacy format for RequirementsDataTable
  const legacyMappings = Object.entries(locationRequirements).reduce((acc, [locationId, reqIds]) => {
    reqIds.forEach(reqId => {
      acc[`${locationId}___${reqId}`] = true;
    });
    return acc;
  }, {} as Record<string, boolean>);

  // Handle field order changes (refresh DSX data)
  const handleFieldOrderChange = useCallback(() => {
    if (selectedService) {
      handleServiceSelect(selectedService);
    }
  }, [selectedService, handleServiceSelect]);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Service Selection Card */}
      <Card className="w-full min-w-0">
        <CardHeader>
          <CardTitle>Data & Document Requirement Selection</CardTitle>
        </CardHeader>
        <CardContent className="min-h-[200px]">
          <div className="space-y-4 w-full">
            <p className="text-sm text-gray-600 mb-4">
              Select a service to configure its data and document requirements across different locations.
            </p>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Service
              </label>
              <div className="max-w-md">
                <StandardDropdown
                  id="service-selector"
                  options={services.map(s => ({ id: s.id, value: s.id, label: s.name }))}
                  value={selectedService || ''}
                  onChange={handleServiceChange}
                  placeholder="Choose a service..."
                  disabled={isLoading || isSaving}
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center p-4 rounded-md bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
                <div className="text-red-700">{error}</div>
              </div>
            )}

            {/* Success Display */}
            {successMessage && (
              <div className="flex items-center p-4 rounded-md bg-green-50 border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                <div className="text-green-700">{successMessage}</div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600">Loading configuration...</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Requirements Selection Section */}
      {selectedService && !isLoading && (
        <Card className="w-full">
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
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left border-b">
                            <Checkbox
                              checked={selectedRequirementIds.length === availableRequirements.length && availableRequirements.length > 0}
                              onCheckedChange={handleSelectAllRequirements}
                            />
                          </th>
                          <th className="p-2 text-left border-b">Label</th>
                          <th className="p-2 text-left border-b">Short Name</th>
                          <th className="p-2 text-left border-b">Type</th>
                          <th className="p-2 text-left border-b">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableRequirements.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-500">
                              No requirements available. Please create requirements in the Data RX tab first.
                            </td>
                          </tr>
                        ) : (
                          availableRequirements.map((req) => (
                            <tr key={req.id} className="hover:bg-gray-50">
                              <td className="p-2 border-b">
                                <Checkbox
                                  checked={selectedRequirementIds.includes(req.id)}
                                  onCheckedChange={(checked) => handleRequirementSelection(req.id, !!checked)}
                                />
                              </td>
                              <td className="p-2 border-b">
                                {req.type === 'field'
                                  ? (req.fieldLabel || req.name || 'Unnamed Field')
                                  : (req.documentName || req.name || 'Unnamed Document')}
                              </td>
                              <td className="p-2 border-b text-sm font-mono">
                                {req.type === 'field'
                                  ? (req.shortName || '-')
                                  : '-'}
                              </td>
                              <td className="p-2 border-b">
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
                                  {req.type === 'field'
                                    ? getDataTypeLabel(req.dataType || 'text')
                                    : 'Document'}
                                </span>
                              </td>
                              <td className="p-2 border-b text-sm text-gray-600">
                                {req.type === 'field'
                                  ? (req.instructions || req.description || '-')
                                  : (req.description || '-')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleApplyRequirements}
                      disabled={selectedRequirementIds.length === 0 || isSavingRequirements}
                      variant="default"
                    >
                      {isSavingRequirements ? (
                        <>
                          <div className="mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Applying...
                        </>
                      ) : (
                        'Apply Requirements'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field Order Section */}
      {selectedService && enrichedRequirements.length > 0 && (
        <FieldOrderSection
          serviceId={selectedService}
          serviceName={selectedServiceName}
          requirements={enrichedRequirements as Requirement[]}
          onOrderChanged={handleFieldOrderChange}
        />
      )}

      {/* Requirements Matrix */}
      {selectedService && enrichedRequirements.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Location Requirements Matrix</CardTitle>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              variant="default"
            >
              {isSaving ? (
                <>
                  <div className="mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <div className="px-4 py-3 mb-4 rounded bg-red-50 text-red-700 border-red-200">
                <p>Warning: No locations loaded. The table cannot display without location data.</p>
              </div>
            ) : (
              <RequirementsDataTable
                serviceName={selectedServiceName}
                requirements={enrichedRequirements as Requirement[]}
                onMappingChange={handleMappingChange}
                initialMappings={legacyMappings}
                serviceId={selectedService}
                onAvailabilityChange={handleAvailabilityChange}
                initialAvailability={locationAvailability}
                isLoading={isLoading}
                disabled={isSaving}
                locations={locations}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Info message when service selected but no requirements */}
      {selectedService && requirements.length === 0 && !isLoading && (
        <div className="px-4 py-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
          <p>
            No requirements have been applied to this service yet.
            Please select requirements from the section above and click "Apply Requirements" to configure them by location.
          </p>
        </div>
      )}
    </div>
  );
}