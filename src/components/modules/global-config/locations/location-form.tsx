'use client';
/**
 * Location Form Component
 *
 * This component handles the UI for adding locations to the system.
 * All business logic has been extracted to the useLocationForm hook.
 *
 * Component responsibilities:
 * - Render the form UI
 * - Display form states (loading, success, errors)
 * - Handle user interactions
 *
 * Business logic handled by useLocationForm:
 * - Location type hierarchy validation
 * - Cascading dropdown data fetching
 * - Form data preparation and submission
 * - Error handling and success states
 * - CSV import processing
 */

import { useLocationForm } from '@/hooks/useLocationForm';

interface LocationFormProps {
  onLocationAdded: () => void;
}

export function LocationForm({ onLocationAdded }: LocationFormProps) {
  const {
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

    // Handlers
    handleInputChange,
    handleLocationTypeChange,
    handleCountryChange,
    handleSubregion1Change,
    handleSubregion2Change,
    handleSubmit,
    handleFileChange,
    handleImportCsv,

    // Setters
    setLocationType,
  } = useLocationForm(onLocationAdded);

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