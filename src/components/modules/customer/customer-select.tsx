'use client';
// src/components/modules/customer/customer-select.tsx
import clientLogger from '@/lib/client-logger';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Search } from 'lucide-react';

interface CustomerOption {
  id: string;
  value: string;
  label: string;
}

interface CustomerSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  excludeIds?: string[];
  disabled?: boolean;
}

export function CustomerSelect({
  id,
  value,
  onChange,
  placeholder = 'Select a customer',
  excludeIds = [],
  disabled = false
}: CustomerSelectProps) {
  const { fetchWithAuth } = useAuth();
  
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Handle search input change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Fetch customers when search changes
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        
        const params = new URLSearchParams({
          page: '1',
          pageSize: '25',
          includeDisabled: 'false'
        });
        
        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }
        
        const response = await fetchWithAuth(`/api/customers?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch customers');
        }
        
        const data = await response.json();
        
        // Filter out excluded IDs
        const filteredCustomers = data.data.filter(
          (customer: any) => !excludeIds.includes(customer.id)
        );
        
        // Map to dropdown options format
        const customerOptions = filteredCustomers.map((customer: any) => ({
          id: customer.id,
          value: customer.id,
          label: customer.name
        }));
        
        setOptions(customerOptions);
      } catch (error) {
        clientLogger.error('Error fetching customers:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCustomers();
  }, [debouncedSearch, excludeIds, fetchWithAuth]);
  
  // If we have a value but no options (like on initial load)
  // fetch the selected customer to display it properly
  useEffect(() => {
    if (value && options.length === 0 && !isLoading) {
      const fetchSelectedCustomer = async () => {
        try {
          setIsLoading(true);
          const response = await fetchWithAuth(`/api/customers/${value}`);
          
          if (response.ok) {
            const customer = await response.json();
            setOptions([
              {
                id: customer.id,
                value: customer.id,
                label: customer.name
              }
            ]);
          }
        } catch (error) {
          clientLogger.error('Error fetching selected customer:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchSelectedCustomer();
    }
  }, [value, options.length, isLoading, fetchWithAuth]);
  
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-8"
          disabled={disabled}
        />
        <div className="absolute top-0 right-0 h-full flex items-center pr-2">
          {searchTerm ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSearchTerm('')}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
      
      <StandardDropdown
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled || isLoading}
      />
      
      {isLoading && (
        <div className="text-sm text-gray-500">Loading customers...</div>
      )}
      
      {!isLoading && options.length === 0 && debouncedSearch && (
        <div className="text-sm text-gray-500">
          No customers found matching "{debouncedSearch}"
        </div>
      )}
    </div>
  );
}