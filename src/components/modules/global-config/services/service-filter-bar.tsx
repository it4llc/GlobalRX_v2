// src/components/modules/global-config/services/service-filter-bar.tsx
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { StandardDropdown } from '@/components/ui/standard-dropdown';

interface ServiceFilterBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedFunctionalityType: string;
  setSelectedFunctionalityType: (value: string) => void;
  showDisabled: boolean;
  setShowDisabled: (value: boolean) => void;
  categories: string[];
  functionalityTypes: string[];
}

export function ServiceFilterBar({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  selectedFunctionalityType,
  setSelectedFunctionalityType,
  showDisabled,
  setShowDisabled,
  categories,
  functionalityTypes,
}: ServiceFilterBarProps) {
  // Format categories for dropdown
  const categoryOptions = [
    { id: 'all-categories', value: 'all-categories', label: 'All Categories' },
    ...categories.map((category: any) => ({
      id: category,
      value: category,
      label: category
    }))
  ];

  // Format functionality types for dropdown
  const functionalityTypeOptions = [
    { id: 'all-types', value: 'all-types', label: 'All Types' },
    ...functionalityTypes.map((type: any) => ({
      id: type,
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1)
    }))
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Search Input */}
        <div className="md:col-span-3">
          <Label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </Label>
          <Input
            id="search"
            type="text"
            placeholder="Search service name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            style={{ height: '28px' }}
          />
        </div>

        {/* Category Filter */}
        <div className="md:col-span-3">
          <Label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </Label>
          <StandardDropdown
            id="category-filter"
            options={categoryOptions}
            value={selectedCategory}
            onChange={setSelectedCategory}
            placeholder="Select a category"
          />
        </div>

        {/* Functionality Type Filter */}
        <div className="md:col-span-3">
          <Label htmlFor="functionality-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Functionality Type
          </Label>
          <StandardDropdown
            id="functionality-filter"
            options={functionalityTypeOptions}
            value={selectedFunctionalityType}
            onChange={setSelectedFunctionalityType}
            placeholder="Select functionality type"
          />
        </div>

        {/* Show Disabled Toggle */}
        <div className="md:col-span-3 flex items-end">
          <div className="flex items-center gap-2">
            <div style={{ width: '16px', height: '16px', position: 'relative' }}>
              <Checkbox
                id="show-disabled"
                checked={showDisabled}
                onCheckedChange={() => setShowDisabled(!showDisabled)}
                style={{
                  width: '16px',
                  height: '16px',
                  minWidth: '16px',
                  minHeight: '16px',
                  position: 'absolute',
                  top: '0',
                  left: '0'
                }}
              />
            </div>
            <Label htmlFor="show-disabled" className="text-sm text-gray-700 align-middle">
              Show disabled services
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}