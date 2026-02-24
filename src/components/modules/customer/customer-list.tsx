'use client';
// src/components/modules/customer/customer-list.tsx
import clientLogger from '@/lib/client-logger';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { CustomerDialog } from './customer-dialog';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  masterAccount?: { id: string; name: string } | null;
  billingAccount?: { id: string; name: string } | null;
  subaccountsCount: number;
  packagesCount: number;
  disabled: boolean;
}

export default function CustomerList() {
  const { checkPermission, fetchWithAuth } = useAuth();
  const router = useRouter();
  
  // State variables
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMasterOnly, setShowMasterOnly] = useState(false);
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  
  // Duplicate management state
  const [isDuplicateRemovalMode, setIsDuplicateRemovalMode] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Record<string, string>>({});
  const [duplicateGroups, setDuplicateGroups] = useState<{name: string, customers: Customer[]}[]>([]);
  const [isDuplicateProcessing, setIsDuplicateProcessing] = useState(false);
  
  // Permissions
  const canCreate = checkPermission('customers', 'create');
  const canEdit = checkPermission('customers', 'edit');
  const canDelete = checkPermission('customers', 'delete');
  
  // Column widths for consistent layout
  const columnWidths = {
    name: '25%',
    contact: '15%',
    relationships: '20%',
    counts: '20%',
    status: '10%',
    actions: '10%'
  };
  
  // Load customers
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Explicitly use string literal values for boolean parameters
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        masterOnly: showMasterOnly ? 'true' : 'false',
        includeDisabled: includeDisabled ? 'true' : 'false'
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      clientLogger.info('Fetching customers with params:', {
        page,
        pageSize,
        masterOnly: showMasterOnly,
        includeDisabled: includeDisabled,
        search: searchTerm
      });

      const apiUrl = `/api/customers?${params.toString()}`;
      clientLogger.info('API URL:', apiUrl);

      const response = await fetchWithAuth(apiUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.status}`);
      }

      const data = await response.json();
      clientLogger.info('Received customers:', data.data.length, 'total:', data.meta.total);

      // Sort customers to show master accounts first, then their subaccounts
      const sortedCustomers = sortCustomersByHierarchy(data.data);
      setCustomers(sortedCustomers);
      setTotalPages(data.meta.totalPages);
    } catch (err) {
      clientLogger.error('Error fetching customers:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Sort customers to show master accounts above their subaccounts
  const sortCustomersByHierarchy = (customers: Customer[]) => {
    const sorted: Customer[] = [];
    const processedIds = new Set<string>();

    // First, find all master accounts (no masterAccountId)
    const masterAccounts = customers.filter(c => !c.masterAccount);

    // Process each master account and its subaccounts
    masterAccounts.forEach(master => {
      if (!processedIds.has(master.id)) {
        sorted.push(master);
        processedIds.add(master.id);

        // Find and add all direct subaccounts of this master
        const subaccounts = customers.filter(c =>
          c.masterAccount?.id === master.id && !processedIds.has(c.id)
        );

        subaccounts.forEach(sub => {
          sorted.push(sub);
          processedIds.add(sub.id);
        });
      }
    });

    // Add any remaining customers (edge case)
    customers.forEach(customer => {
      if (!processedIds.has(customer.id)) {
        sorted.push(customer);
      }
    });

    return sorted;
  };
  
  // Initial load and when filters change
  useEffect(() => {
    fetchCustomers();
  }, [page, searchTerm, showMasterOnly, includeDisabled]);
  
  // Handle customer edit
  const handleEdit = (customerId: string) => {
    clientLogger.info("Edit button clicked for customer ID:", customerId);
    setEditingCustomer(customerId);
    setShowDialog(true);
  };
  
  // Handle customer creation
  const handleAddNew = () => {
    clientLogger.info("Add new customer button clicked");
    setEditingCustomer(null);
    setShowDialog(true);
  };
  
  // Handle dialog close
  const handleDialogClose = (shouldRefresh: boolean) => {
    clientLogger.info("Dialog closed, refresh data:", shouldRefresh);
    setShowDialog(false);
    setEditingCustomer(null);
    if (shouldRefresh) {
      fetchCustomers();
    }
  };
  
  // Handle customer status toggle
  const handleToggleStatus = async (customerId: string) => {
    try {
      const response = await fetchWithAuth(`/api/customers/${customerId}/toggle-status`, {
        method: 'PATCH'
      });
      
      if (!response.ok) {
        throw new Error('Failed to update customer status');
      }
      
      // Update customer in the list
      setCustomers(prev => 
        prev.map(customer => 
          customer.id === customerId 
            ? { ...customer, disabled: !customer.disabled } 
            : customer
        )
      );
    } catch (err) {
      clientLogger.error('Error toggling customer status:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Navigate to customer scope
  const handleViewScope = (customerId: string) => {
    // Fix: Use the correct path format for the customer-configs/scope route
    router.push(`/customer-configs/scope/${customerId}`);
  };
  
  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when search changes
  };
  
  // Find duplicates functionality
  const handleFindDuplicates = () => {
    // Group customers by name to find duplicates
    const customersByName: Record<string, Customer[]> = {};
    customers.forEach(customer => {
      if (!customersByName[customer.name]) {
        customersByName[customer.name] = [];
      }
      customersByName[customer.name].push(customer);
    });
    
    // Filter for names with duplicates
    const duplicates = Object.entries(customersByName)
      .filter(([_, group]) => group.length > 1)
      .map(([name, group]) => ({ 
        name, 
        customers: group.sort((a, b) => {
          // Sort by most relationships first (more packages/subaccounts is better to keep)
          const aRelationships = a.packagesCount + a.subaccountsCount;
          const bRelationships = b.packagesCount + b.subaccountsCount;
          return bRelationships - aRelationships;
        }) 
      }));
    
    // Pre-select the customer with most relationships in each group
    const initialSelections: Record<string, string> = {};
    duplicates.forEach(group => {
      if (group.customers.length > 0) {
        initialSelections[group.name] = group.customers[0].id;
      }
    });
    
    setDuplicateGroups(duplicates);
    setSelectedDuplicates(initialSelections);
    setIsDuplicateRemovalMode(true);
  };
  
  // Handle deduplication
  const handleDeduplicateCustomers = async () => {
    try {
      setIsDuplicateProcessing(true);
      setError(null);
      
      // Process each duplicate group
      for (const group of duplicateGroups) {
        const keepCustomerId = selectedDuplicates[group.name];
        
        if (!keepCustomerId) {
          clientLogger.warn(`No customer selected to keep for ${group.name}`);
          continue;
        }
        
        // Get customers to delete (all except the one to keep)
        const deleteCustomerIds = group.customers
          .filter(customer => customer.id !== keepCustomerId)
          .map(customer => customer.id);
        
        if (deleteCustomerIds.length === 0) continue;
        
        // Call API to deduplicate
        const response = await fetchWithAuth('/api/customers/deduplicate', {
          method: 'POST',
          body: JSON.stringify({
            keepCustomerId,
            deleteCustomerIds
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to deduplicate ${group.name}`);
        }
      }
      
      // Reset duplicate mode and refresh data
      setIsDuplicateRemovalMode(false);
      fetchCustomers();
    } catch (err) {
      clientLogger.error('Error deduplicating customers:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsDuplicateProcessing(false);
    }
  };
  
  // Handle duplicate selection change
  const handleDuplicateSelectionChange = (groupName: string, customerId: string) => {
    setSelectedDuplicates(prev => ({
      ...prev,
      [groupName]: customerId
    }));
  };
  
  // Render content
  if (isLoading && customers.length === 0) {
    return <LoadingIndicator />;
  }
  
  return (
    <div className="space-y-6">
      {error && (
        <AlertBox
          type="error"
          title="Error Loading Customers"
          message={error}
          action={<Button onClick={fetchCustomers}>Retry</Button>}
        />
      )}
      
      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full sm:w-64"
          />
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="master-only"
              checked={showMasterOnly}
              onCheckedChange={(checked) => {
                setShowMasterOnly(!!checked);
                setPage(1);
              }}
            />
            <label htmlFor="master-only" className="text-sm">
              Master accounts only
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-disabled"
              checked={includeDisabled}
              onCheckedChange={(checked) => {
                setIncludeDisabled(!!checked);
                setPage(1);
              }}
            />
            <label htmlFor="include-disabled" className="text-sm">
              Include disabled
            </label>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* Find Duplicates functionality removed */}
          {isDuplicateRemovalMode && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsDuplicateRemovalMode(false)}
                disabled={isDuplicateProcessing}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeduplicateCustomers}
                disabled={isDuplicateProcessing || Object.keys(selectedDuplicates).length === 0}
              >
                {isDuplicateProcessing ? 'Processing...' : 'Remove Duplicates'}
              </Button>
            </>
          )}
          
          {canCreate && !isDuplicateRemovalMode && (
            <Button onClick={handleAddNew}>Add Customer</Button>
          )}
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead style={{ width: columnWidths.name }} className="font-bold">Customer Name</TableHead>
              <TableHead style={{ width: columnWidths.contact }} className="font-bold">Contact</TableHead>
              <TableHead style={{ width: columnWidths.relationships }} className="font-bold">Relationships</TableHead>
              <TableHead style={{ width: columnWidths.counts }} className="font-bold">Related Items</TableHead>
              <TableHead style={{ width: columnWidths.status }} className="font-bold">Status</TableHead>
              <TableHead style={{ width: columnWidths.actions }} className="font-bold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No customers found. {canCreate && 'Click "Add Customer" to create one.'}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const isMasterAccount = !customer.masterAccount;
                return (
                  <TableRow
                    key={customer.id}
                    className={`
                      ${customer.disabled ? 'text-gray-400' : ''}
                      ${isMasterAccount ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}
                    `}
                  >
                    <TableCell className="font-medium" title={customer.name}>
                      <div className="flex items-center">
                        {!isMasterAccount && (
                          <span className="text-gray-400 mr-2">└</span>
                        )}
                        <span className={isMasterAccount ? 'font-semibold' : ''}>
                          {customer.name}
                        </span>
                      </div>
                    </TableCell>
                  <TableCell>
                    {customer.contactName ? (
                      customer.contactName
                    ) : (
                      <span className="text-gray-400">No contact</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {(customer.masterAccount || customer.billingAccount) ? (
                      <div>
                        {customer.masterAccount && (
                          <div className="text-sm">
                            <span className="text-gray-500">Master:</span> {customer.masterAccount.name}
                          </div>
                        )}
                        {customer.billingAccount && (
                          <div className="text-sm">
                            <span className="text-gray-500">Bills to:</span> {customer.billingAccount.name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-blue-600">Master Account</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div>
                      <div className="text-sm">
                        <span className="text-gray-500">Subaccounts:</span> {customer.subaccountsCount}
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Packages:</span> {customer.packagesCount}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      customer.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {customer.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <ActionDropdown
                      options={[
                        {
                          label: 'Details',
                          onClick: () => router.push(`/customer-configs/${customer.id}`),
                          color: 'rgb(37, 99, 235)',
                        },
                        {
                          label: 'Packages',
                          onClick: () => router.push(`/customer-configs/${customer.id}/packages`),
                          color: 'rgb(37, 99, 235)',
                        },
                        {
                          label: 'Workflows',
                          onClick: () => router.push(`/customer-configs/${customer.id}/workflows`),
                          color: 'rgb(37, 99, 235)',
                        },
                        ...(canEdit ? [
                          {
                            label: customer.disabled ? 'Enable' : 'Disable',
                            onClick: () => handleToggleStatus(customer.id),
                            color: customer.disabled ? 'rgb(37, 99, 235)' : 'rgb(220, 38, 38)',
                          },
                        ] : []),
                      ]}
                    />
                  </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Duplicate removal UI */}
      {isDuplicateRemovalMode && (
        <div className="mt-6 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Duplicate Customer Removal</h3>
            <p className="text-yellow-700 mb-4">
              Found {duplicateGroups.length} customer names with duplicates. For each group, select which record to keep.
              All relationships (packages, subaccounts, billing) will be transferred to the selected customer.
            </p>
            
            {duplicateGroups.length === 0 ? (
              <div className="text-center p-4 text-gray-500">
                No duplicate customers found.
              </div>
            ) : (
              <div className="space-y-4">
                {duplicateGroups.map(group => (
                  <div key={group.name} className="border border-gray-200 rounded-md p-4 bg-white">
                    <h4 className="font-medium mb-3">Duplicates: {group.name}</h4>
                    <div className="space-y-3">
                      {group.customers.map(customer => (
                        <div key={customer.id} className="flex items-center space-x-2 border-b pb-2 last:border-b-0 last:pb-0">
                          <input 
                            type="radio" 
                            id={`customer-${customer.id}`}
                            name={`group-${group.name}`}
                            checked={selectedDuplicates[group.name] === customer.id}
                            onChange={() => handleDuplicateSelectionChange(group.name, customer.id)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <label htmlFor={`customer-${customer.id}`} className="flex-1">
                            <div className="font-medium">ID: {customer.id.substring(0, 8)}...</div>
                            <div className="text-sm text-gray-500 flex gap-4">
                              <span>Packages: {customer.packagesCount}</span>
                              <span>Subaccounts: {customer.subaccountsCount}</span>
                              {customer.contactName && <span>Contact: {customer.contactName}</span>}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Customer Dialog */}
      {showDialog && (
        <CustomerDialog
          customerId={editingCustomer}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}