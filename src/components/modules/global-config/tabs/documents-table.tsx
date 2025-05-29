// src/components/modules/global-config/tabs/documents-table.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { EditDocumentModal, DocumentData } from './edit-document-modal';

interface DocumentsTableProps {
  documents: any[];
  isLoading: boolean;
  onToggleStatus: (documentId: string, currentStatus: boolean) => void;
  onRefresh: () => void;
}

export function DocumentsTable({ documents, isLoading, onToggleStatus, onRefresh }: DocumentsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const { fetchWithAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Log documents structure to help with debugging
  useEffect(() => {
    if (documents && documents.length > 0) {
      console.log("First document structure:", documents[0]);
    }
  }, [documents]);
  
  // Filter documents based on search term and disabled status
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.documentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.scope && doc.scope.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.instructions && doc.instructions.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = showDisabled ? true : !doc.disabled;
    
    return matchesSearch && matchesStatus;
  });

  // Handle document edit
  const handleEdit = (documentId: string) => {
    setSelectedDocumentId(documentId);
  };
  
  // Get document scope value safely
  const getDocumentScope = (doc: any): string => {
    // Try direct property
    if (doc.scope) {
      return doc.scope;
    }
    
    // Try inside documentData as object
    if (doc.documentData && typeof doc.documentData === 'object') {
      return doc.documentData.scope || '';
    }
    
    // Try inside documentData as string
    if (doc.documentData && typeof doc.documentData === 'string') {
      try {
        const parsed = JSON.parse(doc.documentData);
        return parsed.scope || '';
      } catch (e) {
        // Parsing failed, continue
      }
    }
    
    return '';
  };
  
  // Get document instructions safely
  const getDocumentInstructions = (doc: any): string => {
    // Try direct property
    if (doc.instructions) {
      return doc.instructions;
    }
    
    // Try inside documentData as object
    if (doc.documentData && typeof doc.documentData === 'object') {
      return doc.documentData.instructions || '';
    }
    
    // Try inside documentData as string
    if (doc.documentData && typeof doc.documentData === 'string') {
      try {
        const parsed = JSON.parse(doc.documentData);
        return parsed.instructions || '';
      } catch (e) {
        // Parsing failed, continue
      }
    }
    
    return '';
  };
  
  // Get retention handling safely
  const getRetentionHandling = (doc: any): string => {
    // Try direct property
    if (doc.retentionHandling) {
      return doc.retentionHandling;
    }
    
    // Try inside documentData as object
    if (doc.documentData && typeof doc.documentData === 'object') {
      return doc.documentData.retentionHandling || '';
    }
    
    // Try inside documentData as string
    if (doc.documentData && typeof doc.documentData === 'string') {
      try {
        const parsed = JSON.parse(doc.documentData);
        return parsed.retentionHandling || '';
      } catch (e) {
        // Parsing failed, continue
      }
    }
    
    return '';
  };
  
  // Format scope for display
  const getScopeLabel = (scope: string): string => {
    switch (scope) {
      case 'per_case':
        return 'Per Case';
      case 'per_search_type':
        return 'Per Search Type';
      case 'per_search':
        return 'Per Search';
      default:
        return scope || '-';
    }
  };
  
  // Format retention handling for display
  const getRetentionLabel = (retention: string): string => {
    switch (retention) {
      case 'no_delete':
        return 'Don\'t delete';
      case 'customer_rule':
        return 'Customer rule';
      case 'global_rule':
        return 'Global rule';
      default:
        return '-';
    }
  };
  
  // Handle document update
  const handleUpdateDocument = async (updatedDocument: DocumentData) => {
    try {
      setError(null);
      
      const response = await fetchWithAuth(`/api/data-rx/documents/${updatedDocument.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentName: updatedDocument.documentName,
          scope: updatedDocument.scope,
          instructions: updatedDocument.instructions,
          retentionHandling: updatedDocument.retentionHandling,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update document');
      }
      
      // If there's a new PDF file, upload it
      if (updatedDocument.pdfFile) {
        const formData = new FormData();
        formData.append('pdfFile', updatedDocument.pdfFile);
        
        const fileResponse = await fetchWithAuth(`/api/data-rx/documents/${updatedDocument.id}/upload-pdf`, {
          method: 'POST',
          body: formData,
        });
        
        if (!fileResponse.ok) {
          throw new Error('Failed to upload PDF file');
        }
      }
      
      // Refresh data
      onRefresh();
      
    } catch (error) {
      console.error('Error updating document:', error);
      setError('Failed to update document. Please try again.');
    } finally {
      // Clear selected document
      setSelectedDocumentId(null);
    }
  };
  
  // Close edit modal
  const handleCancelEdit = () => {
    setSelectedDocumentId(null);
  };
  
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={() => setShowDisabled(!showDisabled)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2">Show disabled documents</span>
          </label>
        </div>
        
        {/* Debug toggle */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </Button>
      </div>

      {/* Debug Information */}
      {showDebug && documents.length > 0 && (
        <div className="mb-4 p-4 border rounded bg-gray-50 overflow-auto max-h-60">
          <h3 className="font-bold mb-2">First Document Structure:</h3>
          <pre className="text-xs">{JSON.stringify(documents[0], null, 2)}</pre>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p>Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {searchTerm ? (
                <p>No documents matching "{searchTerm}"</p>
              ) : (
                <p>No documents have been created yet. Click "Add Document" to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Instructions</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((document) => {
                  const scope = getDocumentScope(document);
                  const instructions = getDocumentInstructions(document);
                  const retention = getRetentionHandling(document);
                  
                  return (
                    <TableRow 
                      key={document.id}
                      className={document.disabled ? 'opacity-60' : ''}
                    >
                      <TableCell className="font-medium">{document.documentName}</TableCell>
                      <TableCell>{getScopeLabel(scope)}</TableCell>
                      <TableCell className="truncate max-w-xs" title={instructions}>
                        {instructions || '-'}
                      </TableCell>
                      <TableCell>{getRetentionLabel(retention)}</TableCell>
                      <TableCell>
                        {document.disabled ? (
                          <Badge variant="secondary">Disabled</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionDropdown
                          options={[
                            {
                              label: 'Edit',
                              onClick: () => handleEdit(document.id),
                              color: 'rgb(37, 99, 235)', // Blue color
                            },
                            {
                              label: document.disabled ? 'Enable' : 'Disable',
                              onClick: () => onToggleStatus(document.id, document.disabled),
                              color: document.disabled ? 'rgb(37, 99, 235)' : 'rgb(220, 38, 38)', // Blue or red color
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Document Modal */}
      {selectedDocumentId && (
        <EditDocumentModal
          documentId={selectedDocumentId}
          onEditDocument={handleUpdateDocument}
          onCancel={handleCancelEdit}
        />
      )}
    </>
  );
}