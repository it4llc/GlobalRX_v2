'use client';
// src/components/modules/workflows/workflow-list.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { WorkflowFilterBar } from '@/components/modules/workflows/workflow-filter-bar';
import { WorkflowForm } from '@/components/modules/workflows/workflow-form';
import { Badge } from '@/components/ui/badge';

// Define the Workflow type
interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  defaultLanguage: string;
  disabled: boolean;
  expirationDays: number | null;
  autoCloseEnabled: boolean;
  extensionAllowed: boolean;
  extensionDays: number | null;
  createdAt: string;
  updatedAt: string;
  packageCount: number;
  sectionCount: number;
  templateCount: number;
  workflowPackages: {
    package: {
      id: string;
      name: string;
      customer: {
        id: string;
        name: string;
      };
    };
  }[];
  createdBy: { firstName: string | null; lastName: string | null; email: string } | null;
  updatedBy: { firstName: string | null; lastName: string | null; email: string } | null;
}

const ITEMS_PER_PAGE = 10;
const WORKFLOW_STATUSES = ['draft', 'active', 'archived'];

export function WorkflowList() {
  // State variables
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showDisabled, setShowDisabled] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertDialogTitle, setAlertDialogTitle] = useState('');
  const [alertDialogDescription, setAlertDialogDescription] = useState('');
  const [alertDialogAction, setAlertDialogAction] = useState<() => Promise<void>>(() => Promise.resolve());
  const [alertDialogActionLabel, setAlertDialogActionLabel] = useState('');
  
  // Debug state
  const [apiDebugInfo, setApiDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(true);

  // Dialog ref
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Fetch workflows
  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', currentPage.toString());
      queryParams.set('pageSize', ITEMS_PER_PAGE.toString());
      
      if (searchTerm) {
        queryParams.set('search', searchTerm);
      }
      
      if (selectedStatus && selectedStatus !== 'all') {
        queryParams.set('status', selectedStatus);
      }
      
      queryParams.set('includeDisabled', showDisabled.toString());
      
      const response = await fetch(`/api/workflows?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }
      
      const data = await response.json();
      console.log("Received workflows data:", data);
      
      // Enhanced debug logging
      if (data.debug) {
        console.log("API Debug info:", data.debug);
        setApiDebugInfo(data.debug);
      }
      
      // Handle different response formats
      if (Array.isArray(data)) {
        // Direct array of workflows
        console.log("Response is direct array of workflows");
        setWorkflows(data);
        // If data is direct array, we don't have pagination info, so we estimate
        setTotalPages(Math.ceil(data.length / ITEMS_PER_PAGE));
      } else if (data.workflows && Array.isArray(data.workflows)) {
        // Structured response with workflows property
        console.log("Response has workflows array property");
        setWorkflows(data.workflows);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.page || 1);
      } else if (data.message && data.message.includes("raw query")) {
        // Raw query response format
        console.log("Response is from raw query");
        setWorkflows(data.workflows || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.page || 1);
      } else {
        // Unknown format - empty array
        console.error("Unknown response format:", data);
        setWorkflows([]);
        setTotalPages(1);
        setError("Received unexpected data format from server");
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to load workflows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch workflows when filters or pagination change
  useEffect(() => {
    fetchWorkflows();
  }, [currentPage, searchTerm, selectedStatus, showDisabled]);

  // Handle adding a new workflow
  const handleAddWorkflow = () => {
    setCurrentWorkflow(null);
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  };

  // Handle editing a workflow
  const handleEditWorkflow = (workflow: Workflow) => {
    setCurrentWorkflow(workflow);
    if (dialogRef.current) {
      dialogRef.current.showModal();
    }
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    if (dialogRef.current) {
      dialogRef.current.close();
    }
  };

  // Handle toggling workflow status
  const handleToggleStatus = (workflow: Workflow) => {
    setAlertDialogTitle(workflow.disabled ? 'Enable Workflow' : 'Disable Workflow');
    setAlertDialogDescription(`Are you sure you want to ${workflow.disabled ? 'enable' : 'disable'} "${workflow.name}"?`);
    setAlertDialogActionLabel(workflow.disabled ? 'Enable' : 'Disable');
    
    setAlertDialogAction(() => async () => {
      try {
        const response = await fetch(`/api/workflows/${workflow.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'toggleDisabled'
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to toggle workflow status');
        }
        
        // Refresh workflows after toggling
        fetchWorkflows();
      } catch (err) {
        console.error('Error toggling workflow status:', err);
        setError('Failed to update workflow status. Please try again.');
      } finally {
        setAlertDialogOpen(false);
      }
    });
    
    setAlertDialogOpen(true);
  };

  // Handle changing workflow status
  const handleChangeStatus = (workflow: Workflow, newStatus: string) => {
    if (workflow.status === newStatus) return;
    
    const statusVerb = 
      newStatus === 'active' ? 'activate' : 
      newStatus === 'archived' ? 'archive' : 'save as draft';
    
    setAlertDialogTitle(`Change Workflow Status`);
    setAlertDialogDescription(`Are you sure you want to ${statusVerb} "${workflow.name}"?`);
    setAlertDialogActionLabel('Change Status');
    
    setAlertDialogAction(() => async () => {
      try {
        const response = await fetch(`/api/workflows/${workflow.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'updateStatus',
            status: newStatus
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update workflow status');
        }
        
        // Refresh workflows after updating
        fetchWorkflows();
      } catch (err) {
        console.error('Error updating workflow status:', err);
        setError('Failed to update workflow status. Please try again.');
      } finally {
        setAlertDialogOpen(false);
      }
    });
    
    setAlertDialogOpen(true);
  };

  // Handle deleting a workflow
  const handleDeleteWorkflow = (workflow: Workflow) => {
    setAlertDialogTitle('Delete Workflow');
    setAlertDialogDescription(`Are you sure you want to delete "${workflow.name}"? This action cannot be undone.`);
    setAlertDialogActionLabel('Delete');
    
    setAlertDialogAction(() => async () => {
      try {
        const response = await fetch(`/api/workflows/${workflow.id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete workflow');
        }
        
        // Refresh workflows after deleting
        fetchWorkflows();
      } catch (err) {
        console.error('Error deleting workflow:', err);
        setError('Failed to delete workflow. Please try again.');
      } finally {
        setAlertDialogOpen(false);
      }
    });
    
    setAlertDialogOpen(true);
  };

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    try {
      if (currentWorkflow) {
        // Update existing workflow
        const response = await fetch(`/api/workflows/${currentWorkflow.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update workflow');
        }
      } else {
        // Create new workflow
        const response = await fetch('/api/workflows', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create workflow');
        }
      }
      
      // Close dialog and refresh workflows
      handleCloseDialog();
      fetchWorkflows();
    } catch (err) {
      console.error('Error saving workflow:', err);
      setError('Failed to save workflow. Please try again.');
    }
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Column width definitions for consistent table layout
  const columnWidths = {
    name: "20%",
    description: "30%",
    status: "10%",
    sections: "10%",
    packages: "20%",
    actions: "10%"
  };

  // Force the table to use 100% of the available width
  const tableStyles = {
    width: "100%",
    tableLayout: "fixed" as const,
    borderCollapse: "collapse" as const
  };

  return (
    <div className="content-section w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Workflow Management</h2>
        <Button onClick={handleAddWorkflow}>Add New Workflow</Button>
      </div>

      {/* Debug Info - Only visible in dev */}
      {showDebug && (
        <div className="bg-gray-100 p-4 rounded mb-4 text-xs font-mono">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Workflow API Debug</h3>
            <button 
              onClick={() => setShowDebug(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p>API Status: {loading ? 'Loading...' : error ? 'Error' : 'Data Loaded'}</p>
              <p>Results: {workflows ? workflows.length : 0} workflows found</p>
              <p>Current Page: {currentPage} of {totalPages}</p>
              <p>Error: {error || 'None'}</p>
            </div>
            
            {apiDebugInfo && (
              <div>
                <p>Timestamp: {apiDebugInfo.timestamp}</p>
                <p>Available Models: {apiDebugInfo.prismaModels?.join(', ') || 'None'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <WorkflowFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        showDisabled={showDisabled}
        setShowDisabled={setShowDisabled}
        statuses={WORKFLOW_STATUSES}
      />

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
          {error}
        </div>
      )}

      {/* Workflows table */}
      {loading ? (
        <div className="text-center py-4 mt-4">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-4 mt-4">No workflows found. Click "Add New Workflow" to create one.</div>
      ) : (
        <div className="mt-8">
          <Table className="w-full table-fixed" style={tableStyles}>
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead style={{ width: columnWidths.name }}>Name</TableHead>
                <TableHead style={{ width: columnWidths.description }}>Description</TableHead>
                <TableHead style={{ width: columnWidths.status }}>Status</TableHead>
                <TableHead style={{ width: columnWidths.sections }}>Sections</TableHead>
                <TableHead style={{ width: columnWidths.packages }}>Packages</TableHead>
                <TableHead style={{ width: columnWidths.actions }} className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => {
                // Create action options for this workflow
                const actionOptions = [
                  {
                    label: "Edit",
                    onClick: () => handleEditWorkflow(workflow),
                    color: "rgb(37, 99, 235)" // Blue color
                  },
                  {
                    label: workflow.disabled ? "Enable" : "Disable",
                    onClick: () => handleToggleStatus(workflow),
                    color: workflow.disabled ? "rgb(37, 99, 235)" : "rgb(220, 38, 38)" // Blue for Enable, Red for Disable
                  },
                  {
                    label: "Delete",
                    onClick: () => handleDeleteWorkflow(workflow),
                    color: "rgb(220, 38, 38)" // Red color
                  }
                ];
                
                // Add status change options if not disabled
                if (!workflow.disabled) {
                  WORKFLOW_STATUSES.forEach(status => {
                    if (status !== workflow.status) {
                      actionOptions.splice(1, 0, {
                        label: `Mark as ${status}`,
                        onClick: () => handleChangeStatus(workflow, status),
                        color: "rgb(37, 99, 235)" // Blue color
                      });
                    }
                  });
                }
                
                return (
                  <TableRow 
                    key={workflow.id} 
                    className={workflow.disabled ? 'text-gray-400' : ''}
                  >
                    <TableCell 
                      className="font-medium truncate" 
                      style={{ width: columnWidths.name }}
                    >
                      {workflow.name}
                    </TableCell>
                    <TableCell 
                      className="truncate" 
                      title={workflow.description || ''}
                      style={{ width: columnWidths.description }}
                    >
                      {workflow.description || '-'}
                    </TableCell>
                    <TableCell style={{ width: columnWidths.status }}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(workflow.status)}`}>
                        {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                      </span>
                      {workflow.disabled && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-1">
                          Disabled
                        </span>
                      )}
                    </TableCell>
                    <TableCell style={{ width: columnWidths.sections }}>
                      {workflow.sectionCount}
                    </TableCell>
                    <TableCell 
                      className="truncate" 
                      title={workflow.workflowPackages.map(wp => `${wp.package.customer.name} - ${wp.package.name}`).join(', ')}
                      style={{ width: columnWidths.packages }}
                    >
                      {workflow.packageCount > 0 
                        ? workflow.workflowPackages.slice(0, 2).map(wp => wp.package.name).join(', ') + (workflow.packageCount > 2 ? ` + ${workflow.packageCount - 2} more` : '')
                        : '-'
                      }
                    </TableCell>
                    <TableCell 
                      className="text-center" 
                      style={{ width: columnWidths.actions }}
                    >
                      <ActionDropdown options={actionOptions} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <div className="text-sm">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Dialog for Workflow Form - placeholder, will be implemented later */}
      <dialog 
        ref={dialogRef} 
        className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-2xl"
      >
        <div className="bg-white p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold">
              {currentWorkflow ? 'Edit Workflow' : 'Add New Workflow'}
            </h3>
          </div>
          
          {/* WorkflowForm will be implemented in a separate file */}
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleCloseDialog}>Save (Placeholder)</Button>
          </div>
        </div>
      </dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={alertDialogAction}>
              {alertDialogActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}