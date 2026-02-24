'use client';
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext'; // Ensure this is from contexts, NOT from hooks
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertBox } from '@/components/ui/alert-box';
import { SectionTypeEnum } from '@/types/workflow';

// Form configuration schema
const formConfigSchema = z.object({
  textContent: z.string().optional(),
  requireSignature: z.boolean().optional().default(false),
  requireCheckbox: z.boolean().optional().default(false),
  showIpAddress: z.boolean().optional().default(false),
});

// Define the schema for section form
const sectionFormSchema = z.object({
  name: z.string()
    .min(2, { message: 'Section name must be at least 2 characters long' })
    .max(100, { message: 'Section name must not exceed 100 characters' }),
  displayOrder: z.coerce.number().int().nonnegative(),
  isRequired: z.boolean().default(true),
  dependsOnSection: z.string().optional().nullable(),
  dependencyLogic: z.string().optional().nullable(),
  sectionType: z.enum(SectionTypeEnum.options).default('form'),
  configuration: z.union([
    formConfigSchema,
    z.record(z.string(), z.any()).optional()
  ]).optional(),
});

// Type for the form data
type SectionFormValues = z.infer<typeof sectionFormSchema>;

// Section interface
interface WorkflowSection {
  id: string;
  name: string;
  displayOrder: number;
  isRequired: boolean;
  dependsOnSection?: string | null;
  dependencyLogic?: string | null;
  sectionType?: string;
  configuration?: any;
  workflowId: string;
}

// Props for the dialog component
interface WorkflowSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  section?: WorkflowSection;
  availableSections: WorkflowSection[];
  onSuccess?: () => void;
}

