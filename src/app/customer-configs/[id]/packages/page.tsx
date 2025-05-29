'use client';

import { useParams } from 'next/navigation';
import CustomerPackages from '@/components/modules/customer/customers-packages-fixed';

export default function CustomerPackagesPage() {
  const { id } = useParams();
  
  // Make sure to pass the customer ID string to the CustomerPackages component
  const customerId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  
  return (
    <div style={{width: "100%", maxWidth: "100%", overflow: "visible"}}>
      <CustomerPackages customerId={customerId} />
    </div>
  );
}