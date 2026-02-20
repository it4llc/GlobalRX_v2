'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  permissions: any;
  userType: 'admin' | 'customer';
}

interface CustomerUserEditFormProps {
  customerId: string;
  user: User;
  onSubmit: (user: any) => void;
  onCancel: () => void;
}

interface FormValues {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  permissions: {
    viewOrders: boolean;
    createOrders: boolean;
    editOrders: boolean;
    manageUsers: boolean;
  };
}

export function CustomerUserEditForm({ customerId, user, onSubmit, onCancel }: CustomerUserEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    password: '',
    confirmPassword: '',
    permissions: {
      viewOrders: user.permissions?.orders?.view || false,
      createOrders: user.permissions?.orders?.create || false,
      editOrders: user.permissions?.orders?.edit || false,
      manageUsers: user.permissions?.users?.manage || false,
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePermissionChange = (permission: keyof FormValues['permissions']) => {
    setFormValues((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  const submitForm = async () => {
    // Validation
    if (!formValues.email) {
      alert('Email is required');
      return;
    }

    // Only validate password if it's being changed
    if (formValues.password || formValues.confirmPassword) {
      if (formValues.password !== formValues.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      if (formValues.password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }
    }

    try {
      setLoading(true);

      // Build update data
      const updateData: any = {
        email: formValues.email,
        firstName: formValues.firstName || null,
        lastName: formValues.lastName || null,
        permissions: {
          orders: {
            view: formValues.permissions.viewOrders,
            create: formValues.permissions.createOrders,
            edit: formValues.permissions.editOrders,
          },
          users: {
            manage: formValues.permissions.manageUsers,
          },
        },
      };

      // Only include password if it's being changed
      if (formValues.password) {
        updateData.password = formValues.password;
      }

      const response = await fetch(`/api/customers/${customerId}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      const updatedUser = await response.json();
      onSubmit(updatedUser);
    } catch (err: any) {
      alert(`Error updating user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm();
  };

  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={handleInputChange}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formValues.firstName}
                onChange={handleInputChange}
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formValues.lastName}
                onChange={handleInputChange}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New Password (leave blank to keep current)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formValues.password}
              onChange={handleInputChange}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              placeholder="Re-enter password"
            />
          </div>

          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2 border rounded-md p-3">
              <div className="text-sm font-medium mb-2">Order Permissions</div>
              <div className="space-y-2 ml-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewOrders"
                    checked={formValues.permissions.viewOrders}
                    onCheckedChange={() => handlePermissionChange('viewOrders')}
                  />
                  <Label htmlFor="viewOrders" className="cursor-pointer font-normal">
                    View Orders
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createOrders"
                    checked={formValues.permissions.createOrders}
                    onCheckedChange={() => handlePermissionChange('createOrders')}
                  />
                  <Label htmlFor="createOrders" className="cursor-pointer font-normal">
                    Create Orders
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editOrders"
                    checked={formValues.permissions.editOrders}
                    onCheckedChange={() => handlePermissionChange('editOrders')}
                  />
                  <Label htmlFor="editOrders" className="cursor-pointer font-normal">
                    Edit/Cancel Orders
                  </Label>
                </div>
              </div>

              <div className="text-sm font-medium mt-3 mb-2">User Management</div>
              <div className="space-y-2 ml-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manageUsers"
                    checked={formValues.permissions.manageUsers}
                    onCheckedChange={() => handlePermissionChange('manageUsers')}
                  />
                  <Label htmlFor="manageUsers" className="cursor-pointer font-normal">
                    Manage Customer Users
                  </Label>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              This user will only have access to this customer's data.
            </p>
          </div>
        </div>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={submitForm} disabled={loading}>
          {loading ? 'Updating...' : 'Update User'}
        </Button>
      </DialogFooter>
    </div>
  );
}