'use client';
// src/components/modules/customer/service-selection.tsx
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Search } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  category: string;
  description?: string;
  functionalityType: string;
  disabled: boolean;
}

interface ServiceSelectionProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function ServiceSelection({
  value = [],
  onChange,
  disabled = false
}: ServiceSelectionProps) {
  const { fetchWithAuth } = useAuth();
  
  const [services, setServices] = useState<Service[]>([]);
  const [groupedServices, setGroupedServices] = useState<Record<string, Service[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Load services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetchWithAuth('/api/services');
        
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        
        const data = await response.json();
        
        // Process the services data - handle different response formats
        let servicesArray: Service[] = [];
        
        if (Array.isArray(data)) {
          servicesArray = data;
        } else if (data.data && Array.isArray(data.data)) {
          servicesArray = data.data;
        } else if (data.all && Array.isArray(data.all)) {
          servicesArray = data.all;
        } else {
          const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
            servicesArray = possibleArrays[0] as Service[];
          }
        }
        
        // Group services by category
        const groupedByCategory: Record<string, Service[]> = {};
        
        servicesArray.forEach(service => {
          // Skip disabled services
          if (service.disabled) return;
          
          const category = service.category || 'Uncategorized';
          
          if (!groupedByCategory[category]) {
            groupedByCategory[category] = [];
          }
          
          groupedByCategory[category].push(service);
        });
        
        setServices(servicesArray.filter(s => !s.disabled));
        setGroupedServices(groupedByCategory);
      } catch (err) {
        clientLogger.error('Error fetching services:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchServices();
  }, [fetchWithAuth]);
  
  // Handle checkbox change for individual services
  const handleCheckboxChange = (serviceId: string, checked: boolean) => {
    if (disabled) return;
    
    if (checked) {
      onChange([...value, serviceId]);
    } else {
      onChange(value.filter(id => id !== serviceId));
    }
  };
  
  // Toggle all services in a category
  const toggleCategory = (category: string, checked: boolean) => {
    if (disabled) return;
    
    const categoryServiceIds = groupedServices[category]?.map((service: any) => service.id) || [];
    
    if (checked) {
      // Add all services in this category that aren't already selected
      const newValue = [...value];
      
      categoryServiceIds.forEach(id => {
        if (!newValue.includes(id)) {
          newValue.push(id);
        }
      });
      
      onChange(newValue);
    } else {
      // Remove all services in this category
      onChange(value.filter(id => !categoryServiceIds.includes(id)));
    }
  };
  
  // Toggle all services
  const toggleAll = (checked: boolean) => {
    if (disabled) return;
    
    if (checked) {
      // Select all services
      onChange(services.map((service: any) => service.id));
    } else {
      // Deselect all services
      onChange([]);
    }
  };
  
  // Filter services by search term
  const filteredGroups = Object.keys(groupedServices || {})
    .filter(category => {
      if (!searchTerm) return true;
      
      // Check if category name matches
      if (category.toLowerCase().includes(searchTerm.toLowerCase())) return true;
      
      // Check if any service in the category matches
      return (groupedServices[category] || []).some(service => 
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    })
    .reduce((acc, category) => {
      // Filter services within the category
      const filteredServices = searchTerm
        ? (groupedServices[category] || []).filter(service => 
            service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : (groupedServices[category] || []);
      
      if (filteredServices.length > 0) {
        acc[category] = filteredServices;
      }
      
      return acc;
    }, {} as Record<string, Service[]>);
  
  // Calculate counts for select all checkbox
  const allServicesCount = services.length;
  const selectedServicesCount = value.length;
  const allSelected = allServicesCount > 0 && selectedServicesCount === allServicesCount;
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingIndicator />
      </div>
    );
  }
  
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Services"
        message={error}
      />
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            disabled={disabled}
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(!!checked)}
            disabled={disabled || services.length === 0}
          />
          <label htmlFor="select-all" className="text-sm font-medium">
            Select All ({selectedServicesCount}/{allServicesCount})
          </label>
        </div>
      </div>
      
      {Object.keys(filteredGroups).length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          {searchTerm
            ? `No services found matching "${searchTerm}"`
            : 'No services available'}
        </div>
      ) : (
        <div className="grid gap-4">
          {Object.entries(filteredGroups).map(([category, categoryServices]) => {
            const categoryServiceIds = categoryServices.map((service: any) => service.id);
            const selectedInCategory = categoryServiceIds.filter(id => value.includes(id));
            const allInCategorySelected = categoryServiceIds.length > 0 && 
              selectedInCategory.length === categoryServiceIds.length;
            const someInCategorySelected = selectedInCategory.length > 0 && 
              selectedInCategory.length < categoryServiceIds.length;
            
            return (
              <Card key={category}>
                <CardContent className="p-4">
                  {/* Category header with checkbox */}
                  <div className="flex items-center mb-3">
                    <Checkbox
                      id={`category-${category}`}
                      checked={allInCategorySelected}
                      indeterminate={someInCategorySelected && !allInCategorySelected}
                      onCheckedChange={(checked) => toggleCategory(category, !!checked)}
                      disabled={disabled}
                    />
                    <label 
                      htmlFor={`category-${category}`}
                      style={{ 
                        marginLeft: '8px', 
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        cursor: 'pointer'
                      }}
                    >
                      {category} ({selectedInCategory.length}/{categoryServiceIds.length})
                    </label>
                  </div>
                  
                  {/* Services with indentation */}
                  <div style={{ marginLeft: '30px' }}>
                    {categoryServices.map((service: any) => (
                      <div 
                        key={service.id} 
                        className="flex items-start space-x-2 mb-2"
                      >
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={value.includes(service.id)}
                          onCheckedChange={(checked) => handleCheckboxChange(service.id, !!checked)}
                          disabled={disabled}
                        />
                        <div>
                          <label 
                            htmlFor={`service-${service.id}`}
                            style={{
                              marginLeft: '4px',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            {service.name}
                          </label>
                          {service.description && (
                            <p style={{ 
                              fontSize: '0.75rem', 
                              color: '#6b7280', 
                              marginTop: '2px' 
                            }}>
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}