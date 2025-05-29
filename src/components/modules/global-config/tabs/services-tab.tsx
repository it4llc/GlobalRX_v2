'use client';
// src/components/modules/global-config/tabs/services-tab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { ServiceForm } from '@/components/modules/global-config/services/service-form';
import { ServiceFilterBar } from '@/components/modules/global-config/services/service-filter-bar';

// Define the Service type
interface Service {
  id: string;
  name: string;
  category: string;
  description: string | null;
  functionalityType: string;
  disabled: boolean;
  usage: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { firstName: string | null; lastName: string | null; email: string } | null;
  updatedBy: { firstName: string | null; lastName: string | null; email: string } | null;
}

const ITEMS_PER_PAGE = 10;

export function ServicesTab() {
  // State variables
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // Initialize with functionality types in the desired order
  const [functionalityTypes, setFunctionalityTypes] = useState<string[]>(['record', 'verification-edu', 'verification-emp', 'other']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedFunctionalityType, setSelectedFunctionalityType] = useState('all-types');
  const [showDisabled, setShowDisabled] = useState(false);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [serviceToToggle, setServiceToToggle] = useState<Service | null>(null);

  // Dialog ref
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Fetch services
  const fetchServices = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', currentPage.toString());
      queryParams.set('pageSize', ITEMS_PER_PAGE.toString());
      
      if (searchTerm) {
        queryParams.set('search', searchTerm);
      }
      
      if (selectedCategory && selectedCategory !== 'all-categories') {
        queryParams.set('category', selectedCategory);
      }
      
      if (selectedFunctionalityType && selectedFunctionalityType !== 'all-types') {
        queryParams.set('functionalityType', selectedFunctionalityType);
      }
      
      queryParams.set('includeDisabled', showDisabled.toString());
      
      const response = await fetch(`/api/services?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      
      const data = await response.json();
      setServices(data.services || []);
      setCategories(data.categories || []);
      
      // Update functionality types if provided by the API but maintain the order
      if (data.functionalityTypes && Array.isArray(data.functionalityTypes)) {
        // Keep the current order but ensure all types from API are included
        const currentTypes = [...functionalityTypes];
        const newTypes = data.functionalityTypes.filter(
          (type: string) => !currentTypes.includes(type)
        );
        
        if (newTypes.length > 0) {
          setFunctionalityTypes([...currentTypes, ...newTypes]);
        }
      }
      
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch services when filters or pagination change
  useEffect(() => {
    fetchServices();
  }, [currentPage, searchTerm, selectedCategory, selectedFunctionalityType, showDisabled]);

  // Handle adding a new service
  const handleAddService = () => {
    console.log("Add New Service button clicked");
    setCurrentService(null);
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  };

  // Handle editing a service
  const handleEditService = (service: Service) => {
    console.log("Edit service button clicked for:", service.name);
    setCurrentService(service);
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    console.log("Closing dialog");
    if (dialogRef.current) {
      dialogRef.current.close();
    }
  };

  // Handle toggling service status
  const handleToggleStatus = (service: Service) => {
    setServiceToToggle(service);
    setAlertDialogOpen(true);
  };

  // Confirm toggle status
  const confirmToggleStatus = async () => {
    if (!serviceToToggle) return;
    
    try {
      const response = await fetch(`/api/services/${serviceToToggle.id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle service status');
      }
      
      // Refresh services after toggling
      fetchServices();
    } catch (err) {
      console.error('Error toggling service status:', err);
      setError('Failed to update service status. Please try again.');
    } finally {
      setAlertDialogOpen(false);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    try {
      if (currentService) {
        // Update existing service
        const response = await fetch(`/api/services/${currentService.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update service');
        }
      } else {
        // Create new service
        const response = await fetch('/api/services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create service');
        }
      }
      
      // Close dialog and refresh services
      handleCloseDialog();
      fetchServices();
    } catch (err) {
      console.error('Error saving service:', err);
      setError('Failed to save service. Please try again.');
    }
  };

  // Group services by functionality type
  const groupedServices = services.reduce((acc, service) => {
    const type = service.functionalityType || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Map functionality types to display titles
  const getDisplayTitle = (type: string): string => {
    switch (type) {
      case 'verification-emp': return 'Verification - Employment';
      case 'verification-edu': return 'Verification - Education';
      case 'record': return 'Records';
      default: return 'Other';
    }
  };

  // Column width definitions for consistent table layout
  const columnWidths = {
    name: "22%",
    category: "15%",
    description: "33%",
    usage: "10%",
    status: "10%",
    actions: "10%"
  };

  // Force the table to use 100% of the available width
  const tableStyles = {
    width: "100%",
    tableLayout: "fixed" as const,
    borderCollapse: "collapse" as const
  };

  return (
    <div className="content-section w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Services Management</h2>
        <Button onClick={handleAddService}>Add New Service</Button>
      </div>

      {/* Filter bar */}
      <ServiceFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedFunctionalityType={selectedFunctionalityType}
        setSelectedFunctionalityType={setSelectedFunctionalityType}
        showDisabled={showDisabled}
        setShowDisabled={setShowDisabled}
        categories={categories}
        functionalityTypes={functionalityTypes}
      />

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
          {error}
        </div>
      )}

      {/* Services table */}
      {loading ? (
        <div className="text-center py-4 mt-4">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-4 mt-4">No services found. Click "Add New Service" to create one.</div>
      ) : (
        <div className="mt-14">
          {/* Display services grouped by functionality type - maintaining the order */}
          {functionalityTypes.map(type => {
            const servicesInGroup = groupedServices[type] || [];
            if (servicesInGroup.length === 0) return null;
            
            const displayTitle = getDisplayTitle(type);
            
            return (
              <div key={type} className="mb-12 w-full">
                <h3 className="text-xl font-bold mb-2 pl-2">{displayTitle}</h3>
                <Table className="w-full table-fixed" style={tableStyles}>
                  <TableHeader>
                    <TableRow className="bg-gray-100">
                      <TableHead style={{ width: columnWidths.name }}>Name</TableHead>
                      <TableHead style={{ width: columnWidths.category }}>Category</TableHead>
                      <TableHead style={{ width: columnWidths.description }}>Description</TableHead>
                      <TableHead style={{ width: columnWidths.usage }}>Usage</TableHead>
                      <TableHead style={{ width: columnWidths.status }}>Status</TableHead>
                      <TableHead style={{ width: columnWidths.actions }} className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicesInGroup.map((service) => {
                      // Create action options for this service
                      const actionOptions = [
                        {
                          label: "Edit",
                          onClick: () => handleEditService(service),
                          color: "rgb(37, 99, 235)" // Blue color
                        },
                        {
                          label: service.disabled ? "Enable" : "Disable",
                          onClick: () => handleToggleStatus(service),
                          color: service.disabled ? "rgb(37, 99, 235)" : "rgb(220, 38, 38)" // Blue for Enable, Red for Disable
                        }
                      ];
                      
                      return (
                        <TableRow 
                          key={service.id} 
                          className={service.disabled ? 'text-gray-400' : ''}
                        >
                          <TableCell 
                            className="font-medium truncate" 
                            style={{ width: columnWidths.name }}
                          >
                            {service.name}
                          </TableCell>
                          <TableCell style={{ width: columnWidths.category }}>
                            {service.category}
                          </TableCell>
                          <TableCell 
                            className="truncate" 
                            title={service.description || ''}
                            style={{ width: columnWidths.description }}
                          >
                            {service.description || '-'}
                          </TableCell>
                          <TableCell style={{ width: columnWidths.usage }}>
                            {service.usage}
                          </TableCell>
                          <TableCell style={{ width: columnWidths.status }}>
                            {service.disabled ? 'Disabled' : 'Active'}
                          </TableCell>
                          <TableCell 
                            className="text-center" 
                            style={{ width: columnWidths.actions }}
                          >
                            <ActionDropdown options={actionOptions} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          {/* Pagination - with clear separation */}
          <div className="flex justify-between items-center mt-16 pt-6 border-t border-gray-200">
            <div className="text-sm">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Dialog for Service Form */}
      <dialog 
        ref={dialogRef} 
        className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-2xl"
      >
        <div className="bg-white p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold">
              {currentService ? 'Edit Service' : 'Add New Service'}
            </h3>
          </div>
          
          <ServiceForm 
            service={currentService} 
            categories={categories}
            functionalityTypes={functionalityTypes}
            onSubmit={handleFormSubmit}
            onCancel={handleCloseDialog}
          />
        </div>
      </dialog>

      {/* Confirm Toggle Status Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {serviceToToggle?.disabled ? 'Enable Service' : 'Disable Service'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {serviceToToggle?.disabled ? 'enable' : 'disable'} "{serviceToToggle?.name}"?
              {!serviceToToggle?.disabled && serviceToToggle?.usage > 0 && (
                <p className="text-red-500 mt-2">
                  Warning: This service is used in {serviceToToggle.usage} package(s).
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus}>
              {serviceToToggle?.disabled ? 'Enable' : 'Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}