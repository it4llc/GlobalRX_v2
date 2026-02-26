/**
 * useLocationForm Hook
 *
 * Encapsulates all business logic for location form management
 *
 * BUSINESS LOGIC RULES:
 *
 * 1. LOCATION TYPE HIERARCHY:
 *    - Country: Top-level location, no parent required
 *    - Subregion1: State/Province, requires country parent
 *    - Subregion2: County/District, requires subregion1 parent
 *    - Subregion3: City/Town, requires subregion2 parent
 *
 * 2. FORM BEHAVIOR:
 *    - Location type change resets child selections
 *    - Cascading dropdowns load based on parent selection
 *    - Auto-fill parent data when adding subregions
 *
 * 3. DATA SUBMISSION:
 *    - Countries need: name, twoLetter, threeLetter, numeric codes
 *    - Subregions use placeholder codes ("XX", "XXX") - API generates real codes
 *    - Each subregion includes parent ID reference
 *    - Different field mapping for subregions (use 'name' field)
 *
 * 4. ERROR HANDLING:
 *    - Stay in form on errors (no navigation)
 *    - Show contextual messages for missing subregions
 *    - Offer quick navigation to add missing parents
 *
 * 5. CSV IMPORT:
 *    - Separate workflow from manual entry
 *    - Reports success/skip counts
 *    - Triggers parent refresh on completion
 *
 * 6. STATE MANAGEMENT:
 *    - Loading states for async operations
 *    - Success feedback with 2-second auto-reset
 *    - Form reset after successful submission
 *    - Preserve input on errors
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/client-logger';

interface Location {
  id: string;
  name: string;
  code2?: string;
  code3?: string;
  numeric?: string;
  subregion1?: string;
  subregion2?: string;
  subregion3?: string;
  parentId?: string | null;
}

interface FormData {
  countryName: string;
  twoLetter: string;
  threeLetter: string;
  numeric: string;
  subregion1: string;
  subregion2: string;
  subregion3: string;
}

interface ImportStatus {
  loading: boolean;
  message: string;
  error: boolean;
}

export function useLocationForm(onLocationAdded: () => void) {
  // Location type selection
  const [locationType, setLocationType] = useState('country');

  // Selected parent locations
  const [selectedCountry, setSelectedCountry] = useState<Location | null>(null);
  const [selectedSubregion1, setSelectedSubregion1] = useState<Location | null>(null);
  const [selectedSubregion2, setSelectedSubregion2] = useState<Location | null>(null);

  // Lists for dropdowns
  const [countries, setCountries] = useState<Location[]>([]);
  const [subregions1, setSubregions1] = useState<Location[]>([]);
  const [subregions2, setSubregions2] = useState<Location[]>([]);

  // New location data
  const [formData, setFormData] = useState<FormData>({
    countryName: '',
    twoLetter: '',
    threeLetter: '',
    numeric: '',
    subregion1: '',
    subregion2: '',
    subregion3: '',
  });

  // Form state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    loading: false,
    message: '',
    error: false
  });

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
    } catch (error) {
      logger.error('Error fetching countries:', { error });
      setFormError('Failed to load countries. Please try refreshing the page.');
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Fetch subregions1 for a specific country
  const fetchSubregions1 = async (countryId: string) => {
    try {
      setIsLoadingOptions(true);

      const response = await fetchWithAuth(`/api/locations?type=subregions1&parentId=${countryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subregions');
      }

      const data = await response.json();

      // Filter out any records that don't have parentId matching the selected country
      // This is to handle the API returning all countries instead of subregions
      const filteredData = data.filter((item: Location) =>
        item.parentId === countryId ||
        // Include items that have a subregion1 value set (they're actual subregions)
        (item.parentId === null && item.subregion1)
      );

      setSubregions1(filteredData);
    } catch (error) {
      logger.error('Error fetching subregions1:', { error });
      setFormError('Failed to load subregions. Please try refreshing the page.');
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Fetch subregions2 for a specific subregion1
  const fetchSubregions2 = async (subregion1Id: string) => {
    try {
      setIsLoadingOptions(true);

      const response = await fetchWithAuth(`/api/locations?type=subregions2&parentId=${subregion1Id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subregions');
      }

      const data = await response.json();

      // Filter for only valid subregions
      const filteredData = data.filter((item: Location) =>
        item.parentId === subregion1Id ||
        (item.parentId === null && item.subregion2)
      );

      setSubregions2(filteredData);
    } catch (error) {
      logger.error('Error fetching subregions2:', { error });
      setFormError('Failed to load subregions. Please try refreshing the page.');
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle location type change
  const handleLocationTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryId = e.target.value;
    const country = countries.find(c => c.id === countryId);

    setSelectedCountry(country || null);

    // Auto-fill country fields if adding a subregion
    if (locationType !== 'country' && country) {
      setFormData(prev => ({
        ...prev,
        countryName: country.name || '',
        twoLetter: country.code2 || '',
        threeLetter: country.code3 || '',
        numeric: country.numeric || '',
        // Don't clear subregion fields - let the user set them
      }));
    }
  };

  // Handle subregion1 selection
  const handleSubregion1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subregion1Id = e.target.value;
    const subregion1 = subregions1.find(s => s.id === subregion1Id);

    setSelectedSubregion1(subregion1 || null);

    // Update form data with selected values
    if (locationType !== 'subregion1' && subregion1) {
      setFormData(prev => ({
        ...prev,
        subregion1: subregion1.subregion1 || subregion1.name || '',
      }));
    }
  };

  // Handle subregion2 selection
  const handleSubregion2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subregion2Id = e.target.value;
    const subregion2 = subregions2.find(s => s.id === subregion2Id);

    setSelectedSubregion2(subregion2 || null);

    // Update form data with selected values
    if (locationType === 'subregion3' && subregion2) {
      setFormData(prev => ({
        ...prev,
        subregion2: subregion2.subregion2 || subregion2.name || '',
      }));
    }
  };

  // Prepare data for submission based on location type
  const prepareFormData = () => {
    const data = { ...formData };

    // Create the base submission data with field names that match the API expectations
    let submitData: any = {
      countryName: "",
      twoLetter: "",
      threeLetter: "",
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
        parentId: selectedCountry?.id
      };
    } else if (locationType === 'subregion2') {
      // For subregion2, provide placeholder codes to pass API validation (API will generate real codes)
      submitData = {
        ...submitData,
        countryName: data.subregion2,  // Use subregion2 name as the countryName field
        twoLetter: "XX",  // Placeholder - API will generate actual code
        threeLetter: "XXX",
        numeric: "",
        subregion1: selectedSubregion1?.subregion1 || selectedSubregion1?.name || "",
        subregion2: data.subregion2,
        subregion3: null,  // Explicitly set unused subregion
        parentId: selectedSubregion1?.id
      };
    } else if (locationType === 'subregion3') {
      // For subregion3, provide placeholder codes to pass API validation (API will generate real codes)
      submitData = {
        ...submitData,
        countryName: data.subregion3,  // Use subregion3 name as the countryName field
        twoLetter: "XX",  // Placeholder - API will generate actual code
        threeLetter: "XXX",
        numeric: "",
        subregion1: selectedSubregion1?.subregion1 || selectedSubregion1?.name || "",
        subregion2: selectedSubregion2?.subregion2 || selectedSubregion2?.name || "",
        subregion3: data.subregion3,
        parentId: selectedSubregion2?.id
      };
    }

    return submitData;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
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
        let errorMessage = `Failed to add location. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          logger.info('API Error Response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If we can't parse the error as JSON, use the status text if available
          errorMessage = response.statusText ? `Failed to add location: ${response.statusText}` : errorMessage;
        }
        throw new Error(errorMessage);
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
    } catch (err: any) {
      logger.error('Error adding location:', { error: err });
      if (err.message !== "Session expired") {
        setFormError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV file handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  // CSV import submission
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setImportStatus({ loading: false, message: 'Please select a CSV file to import', error: true });
      return;
    }

    setImportStatus({ loading: true, message: 'Importing locations...', error: false });

    const formDataToSend = new FormData();
    formDataToSend.append('csvFile', csvFile);

    try {
      const response = await fetchWithAuth('/api/locations/import', {
        method: 'POST',
        body: formDataToSend,
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
    } catch (err: any) {
      logger.error('Error importing locations:', { error: err });
      if (err.message !== "Session expired") {
        setImportStatus({ loading: false, message: err.message, error: true });
      }
    }
  };

  return {
    // State
    locationType,
    selectedCountry,
    selectedSubregion1,
    selectedSubregion2,
    countries,
    subregions1,
    subregions2,
    formData,
    formError,
    isSubmitting,
    isLoadingOptions,
    isSuccess,
    csvFile,
    importStatus,

    // Setters
    setLocationType,
    setSelectedCountry,
    setSelectedSubregion1,
    setSelectedSubregion2,
    setSubregions1,
    setSubregions2,
    setFormData,
    setCsvFile,

    // Handlers
    handleInputChange,
    handleLocationTypeChange,
    handleCountryChange,
    handleSubregion1Change,
    handleSubregion2Change,
    handleSubmit,
    handleFileChange,
    handleImportCsv,
  };
}