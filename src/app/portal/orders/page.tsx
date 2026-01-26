'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function OrdersPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">My Orders</h2>
          <Link
            href="/portal/orders/new"
            className="inline-flex items-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Order
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Your orders will appear here.</p>
      </div>
    </div>
  );
}