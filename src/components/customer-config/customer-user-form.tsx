'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';

interface CustomerUserFormProps {
  customerId: string;
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

export function CustomerUserForm({ customerId, onSubmit, onCancel }: CustomerUserFormProps) {
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    permissions: {
      viewOrders: true,
      createOrders: true,
      editOrders: false,
      manageUsers: false,
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
    if (!formValues.email || !formValues.password) {
      alert('Email and password are required');
      return;
    }

    if (formValues.password !== formValues.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formValues.password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);

      // Convert form permissions to API format
      const permissions = {
        orders: {
          view: formValues.permissions.viewOrders,
          create: formValues.permissions.createOrders,
          edit: formValues.permissions.editOrders,
        },
        users: {
          manage: formValues.permissions.manageUsers,
        },
      };

      const response = await fetch(`/api/customers/${customerId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formValues.email,
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          password: formValues.password,
          permissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const newUser = await response.json();
      onSubmit(newUser);
    } catch (err: any) {
      alert(`Error creating user: ${err.message}`);
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
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formValues.password}
              onChange={handleInputChange}
              placeholder="Minimum 8 characters"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              placeholder="Re-enter password"
              required
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
          {loading ? 'Creating...' : 'Create User'}
        </Button>
      </DialogFooter>
    </div>
  );
}