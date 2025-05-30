'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { DropdownPortal } from '@/components/ui/dropdown-portal';
import { Badge } from '@/components/ui/badge';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { useAuth } from '@/contexts/AuthContext';
import { AlertBox } from '@/components/ui/alert-box';
import { WorkflowDialog } from '@/components/modules/workflows/workflow-dialog';

// Define types
interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  defaultLanguage: string;
  expirationDays: number;
  autoCloseEnabled: boolean;
  extensionAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  disabled: boolean;
  customerId?: string;
}

export default function CustomerWorkflowsPage() {
  const { id } = useParams();
  const router = useRouter();
  const customerId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkPermission, fetchWithAuth } = useAuth();
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | undefined>(undefined);
  

  // Permission checks - allow access with either workflow or customer permissions
  const canManageWorkflows = checkPermission('workflows') || checkPermission('customers') || checkPermission('admin');
  const canEditWorkflows = checkPermission('workflows') || checkPermission('customers', 'edit') || checkPermission('admin');

  // Helper function to refresh workflows
  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      console.log('Fetching workflows for customer:', customerId);
      
      // Fetch all workflows and filter by customer
      const workflowsResponse = await fetchWithAuth(`/api/customers/${customerId}/workflows`);
      
      if (!workflowsResponse.ok) {
        const errorText = await workflowsResponse.text();
        console.error('Workflow API Error:', errorText);
        
        // Fallback to fetching all workflows and filtering
        const allWorkflowsResponse = await fetchWithAuth('/api/workflows');
        
        if (!allWorkflowsResponse.ok) {
          throw new Error(`Failed to fetch workflows: ${allWorkflowsResponse.status}`);
        }
        
        const data = await allWorkflowsResponse.json();
        
        // Filter workflows by customer ID
        let customerWorkflows: Workflow[] = [];
        
        if (Array.isArray(data)) {
          customerWorkflows = data.filter(
            workflow => workflow.customerId === customerId
          );
        } else if (data.workflows && Array.isArray(data.workflows)) {
          customerWorkflows = data.workflows.filter(
            workflow => workflow.customerId === customerId
          );
        }
        
        setWorkflows(customerWorkflows);
      } else {
        const data = await workflowsResponse.json();
        setWorkflows(data);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch workflows specific to this customer
  useEffect(() => {
    if (customerId) {
      fetchWorkflows();
    }
  }, [customerId, fetchWithAuth]);

  // Handle creating a new workflow
  const handleCreateWorkflow = () => {
    setSelectedWorkflow(undefined);
    setIsDialogOpen(true);
  };
  
  // Handle editing a workflow
  const handleEditWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (workflow) {
      setSelectedWorkflow(workflow);
      setIsDialogOpen(true);
    }
  };
  
  // Handle workflow dialog success
  const handleWorkflowSuccess = () => {
    // Refresh workflows list
    fetchWorkflows();
  };
  
  // Handle viewing a workflow
  const handleViewWorkflow = (workflowId: string) => {
    // For now, we can open the edit dialog in read-only mode
    // or navigate to a dedicated view page if needed
    handleEditWorkflow(workflowId);
  };
  
  // Handle deleting a workflow
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete workflow');
      }
      
      // Refresh the workflows list
      fetchWorkflows();
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }

  if (!canManageWorkflows) {
    return (
      <AlertBox
        type="warning"
        title={t('common.noPermission')}
        message={t('common.contactAdmin')}
      />
    );
  }
  
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Workflows"
        message={error}
        action={
          <Button onClick={() => window.location.reload()}>Retry</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {t('module.customerConfig.workflows')}
        </h2>
        {canEditWorkflows && (
          <Button onClick={handleCreateWorkflow}>
            {t('module.candidateWorkflow.buttons.createWorkflow')}
          </Button>
        )}
      </div>

      {/* Show empty state or workflow table */}
      {(!workflows || workflows.length === 0) ? (
        <div className="p-4 text-center bg-muted rounded-md">
          <p>No workflows configured for this customer. Click "Create Workflow" to add one.</p>
        </div>
      ) : (
        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.description')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('common.expirationDays')}</TableHead>
              <TableHead>{t('common.updated')}</TableHead>
              <TableHead>{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow key={workflow.id}>
                <TableCell>{workflow.name}</TableCell>
                <TableCell>{workflow.description}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(workflow.status)}>
                    {t(`module.candidateWorkflow.status.${workflow.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{workflow.expirationDays}</TableCell>
                <TableCell>
                  {workflow.updatedAt ? 
                    new Date(workflow.updatedAt).toLocaleDateString() : 
                    'N/A'
                  }
                </TableCell>
                <TableCell className="text-center">
                  <DropdownPortal
                    options={[
                      {
                        label: t('common.edit'),
                        onClick: () => handleEditWorkflow(workflow.id),
                        color: 'rgb(37, 99, 235)',
                      },
                      {
                        label: t('common.view'),
                        onClick: () => handleViewWorkflow(workflow.id),
                        color: 'rgb(37, 99, 235)',
                      },
                      {
                        label: t('common.delete'),
                        onClick: canEditWorkflows ? () => handleDeleteWorkflow(workflow.id) : undefined,
                        color: canEditWorkflows ? 'rgb(220, 38, 38)' : '#ccc',
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
      
      {/* Workflow dialog */}
      <WorkflowDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        workflow={selectedWorkflow}
        customerId={customerId}
        onSuccess={handleWorkflowSuccess}
      />
    </div>
  );
}