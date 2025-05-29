// src/app/debug-customer/[id]/page.tsx
'use client';

import React from 'react';
import { CustomerDebug } from '@/components/modules/customer/customer-debug';
import { useParams } from 'next/navigation';

export default function CustomerDebugPage() {
  const params = useParams();
  const customerId = params.id as string;
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Customer Data Debug</h1>
      <p className="mb-6">
        This page displays the raw data returned by the API for the customer with ID: <br />
        <span className="font-mono bg-gray-100 p-1 rounded">{customerId}</span>
      </p>
      
      <div className="mb-6">
        <CustomerDebug customerId={customerId} />
      </div>
    </div>
  );
}