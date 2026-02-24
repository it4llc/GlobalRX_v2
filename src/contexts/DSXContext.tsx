// src/contexts/DSXContext.tsx
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

// Define the types based on the schema
export interface Requirement {
  id: string;
  name: string;
  type: 'field' | 'document' | 'form';
  serviceId: string;
  field?: {
    id: string;
    fieldLabel: string;
    shortName: string;
    dataType: string;
    instructions?: string;
    retentionHandling?: string;
  };
  document?: {
    id: string;
    documentName: string;
    instructions?: string;
    scope: string;
    retentionHandling?: string;
  };
  form?: any; // Placeholder for future form data structure
}

// Define types for field and document data for creation
export interface FieldData {
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
}

export interface DocumentData {
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling: string;
}

// Interface for the context
interface DSXContextType {
  // Data
  selectedService: string | null;
  selectedServiceName: string;
  requirements: Requirement[];
  mappings: Record<string, boolean>;
  availability: Record<string, boolean>;
  
  // Loading and error states
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  
  // Methods for service selection
  selectService: (serviceId: string, serviceName: string) => void;
  
  // Methods for requirements
  addField: (data: FieldData) => Promise<boolean>;
  addDocument: (data: DocumentData) => Promise<boolean>;
  
  // Methods for mappings and availability
  updateMappings: (newMappings: Record<string, boolean>) => Promise<boolean>;
  updateAvailability: (newAvailability: Record<string, boolean>) => Promise<boolean>;
  cancelChanges: () => void;
  saveChanges: () => Promise<boolean>;
}

// Create the context with default values
const DSXContext = createContext<DSXContextType>({
  selectedService: null,
  selectedServiceName: '',
  requirements: [],
  mappings: {},
  availability: {},
  isLoading: false,
  isSaving: false,
  hasUnsavedChanges: false,
  error: null,
  selectService: () => {},
  addField: async () => false,
  addDocument: async () => false,
  updateMappings: async () => false,
  updateAvailability: async () => false,
  cancelChanges: () => {},
  saveChanges: async () => false,
});

// List of location IDs to be ignored in mappings and availability
// Removed Afghanistan ID (32c804e1) from ignored list to fix saving issues
const IGNORED_LOCATION_IDS = new Set(['all', 'ALL']);

