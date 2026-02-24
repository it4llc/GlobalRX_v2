'use client';
import clientLogger from '@/lib/client-logger';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WorkflowSectionList } from '@/components/modules/workflows/sections/workflow-section-list';
import { WorkflowSectionDialog } from '@/components/modules/workflows/sections/workflow-section-dialog';
import { PermissionDebug } from '@/components/modules/workflows/sections/permission-debug';
import { ArrowLeft } from 'lucide-react';

interface WorkflowSection {
  id: string;
  name: string;
  displayOrder: number;
  isRequired: boolean;
  dependsOnSection?: string | null;
  dependencyLogic?: string | null;
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  dependentOn?: {
    id: string;
    name: string;
  } | null;
  dependentSections?: {
    id: string;
    name: string;
  }[];
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export default function WorkflowSectionsPage() {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <WorkflowSectionsContent />
    </Suspense>
  );
}

// Client component that uses useSearchParams
function WorkflowSectionsContent() {
  const { t } = useTranslation();
  const { fetchWithAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = useParams();
  const customerId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  
  // Get workflowId from URL query params
  const workflowId = searchParams.get('workflowId');
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [sections, setSections] = useState<WorkflowSection[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Start as false for static rendering
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<WorkflowSection | undefined>(undefined);
  
  // Fetch workflow and sections data
  useEffect(() => {
    // Only run client-side
    if (typeof window === 'undefined') return;
    
    if (!workflowId) {
      setError('No workflow ID provided');
      return;
    }
    
    setIsLoading(true);
    
    const fetchData = async () => {
      setError(null);
      
      try {
        // Fetch workflow details
        const workflowResponse = await fetchWithAuth(`/api/workflows/${workflowId}`);
        
        if (!workflowResponse.ok) {
          throw new Error(`Failed to fetch workflow: ${workflowResponse.status}`);
        }
        
        const workflowData = await workflowResponse.json();
        
        // Validate that this workflow belongs to the current customer
        if (workflowData.customerId && workflowData.customerId !== customerId) {
          throw new Error('Workflow does not belong to this customer');
        }
        
        setWorkflow(workflowData);
        
        // Fetch sections for this workflow
        const sectionsResponse = await fetchWithAuth(`/api/workflows/${workflowId}/sections`);
        
        if (!sectionsResponse.ok) {
          throw new Error(`Failed to fetch sections: ${sectionsResponse.status}`);
        }
        
        const sectionsData = await sectionsResponse.json();
        setSections(sectionsData);
      } catch (err) {
        clientLogger.error('Error fetching workflow data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [workflowId, fetchWithAuth, refreshKey, customerId]);
  
  // Handle "add section" button click
  const handleAddSection = () => {
    setSelectedSection(undefined);
    setDialogOpen(true);
  };
  
  // Handle "edit section" button click
  const handleEditSection = (section: WorkflowSection) => {
    setSelectedSection(section);
    setDialogOpen(true);
  };
  
  // Handle dialog close with success
  const handleDialogSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  // Handle back button click - go back to customer workflows
  const handleBack = () => {
    router.push(`/customer-configs/${customerId}/workflows`);
  };
  
  // Handle client-side rendering states
  if (typeof window !== 'undefined') {
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
          title={t('common.error', 'Error')}
          message={error}
          action={
            <Button onClick={() => router.push(`/customer-configs/${customerId}/workflows`)}>
              {t('common.backToWorkflows', 'Back to Workflows')}
            </Button>
          }
        />
      );
    }
  }
  
  // Only check workflowId on client-side
  if (typeof window !== 'undefined' && !workflowId) {
    return (
      <AlertBox
        type="warning"
        title={t('common.missingParameter', 'Missing Parameter')}
        message={t('module.candidateWorkflow.noWorkflowSelected', 'No workflow selected. Please select a workflow.')}
        action={
          <Button onClick={() => router.push(`/customer-configs/${customerId}/workflows`)}>
            {t('common.backToWorkflows', 'Back to Workflows')}
          </Button>
        }
      />
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', 'Back')}
          </Button>
          <h1 className="text-2xl font-bold">
            {workflow?.name ? `${t('module.candidateWorkflow.sections', 'Sections')}: ${workflow.name}` : t('module.candidateWorkflow.workflowSections', 'Workflow Sections')}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await fetchWithAuth('/api/debug-workflow-permissions');
                const data = await response.json();
                clientLogger.info('Debug permissions:', data);
                alert('Permissions debug info logged to console');
              } catch (err) {
                clientLogger.error('Error fetching permissions debug:', err);
                alert('Error checking permissions: ' + (err instanceof Error ? err.message : String(err)));
              }
            }}
          >
            Debug Permissions
          </Button>
        </div>
        
        {workflow?.status === 'archived' && (
          <Badge variant="secondary" className="bg-gray-200">
            {t('module.candidateWorkflow.status.archived', 'Archived')}
          </Badge>
        )}
      </div>
      
      {/* Description */}
      {workflow?.description && (
        <p className="text-gray-500 mb-6">{workflow.description}</p>
      )}
      
      {/* Debug component */}
      <PermissionDebug />
      
      {/* Section list component */}
      <WorkflowSectionList
        workflowId={workflowId}
        onAddSection={handleAddSection}
        onEditSection={handleEditSection}
      />
      
      {/* Section dialog */}
      <WorkflowSectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflowId={workflowId}
        section={selectedSection}
        availableSections={sections}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}