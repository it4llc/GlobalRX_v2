// src/components/modules/global-config/locations/locations-table.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function LocationsTable({ locations, isLoading, error, onRefresh }) {
  const [editingLocation, setEditingLocation] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  
  // Track expanded rows
  const [expandedRows, setExpandedRows] = useState({});
  
  // Organized locations
  const [hierarchicalLocations, setHierarchicalLocations] = useState([]);
  
  // Use the auth context
  const { fetchWithAuth } = useAuth();

  // Process locations into hierarchical structure
  useEffect(() => {
    if (locations && locations.length > 0) {
      const locationsMap = new Map();
      const rootLocations = [];
      
      // First pass: create a map of all locations by ID
      locations.forEach(location => {
        // Make sure the location has children array
        locationsMap.set(location.id, { ...location, children: [] });
      });
      
      // Second pass: build the hierarchy
      locations.forEach(location => {
        const locationWithChildren = locationsMap.get(location.id);
        
        if (location.parentId && locationsMap.has(location.parentId)) {
          // This is a child location - add it to its parent's children
          const parent = locationsMap.get(location.parentId);
          parent.children.push(locationWithChildren);
        } else {
          // This is a root location (country)
          rootLocations.push(locationWithChildren);
        }
      });
      
      // Sort root locations alphabetically
      rootLocations.sort((a, b) => {
        const nameA = a.name || a.countryName || '';
        const nameB = b.name || b.countryName || '';
        return nameA.localeCompare(nameB);
      });
      
      setHierarchicalLocations(rootLocations);
    } else {
      setHierarchicalLocations([]);
    }
  }, [locations]);

  const handleEditClick = (location, e) => {
    if (e) e.preventDefault(); // Prevent default browser behavior
    setEditingLocation(location.id);
    setEditFormData({
      id: location.id,
      countryName: location.name || location.countryName,
      twoLetter: location.code2 || location.twoLetter,
      threeLetter: location.code3 || location.threeLetter,
      numeric: location.numeric,
      subregion1: location.subregion1 || '',
      subregion2: location.subregion2 || '',
      subregion3: location.subregion3 || '',
    });
    setOpenActionMenu(null);
  };

  const handleCancelEdit = () => {
    setEditingLocation(null);
    setEditFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateLocation = async (e) => {
    if (e) e.preventDefault(); // Prevent default browser behavior
    setActionError(null);
    setIsSubmitting(true);

    try {
      // Use fetchWithAuth instead of regular fetch
      const response = await fetchWithAuth(`/api/locations/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update location');
      }

      // Reset edit state
      setEditingLocation(null);
      setEditFormData({});
      
      // Refresh the location list
      onRefresh();
    } catch (err) {
      console.error('Error updating location:', err);
      // Don't set the error if it's a session error (already handled by AuthInterceptor)
      if (err.message !== "Session expired") {
        setActionError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (location, e) => {
    if (e) e.preventDefault(); // Prevent default browser behavior
    setActionError(null);
    setOpenActionMenu(null);
    
    try {
      console.log("Toggling status for location:", location);
      // Use fetchWithAuth instead of regular fetch
      const response = await fetchWithAuth(`/api/locations/${location.id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update location status');
      }

      // Refresh the location list
      onRefresh();
    } catch (err) {
      console.error('Error updating location status:', err);
      // Don't set the error if it's a session error (already handled by AuthInterceptor)
      if (err.message !== "Session expired") {
        setActionError(err.message);
      }
    }
  };

  const toggleActionMenu = (locationId, e) => {
    e.stopPropagation(); // Stop event propagation
    setOpenActionMenu(openActionMenu === locationId ? null : locationId);
  };

  // Toggle row expansion
  const toggleRowExpansion = (locationId) => {
    setExpandedRows(prevState => ({
      ...prevState,
      [locationId]: !prevState[locationId]
    }));
  };

  // Check if a location has children
  const hasChildren = (location) => {
    return location.children && location.children.length > 0;
  };

  // These functions determine what to display in each column based on hierarchy level
  
  // For the Country Name column - only show for top-level countries
  const getCountryName = (location) => {
    // Only show country name for top-level countries
    if (!location.parentId) {
      return location.name || location.countryName || '-';
    }
    // For subregions, show nothing
    return '-';
  };

  // For the 2-Letter Code column - only show for top-level countries
  const getTwoLetter = (location) => {
    // Only show for top-level countries
    if (!location.parentId) {
      return location.code2 || location.twoLetter || '-';
    }
    // For subregions, show nothing
    return '-';
  };

  // For the 3-Letter Code column - only show for top-level countries
  const getThreeLetter = (location) => {
    // Only show for top-level countries
    if (!location.parentId) {
      return location.code3 || location.threeLetter || '-';
    }
    // For subregions, show nothing
    return '-';
  };

  // For the Numeric Code column - only show for top-level countries
  const getNumeric = (location) => {
    // Only show for top-level countries
    if (!location.parentId) {
      return location.numeric || '-';
    }
    // For subregions, show nothing
    return '-';
  };

  // For the Subregion1 column - show for all location types
  const getSubregion1 = (location) => {
    return location.subregion1 || '-';
  };

  // For the Subregion2 column - show for all location types
  const getSubregion2 = (location) => {
    return location.subregion2 || '-';
  };

  // For the Subregion3 column - show for all location types
  const getSubregion3 = (location) => {
    return location.subregion3 || '-';
  };

  const handleTableClick = () => {
    if (openActionMenu !== null) {
      setOpenActionMenu(null);
    }
  };

  // Recursive function to render location rows with hierarchy
  const renderLocationRows = (locationList, level = 0) => {
    return locationList.map(location => {
      const isExpanded = expandedRows[location.id];
      const hasChildLocations = hasChildren(location);
      
      return (
        <>
          {/* Parent Row */}
          <tr key={location.id} className={`hover:bg-gray-50 ${level > 0 ? 'border-t border-gray-100' : ''}`}>
            {editingLocation === location.id ? (
              // Edit mode
              <>
                <td className="px-4 py-4" style={{ maxWidth: '20%', overflow: 'hidden' }}>
                  <div className="flex items-center">
                    <div style={{ width: `${level * 20}px` }} className="flex-shrink-0"></div>
                    <input
                      type="text"
                      name="countryName"
                      value={editFormData.countryName}
                      onChange={handleInputChange}
                      required
                      className="w-full p-1 border border-gray-300 rounded-md"
                      style={{ maxWidth: '100%' }}
                    />
                  </div>
                </td>
                <td className="px-2 py-4" style={{ width: '5%', maxWidth: '5%' }}>
                  <input
                    type="text"
                    name="twoLetter"
                    value={editFormData.twoLetter}
                    onChange={handleInputChange}
                    required
                    maxLength={2}
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-2 py-4" style={{ width: '5%', maxWidth: '5%' }}>
                  <input
                    type="text"
                    name="threeLetter"
                    value={editFormData.threeLetter}
                    onChange={handleInputChange}
                    required
                    maxLength={3}
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-2 py-4" style={{ width: '6%', maxWidth: '6%' }}>
                  <input
                    type="text"
                    name="numeric"
                    value={editFormData.numeric}
                    onChange={handleInputChange}
                    required
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-3 py-4" style={{ width: '16%', maxWidth: '16%' }}>
                  <input
                    type="text"
                    name="subregion1"
                    value={editFormData.subregion1}
                    onChange={handleInputChange}
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-3 py-4" style={{ width: '16%', maxWidth: '16%' }}>
                  <input
                    type="text"
                    name="subregion2"
                    value={editFormData.subregion2}
                    onChange={handleInputChange}
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-3 py-4" style={{ width: '16%', maxWidth: '16%' }}>
                  <input
                    type="text"
                    name="subregion3"
                    value={editFormData.subregion3}
                    onChange={handleInputChange}
                    className="w-full p-1 border border-gray-300 rounded-md"
                    style={{ maxWidth: '100%' }}
                  />
                </td>
                <td className="px-3 py-4 text-center" style={{ width: '8%', maxWidth: '8%' }}>
                  {location.status !== false ? 'Active' : 'Disabled'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-center" style={{ width: '8%', maxWidth: '8%' }}>
                  <div className="flex space-x-2 justify-center">
                    <button
                      onClick={(e) => handleUpdateLocation(e)}
                      disabled={isSubmitting}
                      className="text-blue-600 hover:text-blue-900 text-xs"
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-600 hover:text-gray-900 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </>
            ) : (
              // View mode
              <>
                <td className="px-4 py-4 text-sm text-gray-900" style={{ maxWidth: '20%', overflow: 'hidden' }}>
                  <div className="flex items-center">
                    <div style={{ width: `${level * 20}px` }} className="flex-shrink-0"></div>
                    
                    {/* Expand/Collapse Button */}
                    {hasChildLocations ? (
                      <button 
                        onClick={() => toggleRowExpansion(location.id)}
                        className="mr-2 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
                      >
                        {isExpanded ? '−' : '+'}
                      </button>
                    ) : (
                      <div className="mr-2 w-5 h-5"></div>
                    )}
                    
                    <span className="truncate">{getCountryName(location)}</span>
                  </div>
                </td>
                <td className="px-2 py-4 text-sm text-gray-500 text-center" style={{ width: '5%', maxWidth: '5%' }}>
                  {getTwoLetter(location)}
                </td>
                <td className="px-2 py-4 text-sm text-gray-500 text-center" style={{ width: '5%', maxWidth: '5%' }}>
                  {getThreeLetter(location)}
                </td>
                <td className="px-2 py-4 text-sm text-gray-500 text-center" style={{ width: '6%', maxWidth: '6%' }}>
                  {getNumeric(location)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 truncate" style={{ width: '16%', maxWidth: '16%' }}>
                  {getSubregion1(location)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 truncate" style={{ width: '16%', maxWidth: '16%' }}>
                  {getSubregion2(location)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 truncate" style={{ width: '16%', maxWidth: '16%' }}>
                  {getSubregion3(location)}
                </td>
                <td className="px-3 py-4 text-sm text-center" style={{ width: '8%', maxWidth: '8%' }}>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${location.status !== false && location.disabled !== true ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {location.status !== false && location.disabled !== true ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm font-medium text-center" style={{ width: '8%', maxWidth: '8%' }}>
                  {/* Replace with a simple dropdown menu */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button 
                      style={{ 
                        backgroundColor: '#f3f4f6', 
                        color: '#374151', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onClick={(e) => toggleActionMenu(location.id, e)}
                    >
                      <span style={{ marginRight: '4px' }}>Actions</span>
                      <span>▼</span>
                    </button>
                    {openActionMenu === location.id && (
                      <div id={`menu-${location.id}`} style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        zIndex: 50,
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                        width: '80px'
                      }}>
                        <div>
                          <button
                            onClick={(e) => handleEditClick(location, e)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              fontSize: '12px',
                              color: '#2563eb',
                              backgroundColor: 'white',
                              border: 'none',
                              borderBottom: '1px solid #f3f4f6',
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(location, e)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              fontSize: '12px',
                              color: location.status !== false && location.disabled !== true ? '#dc2626' : '#16a34a',
                              backgroundColor: 'white',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {location.status !== false && location.disabled !== true ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </>
            )}
          </tr>
          {/* Child Rows (rendered if parent is expanded) */}
          {isExpanded && hasChildLocations && 
            renderLocationRows(location.children, level + 1)}
        </>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ maxWidth: '100%' }}>
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="text-lg font-medium">All Locations</h3>
        <button 
          onClick={onRefresh}
          className="text-blue-500 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>
      
      {actionError && (
        <div className="m-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {actionError}
        </div>
      )}
      
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <p>Loading locations...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-red-500 text-center">
          <p>{error}</p>
          <button 
            onClick={onRefresh}
            className="mt-2 text-blue-500 hover:underline"
          >
            Try Again
          </button>
        </div>
      ) : !locations || locations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No locations found. Add a location using the form above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto" onClick={handleTableClick} style={{ width: '100%', maxWidth: '100%' }}>
          <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '20%' }}>
                  Country Name
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '5%' }}>
                  2-Letter
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '5%' }}>
                  3-Letter
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '6%' }}>
                  Numeric
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '16%' }}>
                  Subregion1
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '16%' }}>
                  Subregion2
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '16%' }}>
                  Subregion3
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '8%' }}>
                  Status
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '8%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {renderLocationRows(hierarchicalLocations)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}