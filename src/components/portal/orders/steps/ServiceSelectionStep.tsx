'use client';

import { AvailableService, AvailableLocation } from '../types';

interface ServiceSelectionStepProps {
  availableServices: AvailableService[];
  loadingServices: boolean;
  availableLocations: AvailableLocation[];
  loadingLocations: boolean;
  selectedServiceForLocation: AvailableService | null;
  selectedCountry: string;
  serviceItems: any[];
  errors: Record<string, string>;
  onServiceSelect: (service: AvailableService) => void;
  onCountrySelect: (countryId: string) => void;
  onAddToCart: (service: AvailableService, locationId: string, locationName: string) => void;
  onRemoveFromCart: (itemId: string) => void;
}

export function ServiceSelectionStep({
  availableServices,
  loadingServices,
  availableLocations,
  loadingLocations,
  selectedServiceForLocation,
  selectedCountry,
  serviceItems,
  errors,
  onServiceSelect,
  onCountrySelect,
  onAddToCart,
  onRemoveFromCart
}: ServiceSelectionStepProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Select Services & Locations
      </h3>
      <p className="text-gray-600 mb-6">
        Choose services and their locations. You can add multiple instances of the same service with different locations.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Selection Column */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Services</h4>
          {loadingServices ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading services...</span>
            </div>
          ) : availableServices.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No services available.</p>
              <p className="text-sm text-gray-400 mt-2">Please contact support.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableServices.map((service) => {
                const isSelected = selectedServiceForLocation?.id === service.id;
                return (
                  <div
                    key={service.id}
                    onClick={() => onServiceSelect(service)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-medium text-gray-900">
                          {service.name}
                        </h5>
                        <p className="text-xs text-gray-500 mt-1">
                          {service.category}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-xs text-blue-600 font-medium">
                          Select location →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Location Selection Column */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Location Selection</h4>
          {selectedServiceForLocation ? (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-3">
                Select location for: {selectedServiceForLocation.name}
              </p>

              {/* Country Dropdown */}
              <div className="mb-3">
                <label htmlFor="inline-country" className="block text-xs font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  id="inline-country"
                  value={selectedCountry}
                  onChange={(e) => onCountrySelect(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Select Country --</option>
                  {availableLocations.length === 0 ? (
                    <option value="" disabled>Loading countries for this service...</option>
                  ) : (
                    availableLocations
                      .filter(location => location.available) // Only show available countries
                      .map((location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name} {location.code2 ? `(${location.code2})` : ''}
                        </option>
                      ))
                  )}
                </select>
              </div>

              {/* Add Button */}
              {selectedCountry && (
                <button
                  onClick={() => {
                    if (selectedServiceForLocation && selectedCountry) {
                      const country = availableLocations.find(l => l.id === selectedCountry);
                      if (country) {
                        onAddToCart(
                          selectedServiceForLocation,
                          selectedCountry,
                          country.name
                        );
                      }
                    }
                  }}
                  className="w-full mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add to Order
                </button>
              )}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
              <p className="text-sm text-gray-500">
                Select a service to choose its location
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Shopping Cart */}
      {serviceItems.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 mb-3">
            Order Summary ({serviceItems.length} items)
          </h4>
          <div className="space-y-2">
            {serviceItems.map((item: any) => (
              <div key={item.itemId} className="flex items-center justify-between bg-white rounded-md p-2">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{item.serviceName}:</span>
                  <span className="text-sm font-medium text-blue-700 ml-1">{item.locationName}</span>
                </div>
                <button
                  onClick={() => onRemoveFromCart(item.itemId)}
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.services && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{errors.services}</p>
        </div>
      )}
    </div>
  );
}