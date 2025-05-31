'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/react-hook-form';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertBox } from '@/components/ui/alert-box';

// Validation schema
const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']),
  defaultLanguage: z.string().default('en-US'),
  expirationDays: z.number().min(1).max(365).default(90),
  autoCloseEnabled: z.boolean().default(true),
  extensionAllowed: z.boolean().default(false),
  extensionDays: z.number().min(1).max(90).optional().nullable(),
  packageIds: z.array(z.string()).optional(),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

interface WorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: {
    id: string;
    name: string;
    description?: string;
    status: string;
    defaultLanguage: string;
    expirationDays: number;
    autoCloseEnabled: boolean;
    extensionAllowed: boolean;
    extensionDays?: number;
    packageIds?: string[];
    customerId?: string;
  };
  customerId?: string;
  onSuccess?: () => void;
}

export function WorkflowDialog({ open, onOpenChange, workflow, customerId, onSuccess }: WorkflowDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [packages, setPackages] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  const form = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'draft',
      defaultLanguage: 'en-US',
      expirationDays: 90,
      autoCloseEnabled: true,
      extensionAllowed: false,
      extensionDays: undefined,
      packageIds: [],
    },
  });

  // Update form values when workflow prop changes
  useEffect(() => {
    if (workflow) {
      form.reset({
        name: workflow.name || '',
        description: workflow.description || '',
        status: (workflow.status as 'draft' | 'active' | 'archived') || 'draft',
        defaultLanguage: workflow.defaultLanguage || 'en-US',
        expirationDays: workflow.expirationDays || 90,
        autoCloseEnabled: workflow.autoCloseEnabled ?? true,
        extensionAllowed: workflow.extensionAllowed ?? false,
        extensionDays: workflow.extensionDays,
        packageIds: workflow.packageIds || [],
      });
    } else {
      form.reset({
        name: '',
        description: '',
        status: 'draft',
        defaultLanguage: 'en-US',
        expirationDays: 90,
        autoCloseEnabled: true,
        extensionAllowed: false,
        extensionDays: undefined,
        packageIds: [],
      });
    }
  }, [workflow, form]);

  // Fetch available packages for the customer
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        // Fetch packages for the specific customer
        const url = customerId ? `/api/customers/${customerId}/packages` : '/api/packages';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch packages');
        const data = await response.json();
        setPackages(data);
      } catch (err) {
        console.error('Error fetching packages:', err);
        setError('Failed to load packages');
      } finally {
        setLoadingPackages(false);
      }
    };

    if (open) {
      fetchPackages();
    }
  }, [open, customerId]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [open]);

  const onSubmit = async (data: WorkflowFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const url = workflow 
        ? `/api/workflows/${workflow.id}`
        : '/api/workflows';
      
      const method = workflow ? 'PUT' : 'POST';
      
      // Make sure packageIds is an array of strings
      if (data.packageIds && !Array.isArray(data.packageIds)) {
        data.packageIds = [data.packageIds as unknown as string];
      }
      
      // Make sure expirationDays is a number
      if (typeof data.expirationDays === 'string') {
        data.expirationDays = parseInt(data.expirationDays);
      }
      
      // Make sure extensionDays is a number if provided
      if (data.extensionDays && typeof data.extensionDays === 'string') {
        data.extensionDays = parseInt(data.extensionDays);
      }
      
      // Log what we're sending
      console.log('Sending workflow data:', JSON.stringify(data, null, 2));
      
      // Add customerId to the data when creating a new workflow
      const requestData = {
        ...data,
        customerId: workflow ? workflow.customerId : customerId
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workflow');
      }

      // Show success message
      const action = workflow ? 'updated' : 'created';
      setSuccessMessage(`Workflow ${action} successfully!`);
      
      // Auto-dismiss success message and close dialog after 2 seconds
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess?.();
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {workflow 
              ? t('module.candidateWorkflow.editWorkflow')
              : t('module.candidateWorkflow.createWorkflow')
            }
          </DialogTitle>
          <DialogDescription>
            {workflow
              ? t('module.candidateWorkflow.editWorkflowDescription')
              : t('module.candidateWorkflow.createWorkflowDescription')
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <AlertBox type="error" title="Error" message={error} />
        )}
        
        {successMessage && (
          <AlertBox type="success" title="Success" message={successMessage} />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.description')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.status')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">{t('module.candidateWorkflow.status.draft')}</SelectItem>
                      <SelectItem value="active">{t('module.candidateWorkflow.status.active')}</SelectItem>
                      <SelectItem value="archived">{t('module.candidateWorkflow.status.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('module.candidateWorkflow.defaultLanguage')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expirationDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.expirationDays')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('module.candidateWorkflow.expirationDaysDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoCloseEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t('module.candidateWorkflow.autoClose')}</FormLabel>
                    <FormDescription>
                      {t('module.candidateWorkflow.autoCloseDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extensionAllowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t('module.candidateWorkflow.extensionAllowed')}</FormLabel>
                    <FormDescription>
                      {t('module.candidateWorkflow.extensionAllowedDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('extensionAllowed') && (
              <FormField
                control={form.control}
                name="extensionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('module.candidateWorkflow.extensionDays')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('module.candidateWorkflow.extensionDaysDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!loadingPackages && packages.length > 0 && (
              <FormField
                control={form.control}
                name="packageIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('module.candidateWorkflow.assignedPackage')}</FormLabel>
                    <div className="space-y-2">
                      {packages.map(pkg => (
                        <div key={pkg.id} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`package-${pkg.id}`}
                            checked={field.value?.includes(pkg.id)}
                            onChange={() => {
                              // Radio buttons should select just one package
                              field.onChange([pkg.id]);
                              console.log(`Selected package: ${pkg.id}`);
                            }}
                            className="rounded-full border-gray-300"
                          />
                          <label htmlFor={`package-${pkg.id}`} className="text-sm">
                            {pkg.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormDescription>
                      {t('module.candidateWorkflow.packageSelectionDescription', 'A workflow can only be associated with one package.')}
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
                    Saved!
                  </>
                ) : (
                  workflow ? t('common.save') : t('common.create')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}