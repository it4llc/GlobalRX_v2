// src/components/modules/customer/customer-debug.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

interface CustomerDebugProps {
  customerId: string;
}

export function CustomerDebug({ customerId }: CustomerDebugProps) {
  const { fetchWithAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [rawData, setRawData] = useState<string>('');

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`Fetching customer data for ID: ${customerId}`);
        const response = await fetchWithAuth(`/api/customers/${customerId}`);
        
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch customer (Status: ${response.status})`);
        }
        
        // Parse response
        const data = await response.json();
        console.log('Received data:', data);
        
        // Save raw data
        setRawData(JSON.stringify(data, null, 2));
        
        // Save parsed data
        setCustomerData(data);
        
      } catch (err) {
        console.error('Error fetching customer:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCustomer();
  }, [customerId, fetchWithAuth]);
  
  // Simple data display function
  const displayValue = (obj: any, key: string) => {
    if (!obj) return 'undefined';
    
    const value = obj[key];
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  if (isLoading) {
    return <LoadingIndicator />;
  }
  
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Fetching Customer"
        message={error}
      />
    );
  }
  
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Customer Data Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="font-medium">Field</div>
              <div className="font-medium">Value</div>
              <div className="font-medium">Type</div>
              
              {/* Basic fields */}
              {['id', 'name', 'address', 'contactName', 'contactEmail', 'contactPhone'].map(field => (
                <React.Fragment key={field}>
                  <div>{field}</div>
                  <div>{displayValue(customerData, field)}</div>
                  <div>{customerData && typeof customerData[field]}</div>
                </React.Fragment>
              ))}
              
              {/* Relationship fields */}
              {['masterAccountId', 'billingAccountId', 'invoiceTerms', 'invoiceContact', 'invoiceMethod'].map(field => (
                <React.Fragment key={field}>
                  <div>{field}</div>
                  <div>{displayValue(customerData, field)}</div>
                  <div>{customerData && typeof customerData[field]}</div>
                </React.Fragment>
              ))}
              
              {/* Special fields */}
              <div>services</div>
              <div>
                {customerData?.services ? (
                  <span>Array with {customerData.services.length} items</span>
                ) : (
                  'undefined'
                )}
              </div>
              <div>{customerData && typeof customerData.services}</div>
              
              <div>serviceIds</div>
              <div>
                {customerData?.serviceIds ? (
                  <span>Array with {customerData.serviceIds.length} items</span>
                ) : (
                  'undefined'
                )}
              </div>
              <div>{customerData && typeof customerData.serviceIds}</div>
            </div>
            
            {/* Raw data */}
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-2">Raw Response Data</h3>
              <div className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                <pre className="text-xs">{rawData}</pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <h3 className="text-lg font-medium">First 5 Services</h3>
      {customerData?.services && customerData.services.length > 0 ? (
        <div className="bg-gray-50 p-4 rounded overflow-auto">
          <pre className="text-xs">
            {JSON.stringify(customerData.services.slice(0, 5), null, 2)}
          </pre>
        </div>
      ) : (
        <div>No services found</div>
      )}
    </div>
  );
}