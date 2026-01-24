'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertBox } from '@/components/ui/alert-box';

export function PermissionDebug() {
  const { checkPermission, user, fetchWithAuth } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPermissions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check client-side permissions first
      const clientPermissions = {
        'workflows.view': checkPermission('workflows', 'view'),
        'workflows.edit': checkPermission('workflows', 'edit'),
        'customers.view': checkPermission('customers', 'view'),
        'customers.edit': checkPermission('customers', 'edit'),
        'admin': checkPermission('admin'),
        'canEdit': checkPermission('workflows', 'edit') || 
                  checkPermission('customers', 'edit') || 
                  checkPermission('admin'),
        'rawPermissions': user?.permissions
      };
      
      // Then check server-side
      const serverResponse = await fetchWithAuth('/api/debug-session');
      let serverData = { error: 'Failed to parse server response' };
      
      try {
        serverData = await serverResponse.json();
      } catch (e) {
        console.error('Error parsing server response:', e);
      }
      
      // Try the workflow permissions debug endpoint too
      const workflowResponse = await fetchWithAuth('/api/debug-workflow-permissions');
      let workflowData = { error: 'Failed to parse workflow permissions response' };
      
      try {
        workflowData = await workflowResponse.json();
      } catch (e) {
        console.error('Error parsing workflow permissions response:', e);
      }
      
      setDebugInfo({
        clientPermissions,
        serverPermissions: serverData,
        workflowPermissions: workflowData
      });
    } catch (err) {
      console.error('Error checking permissions:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="my-4 p-4 border border-gray-200 rounded-md">
      <h3 className="text-lg font-medium mb-4">Permission Debugging Tool</h3>
      
      {error && (
        <AlertBox 
          type="error" 
          title="Error" 
          message={error}
          className="mb-4"
        />
      )}
      
      <Button 
        onClick={checkPermissions}
        disabled={isLoading}
        variant="outline"
      >
        {isLoading ? 'Checking...' : 'Check Permissions'}
      </Button>
      
      {debugInfo && (
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="font-medium">Client-side Permissions:</h4>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-60">
              {JSON.stringify(debugInfo.clientPermissions, null, 2)}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium">Server-side Permissions:</h4>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-60">
              {JSON.stringify(debugInfo.serverPermissions, null, 2)}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium">Workflow Permissions Debug:</h4>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-60">
              {JSON.stringify(debugInfo.workflowPermissions, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}