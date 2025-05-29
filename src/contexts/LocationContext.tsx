// src/contexts/LocationContext.tsx
'use client';

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Define the Location interface based on your schema
export interface Location {
  id: string;
  name: string;
  code2: string;
  code3: string;
  numeric?: string | null;
  subregion1?: string | null;
  subregion2?: string | null;
  subregion3?: string | null;
  disabled?: boolean | null;
  parentId?: string | null;
  // Fields to handle hierarchy in UI
  children?: Location[];
  expanded?: boolean;
}

// Define the context state
interface LocationContextType {
  locations: Location[];
  hierarchicalLocations: Location[];
  isLoading: boolean;
  error: string | null;
  forceRefresh: () => void;
  getLocationById: (id: string) => Location | undefined;
  getChildLocations: (parentId: string) => Location[];
  allLocationsMap: Map<string, Location>;
  allLocationsLoaded: boolean;
}

// Create context with default values
const LocationContext = createContext<LocationContextType>({
  locations: [],
  hierarchicalLocations: [],
  isLoading: true,
  error: null,
  forceRefresh: () => {},
  getLocationById: () => undefined,
  getChildLocations: () => [],
  allLocationsMap: new Map(),
  allLocationsLoaded: false
});

// Maximum number of retries for fetching locations
const MAX_RETRIES = 3;

// Provider component
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [hierarchicalLocations, setHierarchicalLocations] = useState<Location[]>([]);
  const [allLocationsMap, setAllLocationsMap] = useState<Map<string, Location>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allLocationsLoaded, setAllLocationsLoaded] = useState(false);
  
  // Track fetch attempts to avoid infinite loops
  const fetchAttemptsRef = useRef(0);
  const isFetchingRef = useRef(false);
  
  // Get authentication session
  const { data: session, status } = useSession();
  const sessionLoaded = status !== 'loading';
  
  const router = useRouter();

  // Function to organize locations into a hierarchical structure
  const organizeLocationsHierarchy = useCallback((locationsList: Location[]) => {
    // Create a new map for organizing by ID
    const locationsMap = new Map<string, Location>();
    
    // First pass: create location objects with empty children arrays
    locationsList.forEach(location => {
      locationsMap.set(location.id, { ...location, children: [] });
    });
    
    // Second pass: build the hierarchy
    const rootLocations: Location[] = [];
    
    locationsList.forEach(location => {
      const locationWithChildren = locationsMap.get(location.id);
      
      if (!locationWithChildren) return;
      
      if (location.parentId && locationsMap.has(location.parentId)) {
        // This is a child location - add to its parent
        const parent = locationsMap.get(location.parentId);
        if (parent && parent.children) {
          parent.children.push(locationWithChildren);
        }
      } else {
        // This is a root location (likely a country)
        rootLocations.push(locationWithChildren);
      }
    });
    
    // Sort root locations alphabetically
    rootLocations.sort((a, b) => a.name.localeCompare(b.name));
    
    // Set the processed data
    setHierarchicalLocations(rootLocations);
    
    // Update all locations map for quick lookups
    setAllLocationsMap(locationsMap);
    
    return rootLocations;
  }, []);

  // Fetch locations with retry logic
  const fetchLocations = useCallback(async (retryCount = 0) => {
    // Avoid concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    // Don't exceed max retries
    if (retryCount >= MAX_RETRIES) {
      setError("Failed to load locations after multiple attempts. Please refresh the page.");
      setIsLoading(false);
      isFetchingRef.current = false;
      return;
    }
    
    try {
      // Clear previous errors
      setError(null);
      setIsLoading(true);
      fetchAttemptsRef.current += 1;
      
      // Make the API request
      const response = await fetch('/api/locations');
      
      if (!response.ok) {
        if (response.status === 401) {
          // Authentication error - wait for session to load or retry
          if (sessionLoaded && !session) {
            // If session is confirmed not available, don't retry immediately
            // It will retry automatically when session becomes available
            console.warn('Authentication required for locations');
            isFetchingRef.current = false;
            return;
          }
          
          // Retry with delay
          setTimeout(() => {
            isFetchingRef.current = false;
            fetchLocations(retryCount + 1);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }
        
        throw new Error(`Failed to fetch locations: ${response.status} ${response.statusText}`);
      }
      
      // Parse the response
      const data = await response.json();
      
      // Check if we have valid data
      if (!Array.isArray(data)) {
        throw new Error('Invalid locations data received');
      }
      
      // Store the raw locations list
      setLocations(data);
      
      // Process into hierarchy
      organizeLocationsHierarchy(data);
      
      // Mark success
      setAllLocationsLoaded(true);
      fetchAttemptsRef.current = 0;
      
      console.log('Successfully loaded locations:', data.length);
    } catch (err) {
      console.error('Error fetching locations:', err);
      
      // Handle error and retry
      setError(`Failed to load locations data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Retry with exponential backoff
      setTimeout(() => {
        isFetchingRef.current = false;
        fetchLocations(retryCount + 1);
      }, 1000 * (retryCount + 1));
      
      return;
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [session, sessionLoaded, organizeLocationsHierarchy]);

  // Fetch locations when auth is available
  useEffect(() => {
    // Wait for session to be available (either logged in or confirmed not logged in)
    if (!sessionLoaded) return;
    
    // If locations are already loaded, don't fetch again
    if (allLocationsLoaded) return;
    
    // If no session, don't fetch yet - wait for login
    if (!session) return;
    
    // Fetch locations data
    fetchLocations();
  }, [fetchLocations, session, sessionLoaded, allLocationsLoaded]);

  // Force refresh locations data
  const forceRefresh = useCallback(() => {
    setAllLocationsLoaded(false);
    fetchAttemptsRef.current = 0;
    fetchLocations();
  }, [fetchLocations]);

  // Helper to get a location by ID
  const getLocationById = useCallback(
    (id: string) => allLocationsMap.get(id),
    [allLocationsMap]
  );

  // Helper to get child locations
  const getChildLocations = useCallback(
    (parentId: string) => {
      const children: Location[] = [];
      allLocationsMap.forEach(location => {
        if (location.parentId === parentId) {
          children.push(location);
        }
      });
      return children;
    },
    [allLocationsMap]
  );

  // Context value
  const contextValue = {
    locations,
    hierarchicalLocations,
    isLoading,
    error,
    forceRefresh,
    getLocationById,
    getChildLocations,
    allLocationsMap,
    allLocationsLoaded
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
}

// Hook for consuming the context
export function useLocations() {
  return useContext(LocationContext);
}