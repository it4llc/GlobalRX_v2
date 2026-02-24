'use client';
import clientLogger from '@/lib/client-logger';

import { useRouter, useParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

export default function CustomerConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { id } = useParams();
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const customerId = id as string;

  // Fetch customer details
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetchWithAuth(`/api/customers/${customerId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch customer information');
        }
        
        const data = await response.json();
        setCustomer(data);
      } catch (err) {
        clientLogger.error('Error fetching customer info:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (customerId) {
      fetchCustomerInfo();
    }
  }, [customerId, fetchWithAuth]);

  // Determine which tab is active based on the URL
  const getActiveTab = () => {
    if (pathname.includes(`/customer-configs/${customerId}/packages`)) {
      return 'packages';
    } else if (pathname.includes(`/customer-configs/${customerId}/workflows`)) {
      return 'workflows';
    } else if (pathname.includes(`/customer-configs/${customerId}/users`)) {
      return 'users';
    } else {
      return 'details';
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'details') {
      router.push(`/customer-configs/${customerId}`);
    } else {
      router.push(`/customer-configs/${customerId}/${value}`);
    }
  };

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
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/customer-configs')}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('module.customerConfig.backToCustomerList')}
          </Button>
        </div>

        {/* Customer Name */}
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold">{customer?.name || 'Loading...'}</h1>
        </div>

        {/* Tabs */}
        <Tabs
          defaultValue={getActiveTab()}
          value={getActiveTab()}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="details">
              {t('module.customerConfig.tabs.details')}
            </TabsTrigger>
            <TabsTrigger value="packages">
              {t('module.customerConfig.tabs.packages')}
            </TabsTrigger>
            <TabsTrigger value="workflows">
              {t('module.customerConfig.tabs.workflows')}
            </TabsTrigger>
            <TabsTrigger value="users">
              {t('module.customerConfig.tabs.users')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={getActiveTab()} className="mt-6 w-full">
            {children}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}