'use client';
// src/components/modules/global-config/locations/location-form.tsx
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function LocationForm({ onLocationAdded }) {
  // Location type selection
  const [locationType, setLocationType] = useState('country');
  
  // Selected parent locations
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedSubregion1, setSelectedSubregion1] = useState(null);
  const [selectedSubregion2, setSelectedSubregion2] = useState(null);
  
  // Lists for dropdowns
  const [countries, setCountries] = useState([]);
  const [subregions1, setSubregions1] = useState([]);
  const [subregions2, setSubregions2] = useState([]);
  
  // New location data
  const [formData, setFormData] = useState({
    countryName: '',
    twoLetter: '',
    threeLetter: '',
    numeric: '',
    subregion1: '',
    subregion2: '',
    subregion3: '',
  });
  
  // Form state
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [importStatus, setImportStatus] = useState({ loading: false, message: '', error: false });
  
  // Use the auth context
  const { fetchWithAuth } = useAuth();
  

  // Load countries on component mount
  useEffect(() => {
    fetchCountries();
  }, []);
  
  // Load subregions when parent is selected
  useEffect(() => {
    if (selectedCountry && (locationType === 'subregion1' || locationType === 'subregion2' || locationType === 'subregion3')) {
      fetchSubregions1(selectedCountry.id);
    }
  }, [selectedCountry, locationType]);
  
  useEffect(() => {
    if (selectedSubregion1 && (locationType === 'subregion2' || locationType === 'subregion3')) {
      fetchSubregions2(selectedSubregion1.id);
    }
  }, [selectedSubregion1, locationType]);
  
  // Fetch all countries (top-level locations)
  const fetchCountries = async () => {
    try {
      setIsLoadingOptions(true);
      const response = await fetchWithAuth('/api/locations?type=countries');
      if (!response.ok) {
        throw new Error('Failed to fetch countries');
      }
      const data = await response.json();
      setCountries(data);
    } catch (error: unknown) {
      clientLogger.error('Error fetching countries:', error);
      setFormError('Failed to load countries. Please try refreshing the page.');
    } finally {
      setIsLoadingOptions(false);
    }
  };
  
  // Fetch subregions1 for a specific country
  const fetchSubregions1 = async (countryId) => {
    try {
      setIsLoadingOptions(true);
      // setDebug(`Fetching subregions1 for country ID: ${countryId}`);
      
      const response = await fetchWithAuth(`/api/locations?type=subregions1&parentId=${countryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subregions');
      }
      
      const data = await response.json();
      // setDebug(`Received ${data.length} subregions1: ${JSON.stringify(data.slice(0, 2))}`);
      
      // Filter out any records that don't have parentId matching the selected country
      // This is to handle the API returning all countries instead of subregions
      const filteredData = data.filter(item => 
        item.parentId === countryId || 
        // Include items that have a subregion1 value set (they're actual subregions)
        (item.parentId === null && item.subregion1)
      );
      
      // setDebug(`Filtered to ${filteredData.length} valid subregions1`);
      
      // If we have no valid subregions after filtering, we need to show a message
      if (filteredData.length === 0) {
        setSubregions1([]);
      } else {
        setSubregions1(filteredData);
      }
    } catch (error: unknown) {
      clientLogger.error('Error fetching subregions1:', error);
      setFormError('Failed to load subregions. Please try refreshing the page.');
      // setDebug(`Error: ${error.message}`);
    } finally {
      setIsLoadingOptions(false);
    }
  };
  
  // Fetch subregions2 for a specific subregion1
  const fetchSubregions2 = async (subregion1Id) => {
    try {
      setIsLoadingOptions(true);
      // setDebug(`Fetching subregions2 for subregion1 ID: ${subregion1Id}`);
      
      const response = await fetchWithAuth(`/api/locations?type=subregions2&parentId=${subregion1Id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subregions');
      }
      
      const data = await response.json();
      // setDebug(`Received ${data.length} subregions2: ${JSON.stringify(data.slice(0, 2))}`);
      
      // Filter for only valid subregions
      const filteredData = data.filter(item => 
        item.parentId === subregion1Id || 
        (item.parentId === null && item.subregion2)
      );
      
      // setDebug(`Filtered to ${filteredData.length} valid subregions2`);
      
      // Update the subregions2 state
      setSubregions2(filteredData);
    } catch (error: unknown) {
      clientLogger.error('Error fetching subregions2:', error);
      setFormError('Failed to load subregions. Please try refreshing the page.');
      // setDebug(`Error: ${error.message}`);
    } finally {
      setIsLoadingOptions(false);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle location type change
  const handleLocationTypeChange = (e) => {
    setLocationType(e.target.value);
    // Reset selected values when changing type
    if (e.target.value === 'country') {
      setSelectedCountry(null);
      setSelectedSubregion1(null);
      setSelectedSubregion2(null);
    } else if (e.target.value === 'subregion1') {
      setSelectedSubregion1(null);
      setSelectedSubregion2(null);
    } else if (e.target.value === 'subregion2') {
      setSelectedSubregion2(null);
    }
  };
  
  // Handle country selection
  const handleCountryChange = (e) => {
    const countryId = e.target.value;
    const country = countries.find(c => c.id === countryId);
    
    // setDebug(`Selected country: ${JSON.stringify(country)}`);
    setSelectedCountry(country);
    
    // Auto-fill country fields if adding a subregion
    if (locationType !== 'country' && country) {
      setFormData({
        ...formData,
        countryName: country.name || '',
        twoLetter: country.code2 || '',
        threeLetter: country.code3 || '',
        numeric: country.numeric || '',
        subregion1: '',
        subregion2: '',
        subregion3: '',
      });
    }
  };
  
  // Handle subregion1 selection
  const handleSubregion1Change = (e) => {
    const subregion1Id = e.target.value;
    const subregion1 = subregions1.find(s => s.id === subregion1Id);
    
    // setDebug(`Selected subregion1: ${JSON.stringify(subregion1)}`);
    setSelectedSubregion1(subregion1);
    
    // Update form data with selected values
    if (locationType !== 'subregion1' && subregion1) {
      setFormData({
        ...formData,
        subregion1: subregion1.subregion1 || subregion1.name || '',
      });
    }
  };
  
  // Handle subregion2 selection
  const handleSubregion2Change = (e) => {
    const subregion2Id = e.target.value;
    const subregion2 = subregions2.find(s => s.id === subregion2Id);
    
    // setDebug(`Selected subregion2: ${JSON.stringify(subregion2)}`);
    setSelectedSubregion2(subregion2);
    
    // Update form data with selected values
    if (locationType === 'subregion3' && subregion2) {
      setFormData({
        ...formData,
        subregion2: subregion2.subregion2 || subregion2.name || '',
      });
    }
  };
  
// Prepare data for submission based on location type
const prepareFormData = () => {
  let data = { ...formData };
  
  // Create the base submission data with field names that match the API expectations
  let submitData = {
    countryName: "",      // API expects this name
    twoLetter: "",        // API expects this name 
    threeLetter: "",      // API expects this name
    numeric: "",
    subregion1: null,
    subregion2: null,
    subregion3: null,
    parentId: null
  };

  // Add specific fields based on location type
  if (locationType === 'country') {
    // For country, all country fields are required
    submitData = {
      ...submitData,
      countryName: data.countryName,
      twoLetter: data.twoLetter,
      threeLetter: data.threeLetter,
      numeric: data.numeric,
      subregion1: data.subregion1 || null,
      subregion2: data.subregion2 || null,
      subregion3: data.subregion3 || null,
      parentId: null
    };
  } else if (locationType === 'subregion1') {
    // For subregion1, provide placeholder codes to pass API validation (API will generate real codes)
    submitData = {
      ...submitData,
      name: data.subregion1,  // Use 'name' field instead of 'countryName'
      countryName: data.subregion1, // Also keep this for backward compatibility
      twoLetter: "XX",  // Placeholder - API will generate actual code like "CA_BRI"
      threeLetter: "XXX",
      numeric: "",
      subregion1: data.subregion1,
      subregion2: null,  // Explicitly set unused subregions
      subregion3: null,
      parentId: selectedCountry.id
    };
  } else if (locationType === 'subregion2') {
    // For subregion2, provide placeholder codes to pass API validation (API will generate real codes)
    submitData = {
      ...submitData,
      countryName: data.subregion2,  // Use subregion2 name as the countryName field
      twoLetter: "XX",  // Placeholder - API will generate actual code
      threeLetter: "XXX",
      numeric: "",
      subregion1: selectedSubregion1.subregion1 || selectedSubregion1.name || "",
      subregion2: data.subregion2,
      subregion3: null,  // Explicitly set unused subregion
      parentId: selectedSubregion1.id
    };
  } else if (locationType === 'subregion3') {
    // For subregion3, provide placeholder codes to pass API validation (API will generate real codes)
    submitData = {
      ...submitData,
      countryName: data.subregion3,  // Use subregion3 name as the countryName field
      twoLetter: "XX",  // Placeholder - API will generate actual code
      threeLetter: "XXX",
      numeric: "",
      subregion1: selectedSubregion1.subregion1 || selectedSubregion1.name || "",
      subregion2: selectedSubregion2.subregion2 || selectedSubregion2.name || "",
      subregion3: data.subregion3,
      parentId: selectedSubregion2.id
    };
  }

  // setDebug(`Submitting data: ${JSON.stringify(submitData)}`);
  return submitData;
};

  
  // Form submission
const handleSubmit = async (e) => {
  e.preventDefault();
  setFormError(null);
  setIsSuccess(false);
  setIsSubmitting(true);
  
  try {
    // Prepare data based on location type
    const submitData = prepareFormData();
    
    // Try sending with different field naming to match schema.prisma
    const apiData = {
      ...submitData,
      // Ensure name field is always set
      name: submitData.name || submitData.countryName,
      // Add any fields that might be missing
      disabled: false,
      // If we're adding a subregion, ensure we have this structure
      ...(locationType !== 'country' && {
        parentId: submitData.parentId
      })
    };
    

    const response = await fetchWithAuth('/api/locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      // Try to get more detailed error information
      try {
        const errorData = await response.json();
        clientLogger.info('API Error Response:', errorData);
        // setDebug(`Error response: ${JSON.stringify(errorData)}`);
        throw new Error(errorData.error || `Failed to add location. Status: ${response.status}`);
      } catch (jsonError) {
        // If we can't parse the error as JSON, use the status text
        throw new Error(`Failed to add location: ${response.statusText}`);
      }
    }
    
    // Reset form
    setFormData({
      countryName: '',
      twoLetter: '',
      threeLetter: '',
      numeric: '',
      subregion1: '',
      subregion2: '',
      subregion3: '',
    });
    
    setSelectedCountry(null);
    setSelectedSubregion1(null);
    setSelectedSubregion2(null);
    
    // Set success state
    setIsSuccess(true);

    // Notify parent component that a location was added
    onLocationAdded();

    // Reset success state after 2 seconds
    setTimeout(() => {
      setIsSuccess(false);
    }, 2000);
  } catch (err) {
    clientLogger.error('Error adding location:', err);
    if (err.message !== "Session expired") {
      setFormError(err.message);
    }
  } finally {
    setIsSubmitting(false);
  }
};

  // CSV file handling
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };
  
  // CSV import submission
  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setImportStatus({ loading: false, message: 'Please select a CSV file to import', error: true });
      return;
    }

    setImportStatus({ loading: true, message: 'Importing locations...', error: false });

    const formData = new FormData();
    formData.append('csvFile', csvFile);

    try {
      const response = await fetchWithAuth('/api/locations/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import locations');
      }

      setImportStatus({ 
        loading: false, 
        message: `Successfully imported ${result.imported} locations. ${result.skipped || 0} duplicates skipped.`, 
        error: false 
      });
      setCsvFile(null);
      onLocationAdded();
    } catch (err) {
      clientLogger.error('Error importing locations:', err);
      if (err.message !== "Session expired") {
        setImportStatus({ loading: false, message: err.message, error: true });
      }
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Add Location</h3>
      
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {formError}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* Location Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What type of location are you adding?
          </label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="locationType"
                value="country"
                checked={locationType === 'country'}
                onChange={handleLocationTypeChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Country</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="locationType"
                value="subregion1"
                checked={locationType === 'subregion1'}
                onChange={handleLocationTypeChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Subregion1 (State/Province)</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="locationType"
                value="subregion2"
                checked={locationType === 'subregion2'}
                onChange={handleLocationTypeChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Subregion2 (County/District)</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="locationType"
                value="subregion3"
                checked={locationType === 'subregion3'}
                onChange={handleLocationTypeChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Subregion3 (City/Town)</span>
            </label>
          </div>
        </div>
        
        {/* Cascading Dropdowns */}
        {locationType !== 'country' && (
          <div className="mb-6 space-y-4">
            {/* Country Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Country
              </label>
              <select
                value={selectedCountry?.id || ''}
                onChange={handleCountryChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">-- Select a Country --</option>
                {countries.map((country: any) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Subregion1 Dropdown (for Subregion2 and Subregion3) */}
            {(locationType === 'subregion2' || locationType === 'subregion3') && selectedCountry && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Subregion1 (State/Province)
                </label>
                <select
                  value={selectedSubregion1?.id || ''}
                  onChange={handleSubregion1Change}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  disabled={isLoadingOptions}
                >
                  <option value="">-- Select a State/Province --</option>
                  {subregions1.length > 0 ? (
                    subregions1.map((subregion: any) => (
                      <option key={subregion.id} value={subregion.id}>
                        {/* Only show this option if it has subregion1 value or is a different name than country */}
                        {subregion.subregion1 || 
                          (subregion.name !== selectedCountry.name ? subregion.name : 'Unknown State/Province')}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No states/provinces found for this country</option>
                  )}
                </select>
                {subregions1.length === 0 && !isLoadingOptions && (
                  <div className="flex flex-col space-y-2 mt-2">
                    <p className="text-sm text-amber-600">
                      No states/provinces found for this country. Please add a Subregion1 first.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationType('subregion1');
                        setSelectedSubregion1(null);
                        setSelectedSubregion2(null);
                      }}
                      className="text-blue-600 underline text-sm"
                    >
                      Add a State/Province for {selectedCountry.name}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Subregion2 Dropdown (for Subregion3) */}
            {locationType === 'subregion3' && selectedSubregion1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Subregion2 (County/District)
                </label>
                <select
                  value={selectedSubregion2?.id || ''}
                  onChange={handleSubregion2Change}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  disabled={isLoadingOptions}
                >
                  <option value="">-- Select a County/District --</option>
                  {subregions2.length > 0 ? (
                    subregions2.map((subregion: any) => (
                      <option key={subregion.id} value={subregion.id}>
                        {subregion.subregion2 || 
                          (subregion.name !== selectedSubregion1.name ? subregion.name : 'Unknown County/District')}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No counties/districts found for this state/province</option>
                  )}
                </select>
                {subregions2.length === 0 && !isLoadingOptions && (
                  <div className="flex flex-col space-y-2 mt-2">
                    <p className="text-sm text-amber-600">
                      No counties/districts found for this state/province. Please add a Subregion2 first.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationType('subregion2');
                        setSelectedSubregion2(null);
                      }}
                      className="text-blue-600 underline text-sm"
                    >
                      Add a County/District for {selectedSubregion1.subregion1 || selectedSubregion1.name}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Location Details Form */}
        <div className="border-t border-gray-200 pt-4 mb-6">
          <h4 className="text-md font-medium mb-4">Location Details</h4>
          
          <table className="w-full border-collapse">
            <tbody>
              {/* Country Name */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    Country Name*
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="countryName"
                    value={formData.countryName}
                    onChange={handleInputChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  <span className="text-xs text-gray-500">Required</span>
                </td>
              </tr>
              
              {/* Two Letter Code */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    Two Letter Code*
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="twoLetter"
                    value={formData.twoLetter}
                    onChange={handleInputChange}
                    required
                    maxLength={2}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  <span className="text-xs text-gray-500">Required</span>
                </td>
              </tr>
              
              {/* Three Letter Code */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    Three Letter Code*
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="threeLetter"
                    value={formData.threeLetter}
                    onChange={handleInputChange}
                    required
                    maxLength={3}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  <span className="text-xs text-gray-500">Required</span>
                </td>
              </tr>
              
              {/* Numeric Code */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    Numeric Code*
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="numeric"
                    value={formData.numeric}
                    onChange={handleInputChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  <span className="text-xs text-gray-500">Required</span>
                </td>
              </tr>
              
              {/* Subregion1 */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    {locationType === 'subregion1' ? 'Subregion1 Name*' : 'Subregion1'}
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="subregion1"
                    value={formData.subregion1}
                    onChange={handleInputChange}
                    required={locationType === 'subregion1'}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'subregion1' && locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  {locationType === 'subregion1' && <span className="text-xs text-gray-500">Required</span>}
                </td>
              </tr>
              
              {/* Subregion2 */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    {locationType === 'subregion2' ? 'Subregion2 Name*' : 'Subregion2'}
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="subregion2"
                    value={formData.subregion2}
                    onChange={handleInputChange}
                    required={locationType === 'subregion2'}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'subregion2' && locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  {locationType === 'subregion2' && <span className="text-xs text-gray-500">Required</span>}
                </td>
              </tr>
              
              {/* Subregion3 */}
              <tr>
                <td className="w-36 pr-2 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    {locationType === 'subregion3' ? 'Subregion3 Name*' : 'Subregion3'}
                  </label>
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    name="subregion3"
                    value={formData.subregion3}
                    onChange={handleInputChange}
                    required={locationType === 'subregion3'}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={locationType !== 'subregion3' && locationType !== 'country'}
                  />
                </td>
                <td className="w-24 pl-2 py-2">
                  {locationType === 'subregion3' && <span className="text-xs text-gray-500">Required</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting || isLoadingOptions || isSuccess}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:opacity-50 transition-colors ${
              isSuccess
                ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500'
                : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500'
            }`}
          >
            {isSubmitting ? 'Adding Location...' : isSuccess ? 'Added ✓' : 'Add Location'}
          </button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium mb-4">Import Locations from CSV</h3>
        
        {importStatus.message && (
          <div className={`${importStatus.error ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'} px-4 py-3 rounded mb-4 border`}>
            {importStatus.message}
          </div>
        )}
        
        <form onSubmit={handleImportCsv} className="flex flex-col md:flex-row items-start md:items-end gap-4">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
 CSV should have headers: name, code2, code3, numeric, subregion1, subregion2, subregion3, parentId
            </p>
          </div>
          <div>
            <button
              type="submit"
              disabled={importStatus.loading || !csvFile}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              {importStatus.loading ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}