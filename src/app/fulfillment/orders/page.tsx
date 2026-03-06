// /GlobalRX_v2/src/app/fulfillment/orders/page.tsx

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FulfillmentOrdersPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main fulfillment page which shows the orders list
    router.push('/fulfillment');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-500">Redirecting to fulfillment orders...</div>
      </div>
    </div>
  );
}