// src/components/modules/global-config/locations/locations-tab.tsx
'use client';

import { useState, useEffect } from 'react';
import { LocationForm } from './location-form';
import { LocationsTable } from './locations-table';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

export function LocationsTab() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  
  // Use the auth context
  const { fetchWithAuth } = useAuth();
  // Add translation hook
  const { t } = useTranslation();

  // Fetch locations on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchLocations();
  }, [refreshTrigger, showDisabled]);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      // Use translation for debug message
      setDebugInfo(t('locations.fetching'));
      
      // Use the authenticated fetch function
      const response = await fetchWithAuth(`/api/locations${showDisabled ? '?includeDisabled=true' : ''}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        setDebugInfo(`${t('locations.apiError')}: ${response.status} - ${errorText}`);
        throw new Error(`${t('locations.fetchFailed')}: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Locations data received:", data);
      setDebugInfo(`${t('locations.received')} ${data.length} ${t('locations.locationsLabel')}`);
      
      setLocations(data);
      setError(null);
    } catch (err) {
      // Don't set the error if it's a session error (already handled by AuthInterceptor)
      if (err.message !== "Session expired") {
        console.error('Error fetching locations:', err);
        setError(t('locations.loadError'));
        setDebugInfo(`${t('common.error')}: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationAdded = () => {
    // Trigger a refresh of the locations list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t('config.locations.title')}</h2>
      
      <LocationForm onLocationAdded={handleLocationAdded} />
      
      <div className="mt-8">
        <div className="flex justify-between mb-4">
          <div className="text-xs font-mono bg-gray-100 p-2 rounded">
            {debugInfo}
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showDisabled"
              checked={showDisabled}
              onChange={() => setShowDisabled(!showDisabled)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showDisabled" className="ml-2 text-sm text-gray-700">
              {t('locations.showDisabled')}
            </label>
          </div>
        </div>
      
        <LocationsTable 
          locations={locations}
          isLoading={isLoading}
          error={error}
          onRefresh={handleLocationAdded}
        />
      </div>
    </div>
  );
}