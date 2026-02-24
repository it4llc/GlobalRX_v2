"use client";
import clientLogger from '@/lib/client-logger';

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { ActionDropdown } from "@/components/ui/action-dropdown";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/AuthContext";
import { AlertBox } from "@/components/ui/alert-box";
import { WorkflowDialog } from "@/components/modules/workflows/workflow-dialog";

// Define types
interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  defaultLanguage: string;
  expirationDays: number;
  autoCloseEnabled: boolean;
  extensionAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  disabled: boolean;
}

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkPermission } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | undefined>(undefined);

  // For array-based permissions, we just need to check for the resource, not the specific action
  const canManageWorkflows = checkPermission("workflows") || checkPermission("admin");
  // For editing, we still want to check for edit permission if available, but workflows permission is enough
  const canEditWorkflows = checkPermission("workflows") || checkPermission("admin");
  
  // Debug permission checks
  clientLogger.info("Workflow Permission Check:", {
    hasWorkflowsPermission: checkPermission("workflows"),
    hasAdminPermission: checkPermission("admin"),
    canManageWorkflows,
    canEditWorkflows
  });

  // Fetch workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Handle creating a new workflow
  const handleCreateWorkflow = () => {
    setSelectedWorkflow(undefined);
    setDialogOpen(true);
  };

  // Handle editing a workflow
  const handleEditWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setDialogOpen(true);
  };

  // Handle deleting a workflow
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm(t('module.candidateWorkflow.confirmDelete'))) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      // Refresh the list
      fetchWorkflows();
    } catch (err) {
      clientLogger.error('Error deleting workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  // Refactor fetch workflows to a reusable function
  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      clientLogger.info("Fetching workflows...");
      
      const response = await fetch("/api/workflows");
      clientLogger.info("API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        clientLogger.error("API error response:", errorText);
        try {
          // Try to parse error as JSON
          const errorJson = JSON.parse(errorText);
          throw new Error(`API error: ${response.status} - ${errorJson.error || errorText}`);
        } catch (e) {
          // If parsing fails, use text
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
      }
      
      const data = await response.json();
      clientLogger.info("API response data:", data);
      
      // We've simplified the API to just return an array
      if (Array.isArray(data)) {
        clientLogger.info(`Setting ${data.length} workflows from response`);
        setWorkflows(data);
      } else if (data.workflows && Array.isArray(data.workflows)) {
        // Handle the old response format too, just in case
        clientLogger.info(`Setting ${data.workflows.length} workflows from data.workflows`);
        setWorkflows(data.workflows);
      } else {
        clientLogger.info("No valid workflow data in response - using empty array");
        setWorkflows([]);
      }
      
      setError(null);
    } catch (err) {
      clientLogger.error("Error fetching workflows:", err);
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "warning";
      case "archived":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><LoadingSpinner size="lg" /></div>;
  }

  if (!canManageWorkflows) {
    return (
      <AlertBox
        type="warning"
        title={t("common.noPermission")}
        message={t("common.contactAdmin")}
      />
    );
  }
  
  // Only show error on page if we're not loading and there's an error
  const showError = !loading && error;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {t("module.candidateWorkflow.sections.workflows")}
        </h1>
        {canEditWorkflows && (
          <Button onClick={handleCreateWorkflow}>
            {t("module.candidateWorkflow.buttons.createWorkflow")}
          </Button>
        )}
      </div>

      {/* Show error message if present */}
      {showError && (
        <AlertBox 
          type="error" 
          title="Error" 
          message={error || "An unknown error occurred"}
          className="mb-4"
        />
      )}

      {/* Show empty state or workflow table */}
      {(!workflows || workflows.length === 0) ? (
        <div className="p-4 text-center bg-muted rounded-md">
          <p>{showError 
            ? "Unable to load workflows. Please try again later."
            : t("module.candidateWorkflow.noWorkflows")
          }</p>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t("common.name")}</th>
              <th>{t("common.description")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.expirationDays")}</th>
              <th>{t("common.updated")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((workflow) => (
              <tr key={workflow.id}>
                <td>{workflow.name}</td>
                <td>{workflow.description}</td>
                <td>
                  <Badge variant={getStatusBadgeVariant(workflow.status)}>
                    {t(`module.candidateWorkflow.status.${workflow.status}`)}
                  </Badge>
                </td>
                <td>{workflow.expirationDays}</td>
                <td>
                  {workflow.updatedAt ? 
                    new Date(workflow.updatedAt).toLocaleDateString() : 
                    'N/A'
                  }
                </td>
                <td>
                  <ActionDropdown
                    options={[
                      {
                        label: t("common.edit"),
                        onClick: () => handleEditWorkflow(workflow),
                        color: canEditWorkflows ? undefined : "#ccc", // Disable color if cannot edit
                      },
                      {
                        label: t("common.view"),
                        onClick: () => clientLogger.info("View workflow", workflow.id),
                      },
                      {
                        label: t("common.delete"),
                        onClick: () => canEditWorkflows ? handleDeleteWorkflow(workflow.id) : undefined,
                        color: canEditWorkflows ? "rgb(220, 38, 38)" : "#ccc", // Red for delete, or gray if disabled
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      
      <WorkflowDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={selectedWorkflow}
        onSuccess={() => {
          fetchWorkflows();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}