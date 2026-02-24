'use client';
import clientLogger from '@/lib/client-logger';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AlertBox } from '@/components/ui/alert-box';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

export function CloseButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchWithAuth } = useAuth();
  const { t } = useTranslation();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const workflowId = searchParams.get('workflowId');
  
  useEffect(() => {
    if (!workflowId) return;
    
    const getCustomerId = async () => {
      try {
        const response = await fetchWithAuth(`/api/workflows/${workflowId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch workflow');
        }
        
        const data = await response.json();
        if (data.customerId) {
          setCustomerId(data.customerId);
        }
      } catch (err) {
        clientLogger.error('Error fetching workflow customer:', err);
        setError('Could not determine customer for this workflow');
      }
    };
    
    getCustomerId();
  }, [workflowId, fetchWithAuth]);
  
  const handleBack = () => {
    if (customerId) {
      router.push(`/customer-configs/${customerId}/workflows`);
    } else {
      router.push('/customer-configs/workflows');
    }
  };
  
  if (error) {
    return (
      <AlertBox
        type="warning"
        title="Navigation Issue"
        message={error}
      />
    );
  }
  
  return (
    <Button variant="outline" onClick={handleBack} className="mb-4">
      <ArrowLeft className="h-4 w-4 mr-2" />
      {customerId 
        ? t('module.candidateWorkflow.backToCustomerWorkflows', 'Back to Customer Workflows') 
        : t('common.back', 'Back')}
    </Button>
  );
}