'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { PlusCircle, Package } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  disabled: boolean;
}

export default function CustomerPackagesPage() {
  const { fetchWithAuth, checkPermission } = useAuth();
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user has permission to view customers
  const canView = checkPermission('customers', 'view');
  
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetchWithAuth('/api/customers');
        
        if (!response.ok) {
          throw new Error('Failed to fetch customers');
        }
        
        const data = await response.json();
        
        // Check if data is an array and filter out disabled customers
        if (Array.isArray(data)) {
          const activeCustomers = data.filter((customer: Customer) => !customer.disabled);
          setCustomers(activeCustomers);
        } else if (data && typeof data === 'object') {
          // If data is an object with customers property
          const customersData = data.customers || [];
          const activeCustomers = Array.isArray(customersData) 
            ? customersData.filter((customer: Customer) => !customer.disabled)
            : [];
          setCustomers(activeCustomers);
        } else {
          // Handle unexpected data format
          console.error('Unexpected data format:', data);
          setCustomers([]);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (canView) {
      fetchCustomers();
    } else {
      setIsLoading(false);
    }
  }, [fetchWithAuth, canView]);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Customers"
        message={error}
        action={
          <Button onClick={() => window.location.reload()}>Retry</Button>
        }
      />
    );
  }
  
  // Render no permission state
  if (!canView) {
    return (
      <AlertBox
        type="warning"
        title={t('common.noPermission')}
        message={t('common.contactAdmin')}
      />
    );
  }
  
  // Render no customers state
  if (!customers || customers.length === 0) {
    return (
      <AlertBox
        type="info"
        title="No Customers Available"
        message="There are no active customers available. Please create a customer first."
      />
    );
  }
  
  // Sort customers by name for easier navigation
  const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
  
  // Group customers alphabetically
  const groupedCustomers: Record<string, Customer[]> = {};
  
  sortedCustomers.forEach(customer => {
    const firstLetter = customer.name.charAt(0).toUpperCase();
    if (!groupedCustomers[firstLetter]) {
      groupedCustomers[firstLetter] = [];
    }
    groupedCustomers[firstLetter].push(customer);
  });
  
  // Get sorted letter groups
  const letterGroups = Object.keys(groupedCustomers).sort();
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Customer Packages</h2>
          <p className="text-gray-500">
            Select a customer to manage service packages
          </p>
        </div>
      </div>
      
      <div className="space-y-8">
        {letterGroups.map(letter => (
          <div key={letter} className="space-y-4">
            <h3 className="text-lg font-semibold border-b border-gray-200 pb-2">{letter}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedCustomers[letter].map(customer => (
                <Link href={`/customer-configs/${customer.id}/packages`} key={customer.id}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                    </CardHeader>
                    
                    <CardFooter className="pt-0 text-xs text-gray-500 flex items-center">
                      <Package className="h-4 w-4 mr-2" />
                      View Packages
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}