'use client';

// src/app/customer-configs/scope/[id]/page.tsx
import clientLogger from '@/lib/client-logger';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CustomerPackages from '@/components/modules/customer/customer-packages';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Button } from '@/components/ui/button';

export default function CustomerScopePage() {
  const { id } = useParams();
  const { fetchWithAuth } = useAuth();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch basic customer info to get the name
        const response = await fetchWithAuth(`/api/customers/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch customer information');
        }
        
        const data = await response.json();
        setCustomerName(data.name);
      } catch (err) {
        clientLogger.error('Error fetching customer info:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchCustomerInfo();
    }
  }, [id, fetchWithAuth]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }
  
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Customer"
        message={error}
        action={
          <Button onClick={() => window.location.reload()}>Retry</Button>
        }
      />
    );
  }
  
  // Make sure to pass the customer ID string to the CustomerPackages component
  const customerId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  
  return (
    <div style={{width: "100%", maxWidth: "100%", overflow: "visible"}}>
      <CustomerPackages customerId={customerId} customerName={customerName} />
    </div>
  );
}