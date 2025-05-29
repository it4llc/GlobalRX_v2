// src/components/modules/customer/scope-selector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { RadioGroup } from '@/components/ui/radio-group';
import { Radio } from '@/components/ui/radio';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ScopeSelectorProps {
  serviceType: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function ScopeSelector({
  serviceType,
  value,
  onChange,
  disabled = false
}: ScopeSelectorProps) {
  // Initialize state based on service type and existing value
  const [scopeType, setScopeType] = useState<string>(() => {
    if (!value) return getDefaultScopeType(serviceType);
    return value.type || getDefaultScopeType(serviceType);
  });
  
  const [quantityValue, setQuantityValue] = useState<number>(() => {
    if (!value) return 1;
    return value.quantity || 1;
  });
  
  const [yearsValue, setYearsValue] = useState<number>(() => {
    if (!value) return 7;
    return value.years || 7;
  });
  
  // Update the parent component when scope changes
  useEffect(() => {
    // Build scope object based on type
    let scopeObj: any = { type: scopeType };
    
    if (scopeType === 'most-recent-x') {
      scopeObj.quantity = quantityValue;
    } else if (scopeType === 'past-x-years') {
      scopeObj.years = yearsValue;
    }
    
    onChange(scopeObj);
  }, [scopeType, quantityValue, yearsValue, onChange]);
  
  // Get default scope type based on service type
  function getDefaultScopeType(type: string): string {
    switch (type) {
      case 'verification-edu':
        return 'highest-degree';
      case 'verification-emp':
        return 'most-recent';
      case 'record':
        return 'current-address';
      default:
        return 'standard';
    }
  }
  
  // Render educational verification scope options
  if (serviceType === 'verification-edu') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Scope:</p>
        <RadioGroup
          value={scopeType}
          onValueChange={setScopeType}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <Radio
              id="edu-highest-degree"
              value="highest-degree"
              checked={scopeType === 'highest-degree'}
              disabled={disabled}
            />
            <Label htmlFor="edu-highest-degree" className="text-sm">
              Highest Degree, post high school
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="edu-highest-inc-highschool"
              value="highest-degree-inc-highschool"
              checked={scopeType === 'highest-degree-inc-highschool'}
              disabled={disabled}
            />
            <Label htmlFor="edu-highest-inc-highschool" className="text-sm">
              Highest Degree, including high school
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="edu-all-degrees"
              value="all-degrees"
              checked={scopeType === 'all-degrees'}
              disabled={disabled}
            />
            <Label htmlFor="edu-all-degrees" className="text-sm">
              All degrees post high school
            </Label>
          </div>
        </RadioGroup>
      </div>
    );
  }
  
  // Render employment verification scope options
  if (serviceType === 'verification-emp') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Scope:</p>
        <RadioGroup
          value={scopeType}
          onValueChange={setScopeType}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <Radio
              id="emp-most-recent"
              value="most-recent"
              checked={scopeType === 'most-recent'}
              disabled={disabled}
            />
            <Label htmlFor="emp-most-recent" className="text-sm">
              Most recent employment
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="emp-most-recent-x"
              value="most-recent-x"
              checked={scopeType === 'most-recent-x'}
              disabled={disabled}
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="emp-most-recent-x" className="text-sm">
                Most recent
              </Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={quantityValue}
                onChange={(e) => setQuantityValue(parseInt(e.target.value) || 1)}
                className="w-16 h-7 text-sm"
                disabled={disabled || scopeType !== 'most-recent-x'}
              />
              <span className="text-sm">employments</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="emp-past-x-years"
              value="past-x-years"
              checked={scopeType === 'past-x-years'}
              disabled={disabled}
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="emp-past-x-years" className="text-sm">
                All employments in past
              </Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={yearsValue}
                onChange={(e) => setYearsValue(parseInt(e.target.value) || 7)}
                className="w-16 h-7 text-sm"
                disabled={disabled || scopeType !== 'past-x-years'}
              />
              <span className="text-sm">years</span>
            </div>
          </div>
        </RadioGroup>
      </div>
    );
  }
  
  // Render record scope options
  if (serviceType === 'record') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Scope:</p>
        <RadioGroup
          value={scopeType}
          onValueChange={setScopeType}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <Radio
              id="record-current"
              value="current-address"
              checked={scopeType === 'current-address'}
              disabled={disabled}
            />
            <Label htmlFor="record-current" className="text-sm">
              Current address only
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="record-last-x"
              value="last-x-addresses"
              checked={scopeType === 'last-x-addresses'}
              disabled={disabled}
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="record-last-x" className="text-sm">
                Last
              </Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={quantityValue}
                onChange={(e) => setQuantityValue(parseInt(e.target.value) || 1)}
                className="w-16 h-7 text-sm"
                disabled={disabled || scopeType !== 'last-x-addresses'}
              />
              <span className="text-sm">addresses</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Radio
              id="record-past-x-years"
              value="past-x-years"
              checked={scopeType === 'past-x-years'}
              disabled={disabled}
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="record-past-x-years" className="text-sm">
                All addresses in past
              </Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={yearsValue}
                onChange={(e) => setYearsValue(parseInt(e.target.value) || 7)}
                className="w-16 h-7 text-sm"
                disabled={disabled || scopeType !== 'past-x-years'}
              />
              <span className="text-sm">years</span>
            </div>
          </div>
        </RadioGroup>
      </div>
    );
  }
  
  // For other service types or fallback
  return (
    <div className="text-sm text-gray-500">
      Standard scope
    </div>
  );
}