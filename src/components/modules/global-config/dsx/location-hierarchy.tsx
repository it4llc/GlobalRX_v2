// src/components/modules/global-config/dsx/location-hierarchy.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Country, Subregion, Requirement } from '@/types';

interface LocationHierarchyProps {
  countries: Country[];
  requirements: Requirement[];
  mappings: Record<string, boolean>;
  onMappingChange: (locationId: string, requirementId: string, checked: boolean) => void;
}

export function LocationHierarchy({ 
  countries, 
  requirements, 
  mappings, 
  onMappingChange 
}: LocationHierarchyProps) {
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [expandedSubregions, setExpandedSubregions] = useState<Record<string, boolean>>({});

  // Group requirements by type
  const fields = requirements.filter(r => r.type === 'field');
  const documents = requirements.filter(r => r.type === 'document');
  const forms = requirements.filter(r => r.type === 'form');

  // Check if a requirement is selected for a location
  const isRequirementSelected = (locationId: string, requirementId: string): boolean => {
    const key = `${locationId}-${requirementId}`;
    return mappings[key] || false;
  };

  // Toggle expansion of a country
  const toggleCountryExpand = (countryId: string) => {
    setExpandedCountries(prev => ({
      ...prev,
      [countryId]: !prev[countryId]
    }));
  };

  // Toggle expansion of a subregion
  const toggleSubregionExpand = (subregionId: string) => {
    setExpandedSubregions(prev => ({
      ...prev,
      [subregionId]: !prev[subregionId]
    }));
  };

  // Handle checkbox change
  const handleCheckboxChange = (locationId: string, requirementId: string, checked: boolean) => {
    onMappingChange(locationId, requirementId, checked);
  };

  // Render a row for a country
  const renderCountryRow = (country: Country) => {
    const isExpanded = expandedCountries[country.id] || false;
    const hasSubregions = country.subregions && country.subregions.length > 0;

    return (
      <>
        <tr className="border-b">
          <td className="p-2">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-6 w-6 mr-2"
                onClick={() => toggleCountryExpand(country.id)}
                disabled={!hasSubregions}
              >
                {hasSubregions ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <span className="w-4" />
                )}
              </Button>
              <span className="font-medium">{country.name}</span>
            </div>
          </td>
          {fields.map(field => (
            <td key={field.id} className="p-2 text-center">
              <Checkbox 
                id={`${country.id}-${field.id}`} 
                checked={isRequirementSelected(country.id, field.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(country.id, field.id, checked === true)
                }
              />
            </td>
          ))}
          {documents.map(doc => (
            <td key={doc.id} className="p-2 text-center">
              <Checkbox 
                id={`${country.id}-${doc.id}`} 
                checked={isRequirementSelected(country.id, doc.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(country.id, doc.id, checked === true)
                }
              />
            </td>
          ))}
          {forms.map(form => (
            <td key={form.id} className="p-2 text-center">
              <Checkbox 
                id={`${country.id}-${form.id}`} 
                checked={isRequirementSelected(country.id, form.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(country.id, form.id, checked === true)
                }
              />
            </td>
          ))}
        </tr>
        {isExpanded && country.subregions?.map(subregion => 
          renderSubregionRows(subregion, 1)
        )}
      </>
    );
  };

  // Render rows for subregions recursively
  const renderSubregionRows = (subregion: Subregion, level: number) => {
    const isExpanded = expandedSubregions[subregion.id] || false;
    const hasSubregions = subregion.subregions && subregion.subregions.length > 0;
    const paddingLeft = `${level * 1.5}rem`;

    return (
      <>
        <tr key={subregion.id} className="border-b bg-gray-50">
          <td className="p-2">
            <div className="flex items-center" style={{ paddingLeft }}>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-6 w-6 mr-2"
                onClick={() => toggleSubregionExpand(subregion.id)}
                disabled={!hasSubregions}
              >
                {hasSubregions ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <span className="w-4" />
                )}
              </Button>
              <span>{subregion.name}</span>
            </div>
          </td>
          {fields.map(field => (
            <td key={field.id} className="p-2 text-center">
              <Checkbox 
                id={`${subregion.id}-${field.id}`} 
                checked={isRequirementSelected(subregion.id, field.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(subregion.id, field.id, checked === true)
                }
              />
            </td>
          ))}
          {documents.map(doc => (
            <td key={doc.id} className="p-2 text-center">
              <Checkbox 
                id={`${subregion.id}-${doc.id}`} 
                checked={isRequirementSelected(subregion.id, doc.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(subregion.id, doc.id, checked === true)
                }
              />
            </td>
          ))}
          {forms.map(form => (
            <td key={form.id} className="p-2 text-center">
              <Checkbox 
                id={`${subregion.id}-${form.id}`} 
                checked={isRequirementSelected(subregion.id, form.id)}
                onCheckedChange={(checked) => 
                  handleCheckboxChange(subregion.id, form.id, checked === true)
                }
              />
            </td>
          ))}
        </tr>
        {isExpanded && subregion.subregions?.map(childSubregion =>
          renderSubregionRows(childSubregion, level + 1)
        )}
      </>
    );
  };

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="p-2 text-left w-64 bg-gray-100">Location</th>
          {fields.length > 0 && (
            <th 
              className="p-2 text-center bg-gray-100" 
              colSpan={fields.length}
            >
              Data Fields
            </th>
          )}
          {documents.length > 0 && (
            <th 
              className="p-2 text-center bg-gray-100" 
              colSpan={documents.length}
            >
              Documents
            </th>
          )}
          {forms.length > 0 && (
            <th 
              className="p-2 text-center bg-gray-100" 
              colSpan={forms.length}
            >
              Forms
            </th>
          )}
        </tr>
        <tr>
          <th className="p-2 text-left bg-gray-50"></th>
          {fields.map(field => (
            <th key={field.id} className="p-2 text-center bg-gray-50">
              {field.name}
            </th>
          ))}
          {documents.map(doc => (
            <th key={doc.id} className="p-2 text-center bg-gray-50">
              {doc.name}
            </th>
          ))}
          {forms.map(form => (
            <th key={form.id} className="p-2 text-center bg-gray-50">
              {form.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {countries.map(country => renderCountryRow(country))}
      </tbody>
    </table>
  );
}