export function WorkflowSectionDialog({ 
  open, 
  onOpenChange, 
  workflowId, 
  section, 
  availableSections,
  onSuccess 
}: WorkflowSectionDialogProps) {
  const { t } = useTranslation();
  const { fetchWithAuth, checkPermission } = useAuth();
  
  // Check both workflows and customers permissions
  const canEdit = checkPermission('workflows', 'edit') || 
                 checkPermission('customers', 'edit') || 
                 checkPermission('admin');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Initialize the form with default values
  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: {
      name: '',
      displayOrder: availableSections.length, // Default to last position
      isRequired: true,
      dependsOnSection: null,
      dependencyLogic: null,
      sectionType: 'form',
      configuration: {
        textContent: '',
        requireSignature: false,
        requireCheckbox: false,
        showIpAddress: false
      },
    },
  });
  
  // Update form when section changes
  useEffect(() => {
    if (section) {
      form.reset({
        name: section.name,
        displayOrder: section.displayOrder,
        isRequired: section.isRequired,
        dependsOnSection: section.dependsOnSection || null,
        dependencyLogic: section.dependencyLogic || null,
        sectionType: section.sectionType || 'form',
        configuration: section.configuration || {
          textContent: '',
          requireSignature: false,
          requireCheckbox: false,
          showIpAddress: false
        },
      });
    } else {
      // For new section, set display order to end of list
      form.reset({
        name: '',
        displayOrder: availableSections.length,
        isRequired: true,
        dependsOnSection: null,
        dependencyLogic: null,
        sectionType: 'form',
        configuration: {
          textContent: '',
          requireSignature: false,
          requireCheckbox: false,
          showIpAddress: false
        },
      });
    }
  }, [section, form, availableSections.length]);
  
  // Reset messages when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [open]);
  
  // Filter out current section from dependency options to prevent circular dependencies
  const dependencyOptions = availableSections.filter(s => !section || s.id !== section.id);
  
  // Handle form submission
  const onSubmit = async (data: SectionFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    
    clientLogger.info('Permission check before submitting:', {
      canEdit,
      'workflows.edit': checkPermission('workflows', 'edit'),
      'customers.edit': checkPermission('customers', 'edit'),
      'admin': checkPermission('admin')
    });
    
    // Check permissions one more time
    if (!canEdit) {
      setError('You do not have permission to edit workflow sections. Required permission: workflows.edit or customers.edit');
      setIsSubmitting(false);
      return;
    }
    
    try {
      const url = section 
        ? `/api/workflows/${workflowId}/sections/${section.id}`
        : `/api/workflows/${workflowId}/sections`;
      
      const method = section ? 'PUT' : 'POST';
      
      // Log the form data being submitted
      clientLogger.info('Submitting form data:', {
        ...data,
        // Convert dependency values for optional fields
        dependsOnSection: data.dependsOnSection || null,
        dependencyLogic: data.dependencyLogic || null
      });
      
      // Make sure all required fields are present and have the correct types
      const requestBody = {
        name: data.name,
        displayOrder: Number(data.displayOrder),
        isRequired: Boolean(data.isRequired),
        dependsOnSection: data.dependsOnSection || null,
        dependencyLogic: data.dependencyLogic || null,
        sectionType: data.sectionType || 'form',
        configuration: data.configuration || {}
      };
      
      const response = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        // Try to parse error details
        let errorMessage = `Failed to ${section ? 'update' : 'create'} section (${response.status})`;
        let errorDetails = {};
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = errorData.permissionCheck || {};
          
          // For validation errors, add more details
          if (response.status === 400 && errorData.details) {
            clientLogger.info('Validation error details:', errorData.details);
            
            // Format validation errors for display
            if (errorData.details.issues && Array.isArray(errorData.details.issues)) {
              const validationErrors = errorData.details.issues.map((issue: any) => 
                `${issue.path.join('.')}: ${issue.message}`
              ).join('; ');
              
              errorMessage += ` - Validation errors: ${validationErrors}`;
            }
          }
          
          clientLogger.info('API Error Response:', errorData);
        } catch (e) {
          // Ignore parsing error
          clientLogger.info('Error parsing API response:', e);
        }
        
        clientLogger.info('API Error Status:', response.status, 'URL:', url);
        clientLogger.info('Form data submitted:', data);
        
        // For forbidden errors, provide more detailed message
        if (response.status === 403) {
          errorMessage += `. Permission check failed: ${JSON.stringify(errorDetails)}`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Show success message
      const action = section ? 'updated' : 'created';
      setSuccessMessage(`Section ${action} successfully!`);
      
      // Close dialog after delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      clientLogger.error('Error saving section:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {section 
              ? t('module.candidateWorkflow.editSection')
              : t('module.candidateWorkflow.createSection')
            }
          </DialogTitle>
          <DialogDescription>
            {t('module.candidateWorkflow.sectionDescription')}
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <AlertBox type="error" title={t('common.error')} message={error} />
        )}
        
        {successMessage && (
          <AlertBox type="success" title={t('common.success')} message={successMessage} />
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('module.candidateWorkflow.sectionNamePlaceholder')} />
                  </FormControl>
                  <FormDescription>
                    {t('module.candidateWorkflow.sectionNameDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Display order */}
            {/* Section Type (only editable for new sections) */}
            <FormField
              control={form.control}
              name="sectionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('module.candidateWorkflow.sectionType')}</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!section} // Disable for existing sections
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('module.candidateWorkflow.selectSectionType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="form">
                          {t('module.candidateWorkflow.sectionTypes.form')}
                        </SelectItem>
                        <SelectItem value="idInfo">
                          {t('module.candidateWorkflow.sectionTypes.idInfo')}
                        </SelectItem>
                        <SelectItem value="personalInfo">
                          {t('module.candidateWorkflow.sectionTypes.personalInfo')}
                        </SelectItem>
                        <SelectItem value="employment">
                          {t('module.candidateWorkflow.sectionTypes.employment')}
                        </SelectItem>
                        <SelectItem value="education">
                          {t('module.candidateWorkflow.sectionTypes.education')}
                        </SelectItem>
                        <SelectItem value="other">
                          {t('module.candidateWorkflow.sectionTypes.other')}
                        </SelectItem>
                        <SelectItem value="documents">
                          {t('module.candidateWorkflow.sectionTypes.documents')}
                        </SelectItem>
                        <SelectItem value="summary">
                          {t('module.candidateWorkflow.sectionTypes.summary')}
                        </SelectItem>
                        <SelectItem value="consent">
                          {t('module.candidateWorkflow.sectionTypes.consent')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    {t('module.candidateWorkflow.sectionTypeDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('module.candidateWorkflow.displayOrder')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      min={0}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('module.candidateWorkflow.displayOrderDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Is Required toggle */}
            <FormField
              control={form.control}
              name="isRequired"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>{t('module.candidateWorkflow.required')}</FormLabel>
                    <FormDescription>
                      {t('module.candidateWorkflow.requiredDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Form/Notice specific configuration */}
            {form.watch('sectionType') === 'form' && (
              <>
                <FormField
                  control={form.control}
                  name="configuration.textContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('module.candidateWorkflow.textContent')}</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={t('module.candidateWorkflow.textContentPlaceholder')}
                          rows={5}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('module.candidateWorkflow.textContentDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="configuration.requireSignature"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>{t('module.candidateWorkflow.requireSignature')}</FormLabel>
                          <FormDescription>
                            {t('module.candidateWorkflow.requireSignatureDescription')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration.requireCheckbox"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>{t('module.candidateWorkflow.requireCheckbox')}</FormLabel>
                          <FormDescription>
                            {t('module.candidateWorkflow.requireCheckboxDescription')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="configuration.showIpAddress"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>{t('module.candidateWorkflow.showIpAddress')}</FormLabel>
                        <FormDescription>
                          {t('module.candidateWorkflow.showIpAddressDescription', 'If enabled, display and capture the user\'s IP address')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Dependencies */}
            {dependencyOptions.length > 0 && (
              <FormField
                control={form.control}
                name="dependsOnSection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('module.candidateWorkflow.dependsOn')}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('module.candidateWorkflow.noDependency')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          {t('module.candidateWorkflow.noDependency')}
                        </SelectItem>
                        {dependencyOptions.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('module.candidateWorkflow.dependencyDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Dependency Logic - Only show if a dependency is selected */}
            {form.watch('dependsOnSection') && (
              <FormField
                control={form.control}
                name="dependencyLogic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('module.candidateWorkflow.dependencyLogic')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "completed"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('module.candidateWorkflow.completed')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="completed">
                          {t('module.candidateWorkflow.completed')}
                        </SelectItem>
                        <SelectItem value="skipped">
                          {t('module.candidateWorkflow.skipped')}
                        </SelectItem>
                        <SelectItem value="either">
                          {t('module.candidateWorkflow.either')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('module.candidateWorkflow.dependencyLogicDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              {error && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetchWithAuth('/api/debug-workflow-permissions');
                      const data = await response.json();
                      clientLogger.info('Debug permissions:', data);
                      setError(`Permissions debug info has been logged to console.`);
                    } catch (err) {
                      clientLogger.error('Error fetching permissions debug:', err);
                    }
                  }}
                >
                  Debug Permissions
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || successMessage !== null}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {t('common.saving')}
                  </>
                ) : successMessage ? (
                  <>
                    <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('common.saved')}
                  </>
                ) : (
                  section ? t('common.save') : t('common.create')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}