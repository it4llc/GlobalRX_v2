// /GlobalRX_v2/src/components/vendors/VendorForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormTable, FormRow, FormActions } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createVendorOrganizationSchema, updateVendorOrganizationSchema } from '@/lib/schemas/vendorSchemas';
import type { VendorOrganization, CreateVendorOrganization, UpdateVendorOrganization } from '@/lib/schemas/vendorSchemas';

interface VendorFormProps {
  mode: 'create' | 'edit';
  vendor?: VendorOrganization;
  onSuccess: (vendor: VendorOrganization) => void;
  onCancel: () => void;
}

type FormData = CreateVendorOrganization;

export function VendorForm({ mode, vendor, onSuccess, onCancel }: VendorFormProps) {
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
    setValue
  } = useForm<FormData>({
    resolver: zodResolver(mode === 'create' ? createVendorOrganizationSchema : updateVendorOrganizationSchema),
    defaultValues: {
      name: '',
      contactEmail: '',
      contactPhone: '',
      isActive: true,
      isPrimary: false,
      address: '',
      notes: ''
    }
  });

  const isPrimaryValue = watch('isPrimary');
  const nameValue = watch('name');

  // Populate form in edit mode
  useEffect(() => {
    if (mode === 'edit' && vendor) {
      reset({
        name: vendor.name,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
        isActive: vendor.isActive,
        isPrimary: vendor.isPrimary,
        address: vendor.address || '',
        notes: vendor.notes || ''
      });
    }
  }, [mode, vendor, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setApiError(null);

      let url = '/api/vendors';
      let method = 'POST';
      let body = data;

      if (mode === 'edit' && vendor) {
        url = `/api/vendors/${vendor.id}`;
        method = 'PUT';

        // Only send changed fields in edit mode
        const changes: Partial<FormData> = {};
        Object.keys(data).forEach(key => {
          const k = key as keyof FormData;
          if (data[k] !== vendor[k]) {
            changes[k] = data[k];
          }
        });
        body = changes as FormData;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save vendor');
      }

      const savedVendor = await response.json();
      onSuccess(savedVendor);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    onCancel();
  };

  const cancelConfirmation = () => {
    setShowCancelConfirm(false);
  };

  return (
    <div className="vendor-form">
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormTable>
          <FormRow
            label="Vendor Name"
            htmlFor="name"
            required
            error={errors.name?.message}
          >
            <Input
              id="name"
              type="text"
              {...register('name')}
              className="w-full"
            />
          </FormRow>

          <FormRow
            label="Contact Email"
            htmlFor="contactEmail"
            required
            error={errors.contactEmail?.message}
          >
            <Input
              id="contactEmail"
              type="email"
              {...register('contactEmail')}
              className="w-full"
            />
          </FormRow>

          <FormRow
            label="Contact Phone"
            htmlFor="contactPhone"
            required
            error={errors.contactPhone?.message}
          >
            <Input
              id="contactPhone"
              type="tel"
              {...register('contactPhone')}
              className="w-full"
            />
          </FormRow>

          <FormRow
            label="Address"
            htmlFor="address"
            error={errors.address?.message}
          >
            <Input
              id="address"
              type="text"
              {...register('address')}
              className="w-full"
            />
          </FormRow>

          <FormRow
            label="Notes"
            htmlFor="notes"
            error={errors.notes?.message}
          >
            <textarea
              id="notes"
              {...register('notes')}
              className="w-full min-h-[80px] border rounded-md px-3 py-2"
              rows={3}
            />
          </FormRow>

          <FormRow label="Active" htmlFor="isActive">
            <div className="flex items-center">
              <input
                id="isActive"
                type="checkbox"
                {...register('isActive')}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm">
                Vendor is active and can receive orders
              </label>
            </div>
          </FormRow>

          <FormRow label="Primary Vendor" htmlFor="isPrimary">
            <div className="flex flex-col">
              <div className="flex items-center">
                <input
                  id="isPrimary"
                  type="checkbox"
                  {...register('isPrimary')}
                  className="mr-2"
                />
                <label htmlFor="isPrimary" className="text-sm">
                  Set as primary vendor for automatic order assignment
                </label>
              </div>
              {isPrimaryValue && (
                <p className="text-sm text-orange-600 mt-1">
                  Only one vendor can be marked as primary. Setting this will unset any other primary vendor.
                </p>
              )}
            </div>
          </FormRow>
        </FormTable>

        {apiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{apiError}</p>
          </div>
        )}

        <FormActions>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </FormActions>
      </form>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md">
            <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
            <p className="text-gray-700 mb-6">
              You have unsaved changes. Are you sure you want to cancel?
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={cancelConfirmation}
              >
                Continue Editing
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancel}
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}