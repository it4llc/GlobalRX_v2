'use client';
// src/components/modules/workflows/workflow-filter-bar.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface WorkflowFilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  showDisabled: boolean;
  setShowDisabled: (show: boolean) => void;
  statuses: string[];
}

export function WorkflowFilterBar({
  searchTerm,
  setSearchTerm,
  selectedStatus,
  setSelectedStatus,
  showDisabled,
  setShowDisabled,
  statuses
}: WorkflowFilterBarProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search Input */}
        <div className="flex-1 min-w-[250px]">
          <Label htmlFor="search" className="block text-sm font-medium mb-1">
            Search
          </Label>
          <Input
            id="search"
            type="text"
            placeholder="Search by name or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Status Filter */}
        <div className="w-[180px]">
          <Label htmlFor="status" className="block text-sm font-medium mb-1">
            Status
          </Label>
          <Select
            id="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full"
          >
            <option value="all">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        {/* Show Disabled Checkbox */}
        <div className="flex items-center space-x-2 mt-6">
          <Checkbox
            id="showDisabled"
            checked={showDisabled}
            onCheckedChange={(checked) => setShowDisabled(checked === true)}
          />
          <Label htmlFor="showDisabled" className="text-sm font-medium">
            Show Disabled
          </Label>
        </div>
      </div>
    </div>
  );
}