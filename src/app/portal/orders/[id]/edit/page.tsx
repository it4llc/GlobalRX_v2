'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  useEffect(() => {
    if (orderId) {
      // Redirect to the new order page with the order ID as a query parameter
      // This will signal the new order page to load in edit mode
      router.push(`/portal/orders/new?edit=${orderId}`);
    }
  }, [orderId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading draft order...</p>
      </div>
    </div>
  );
}