// Provider component
export function DSXProvider({ children }: { children: React.ReactNode }) {
  // Get auth and locations from their contexts
  const { fetchWithAuth, isAuthenticated } = useAuth();
  const { allLocationsLoaded } = useLocations();
  
  // Service selection
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedServiceName, setSelectedServiceName] = useState('');
  
  // DSX data
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [mappings, setMappings] = useState<Record<string, boolean>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  
  // Temporary data for local editing (for save/cancel feature)
  const [localMappings, setLocalMappings] = useState<Record<string, boolean>>({});
  const [localAvailability, setLocalAvailability] = useState<Record<string, boolean>>({});
  
  // Status tracking
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Track the last loaded service for optimizations
  const [lastLoadedService, setLastLoadedService] = useState<string | null>(null);
  
  // Load data for a service
  const loadServiceData = useCallback(async (serviceId: string) => {
    // Skip if same service or not authenticated
    if (serviceId === lastLoadedService || !isAuthenticated) {
      return;
    }
    
    // Wait for locations to be loaded first
    if (!allLocationsLoaded) {
      return;
    }
    
    // Set loading and clear errors
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch data from API
      const response = await fetchWithAuth(`/api/dsx?serviceId=${serviceId}&type=all`);
      
      if (!response.ok) {
        throw new Error(`Failed to load DSX data: ${response.status} ${response.statusText}`);
      }
      
      // Parse response
      const data = await response.json();
      
      // Set requirements (empty array if not available)
      setRequirements(data.requirements || []);
      
      // Process mappings (empty object if not available)
      const processedMappings: Record<string, boolean> = {};
      if (data.mappings && typeof data.mappings === 'object') {
        Object.entries(data.mappings).forEach(([key, value]) => {
          // Check for old format (hyphen separator) or new format (triple underscore)
          const separator = key.includes('___') ? '___' : '-';
          const [locationId] = key.split(separator);
          
          if (!IGNORED_LOCATION_IDS.has(locationId)) {
            // Convert to new format with triple underscore separator
            if (separator === '-' && key.includes('-')) {
              // Split the original key to get locationId and requirementId
              const [locId, reqId] = key.split('-');
              // Create new key with triple underscore format
              const newKey = `${locId}___${reqId}`;
              processedMappings[newKey] = value === true;
            } else {
              // Already using new format or doesn't contain a separator
              processedMappings[key] = value === true;
            }
          }
        });
      }
      setMappings(processedMappings);
      setLocalMappings(processedMappings);
      
      // Process availability (empty object if not available)
      const processedAvailability: Record<string, boolean> = {};
      if (data.availability && typeof data.availability === 'object') {
        Object.entries(data.availability).forEach(([locationId, value]) => {
          if (!IGNORED_LOCATION_IDS.has(locationId)) {
            processedAvailability[locationId] = value === true;
          }
        });
      }
      setAvailability(processedAvailability);
      setLocalAvailability(processedAvailability);
      
      // Mark as loaded successfully
      setLastLoadedService(serviceId);
      setDataLoaded(true);
      setHasUnsavedChanges(false);
    } catch (err) {
      clientLogger.error('Failed to load DSX data', {
        serviceId,
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });

      // Handle empty table cases - initialize with empty objects
      setRequirements([]);
      setMappings({});
      setLocalMappings({});
      setAvailability({});
      setLocalAvailability({});

      // Show error but still mark as loaded to prevent repeated attempts
      setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLastLoadedService(serviceId);
      setDataLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, lastLoadedService, isAuthenticated, allLocationsLoaded]);
  
  // Select a service
  const selectService = useCallback((serviceId: string, serviceName: string) => {
    setSelectedService(serviceId);
    setSelectedServiceName(serviceName);
    
    // Reset any unsaved changes
    setHasUnsavedChanges(false);
    
    // Load service data
    if (serviceId !== lastLoadedService) {
      loadServiceData(serviceId);
    }
  }, [lastLoadedService, loadServiceData]);
  
  // Reload data if authentication state changes
  useEffect(() => {
    if (isAuthenticated && selectedService && selectedService !== lastLoadedService) {
      loadServiceData(selectedService);
    }
  }, [isAuthenticated, selectedService, lastLoadedService, loadServiceData]);
  
  // Add a new field requirement
  const addField = useCallback(async (data: FieldData): Promise<boolean> => {
    if (!selectedService) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create requirement object
      const newRequirement: Requirement = {
        id: '', // Will be set by server
        name: data.fieldLabel,
        type: 'field',
        serviceId: selectedService,
        field: {
          id: '',
          fieldLabel: data.fieldLabel,
          shortName: data.shortName,
          dataType: data.dataType,
          instructions: data.instructions,
          retentionHandling: data.retentionHandling
        }
      };
      
      // Send to API
      const response = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        body: JSON.stringify({
          type: 'requirement',
          serviceId: selectedService,
          data: newRequirement
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save field: ${response.status} ${response.statusText}`);
      }
      
      // Get server response for ID
      const result = await response.json();
      
      // Update requirement with generated ID
      if (result.requirementId) {
        newRequirement.id = result.requirementId;
      } else {
        // Use a temporary ID if server didn't provide one
        newRequirement.id = `temp-${Date.now()}`;
      }
      
      // Add to local state
      setRequirements(prev => [...prev, newRequirement]);
      
      return true;
    } catch (err) {
      clientLogger.error('Failed to add DSX field requirement', {
        serviceId: selectedService,
        fieldLabel: data.fieldLabel,
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(`Failed to add field: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedService, fetchWithAuth]);
  
  // Add a new document requirement
  const addDocument = useCallback(async (data: DocumentData): Promise<boolean> => {
    if (!selectedService) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create requirement object
      const newRequirement: Requirement = {
        id: '', // Will be set by server
        name: data.documentName,
        type: 'document',
        serviceId: selectedService,
        document: {
          id: '',
          documentName: data.documentName,
          instructions: data.instructions,
          scope: data.scope,
          retentionHandling: data.retentionHandling
        }
      };
      
      // Send to API
      const response = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        body: JSON.stringify({
          type: 'requirement',
          serviceId: selectedService,
          data: newRequirement
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save document: ${response.status} ${response.statusText}`);
      }
      
      // Get server response for ID
      const result = await response.json();
      
      // Update requirement with generated ID
      if (result.requirementId) {
        newRequirement.id = result.requirementId;
      } else {
        // Use a temporary ID if server didn't provide one
        newRequirement.id = `temp-${Date.now()}`;
      }
      
      // Add to local state
      setRequirements(prev => [...prev, newRequirement]);
      
      return true;
    } catch (err) {
      clientLogger.error('Failed to add DSX document requirement', {
        serviceId: selectedService,
        documentName: data.documentName,
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(`Failed to add document: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedService, fetchWithAuth]);
  
  // Update mappings locally (without saving to server)
  const updateMappings = useCallback((newMappings: Record<string, boolean>): Promise<boolean> => {
    // Filter out ignored location IDs
    const filteredMappings: Record<string, boolean> = {};
    Object.entries(newMappings).forEach(([key, value]) => {
      // Check for old format (hyphen separator) or new format (triple underscore)
      const separator = key.includes('___') ? '___' : '-';
      const [locationId] = key.split(separator);
      
      if (!IGNORED_LOCATION_IDS.has(locationId)) {
        // Convert to new format with triple underscore separator if needed
        if (separator === '-' && key.includes('-')) {
          const [locId, reqId] = key.split('-');
          const newKey = `${locId}___${reqId}`;
          filteredMappings[newKey] = value;
        } else {
          filteredMappings[key] = value;
        }
      }
    });
    
    // Update local state
    setLocalMappings(filteredMappings);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    return Promise.resolve(true);
  }, []);
  
  // Update availability locally (without saving to server)
  const updateAvailability = useCallback((newAvailability: Record<string, boolean>): Promise<boolean> => {
    // Filter out ignored location IDs
    const filteredAvailability: Record<string, boolean> = {};
    Object.entries(newAvailability).forEach(([locationId, value]) => {
      if (!IGNORED_LOCATION_IDS.has(locationId)) {
        filteredAvailability[locationId] = value;
      }
    });
    
    // Update local state
    setLocalAvailability(filteredAvailability);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);
    
    return Promise.resolve(true);
  }, []);
  
  // Cancel local changes
  const cancelChanges = useCallback(() => {
    // Revert to original data
    setLocalMappings({...mappings});
    setLocalAvailability({...availability});
    
    // Reset unsaved changes flag
    setHasUnsavedChanges(false);
  }, [mappings, availability]);
  
  // Save changes to server
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!selectedService || !hasUnsavedChanges) return false;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Process mappings to the format expected by the API
      const requirementMappings: Record<string, string[]> = {};
      
      // Create a mapping of requirementId -> locationIds where value is true
      Object.entries(localMappings).forEach(([key, value]) => {
        if (!value) return; // Skip if not checked
        
        // Check for old format (hyphen separator) or new format (triple underscore)
        const separator = key.includes('___') ? '___' : '-';
        const parts = key.split(separator);
        
        // For new format with triple underscore, we need to get the locationId and requirementId
        const locationId = parts[0];
        const requirementId = parts[1];
        
        if (!locationId || !requirementId || IGNORED_LOCATION_IDS.has(locationId)) return;
        
        if (!requirementMappings[requirementId]) {
          requirementMappings[requirementId] = [];
        }
        
        requirementMappings[requirementId].push(locationId);
      });
      
      // Save mappings
      const mappingsResponse = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        body: JSON.stringify({
          type: 'mappings',
          serviceId: selectedService,
          data: requirementMappings
        }),
      });
      
      if (!mappingsResponse.ok) {
        throw new Error(`Failed to save mappings: ${mappingsResponse.status} ${mappingsResponse.statusText}`);
      }
      
      // Save availability
      const availabilityResponse = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        body: JSON.stringify({
          type: 'availability',
          serviceId: selectedService,
          data: localAvailability
        }),
      });
      
      if (!availabilityResponse.ok) {
        throw new Error(`Failed to save availability: ${availabilityResponse.status} ${availabilityResponse.statusText}`);
      }
      
      // Update main state with local changes
      setMappings({...localMappings});
      setAvailability({...localAvailability});
      
      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      
      return true;
    } catch (err) {
      clientLogger.error('Failed to save DSX changes', {
        serviceId: selectedService,
        mappingsCount: Object.keys(localMappings).length,
        availabilityCount: Object.keys(localAvailability).length,
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(`Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedService, hasUnsavedChanges, localMappings, localAvailability, fetchWithAuth]);
  
  // Context value
  const contextValue: DSXContextType = {
    selectedService,
    selectedServiceName,
    requirements,
    mappings: localMappings, // Use local mappings for display/editing
    availability: localAvailability, // Use local availability for display/editing
    isLoading,
    isSaving,
    hasUnsavedChanges,
    error,
    selectService,
    addField,
    addDocument,
    updateMappings,
    updateAvailability,
    cancelChanges,
    saveChanges,
  };
  
  return (
    <DSXContext.Provider value={contextValue}>
      {children}
    </DSXContext.Provider>
  );
}

// Hook for consuming the context
export function useDSX() {
  return useContext(DSXContext);
}