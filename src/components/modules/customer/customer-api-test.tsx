// src/components/modules/customer/customer-api-test.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

export function CustomerApiTest() {
  const [customerId, setCustomerId] = useState('');
  const [results, setResults] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchWithAuth } = useAuth();
  
  const handleTest = async () => {
    if (!customerId) {
      setError('Please enter a customer ID');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResults('');
    
    try {
      console.log(`Testing API call to /api/customers/${customerId}`);
      
      // Test with fetch first
      const fetchResponse = await fetch(`/api/customers/${customerId}`);
      
      let fetchResult = `Regular fetch: ${fetchResponse.status} ${fetchResponse.statusText}\n`;
      
      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        fetchResult += `Data received: ${JSON.stringify(data, null, 2)}\n\n`;
      } else {
        fetchResult += `Error content: ${await fetchResponse.text()}\n\n`;
      }
      
      // Now test with fetchWithAuth
      const authResponse = await fetchWithAuth(`/api/customers/${customerId}`);
      
      let authResult = `Auth fetch: ${authResponse.status} ${authResponse.statusText}\n`;
      
      if (authResponse.ok) {
        const data = await authResponse.json();
        authResult += `Data received: ${JSON.stringify(data, null, 2)}`;
      } else {
        authResult += `Error content: ${await authResponse.text()}`;
      }
      
      setResults(fetchResult + authResult);
    } catch (err) {
      console.error('Test error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="p-4 border rounded-md space-y-4">
      <h2 className="text-lg font-semibold">Customer API Test</h2>
      
      <div className="flex gap-2">
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Enter customer ID"
          className="max-w-md"
        />
        
        <Button onClick={handleTest} disabled={isLoading}>
          {isLoading ? 'Testing...' : 'Test API Call'}
        </Button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}
      
      {results && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Results:</h3>
          <pre className="p-3 bg-gray-50 border rounded overflow-auto text-sm">
            {results}
          </pre>
        </div>
      )}
    </div>
  );
}