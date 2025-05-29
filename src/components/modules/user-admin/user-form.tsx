// src/components/modules/user-admin/user-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';

// Types
type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  permissions: {
    countries?: string[];
    services?: string[];
    dsx?: string[];
    customers?: string[];
  };
};

type FormValues = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  permissions: {
    countries: boolean;
    services: boolean;
    dsx: boolean;
    customers: boolean;
  };
};

type UserFormProps = {
  user?: User | null;
  onSubmit: (user: User) => void;
  onCancel: () => void;
};

export function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    permissions: {
      countries: false,
      services: false,
      dsx: false,
      customers: false,
    },
  });

  // Set form values when editing a user
  useEffect(() => {
    if (user) {
      setFormValues({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        password: '',
        confirmPassword: '',
        permissions: {
          countries: !!user.permissions?.countries?.length,
          services: !!user.permissions?.services?.length,
          dsx: !!user.permissions?.dsx?.length,
          customers: !!user.permissions?.customers?.length,
        },
      });
    }
  }, [user]);

  // Handle input change for form fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle checkbox change for permissions
  const handlePermissionChange = (permission: keyof FormValues['permissions']) => {
    setFormValues((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  // Handle form submission
  const submitForm = async () => {
    // Password validation for new users
    if (!user && formValues.password !== formValues.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Password validation for existing users (only if password is provided)
    if (user && formValues.password && formValues.password !== formValues.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      
      // Convert permission booleans to string arrays
      const permissionsObj: any = {};
      
      Object.keys(formValues.permissions).forEach((key) => {
        const permKey = key as keyof FormValues['permissions'];
        if (formValues.permissions[permKey]) {
          permissionsObj[key] = ['*']; // Grant full access
        }
      });

      if (user) {
        // Update existing user
        const updateData: any = {
          email: formValues.email,
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          permissions: permissionsObj,
        };
        
        // Only include password if it's being changed
        if (formValues.password) {
          updateData.password = formValues.password;
        }

        const response = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update user');
        }

        const updatedUser = await response.json();
        onSubmit(updatedUser);
      } else {
        // Create new user
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formValues.email,
            firstName: formValues.firstName,
            lastName: formValues.lastName,
            password: formValues.password,
            permissions: permissionsObj,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create user');
        }

        const newUser = await response.json();
        onSubmit(newUser);
      }
    } catch (err: any) {
      alert(`Error ${user ? 'updating' : 'creating'} user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Prevent default form submission
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm();
  };

  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={formValues.firstName}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={formValues.lastName}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="password">{user ? 'New Password (leave blank to keep current)' : 'Password'}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formValues.password}
              onChange={handleInputChange}
              required={!user} // Only required for new users
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              required={!user || !!formValues.password} // Required for new users or if password is provided
            />
          </div>
          
          <div className="space-y-2 pt-1">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="countries"
                  checked={formValues.permissions.countries}
                  onCheckedChange={() => handlePermissionChange('countries')}
                />
                <Label htmlFor="countries" className="cursor-pointer">Countries</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="services"
                  checked={formValues.permissions.services}
                  onCheckedChange={() => handlePermissionChange('services')}
                />
                <Label htmlFor="services" className="cursor-pointer">Services</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="dsx"
                  checked={formValues.permissions.dsx}
                  onCheckedChange={() => handlePermissionChange('dsx')}
                />
                <Label htmlFor="dsx" className="cursor-pointer">DSX</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="customers"
                  checked={formValues.permissions.customers}
                  onCheckedChange={() => handlePermissionChange('customers')}
                />
                <Label htmlFor="customers" className="cursor-pointer">Customers</Label>
              </div>
            </div>
          </div>
        </div>
      </form>
      
      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          type="button" 
          onClick={submitForm} 
          disabled={loading}
        >
          {loading ? 
            (user ? 'Updating...' : 'Creating...') : 
            (user ? 'Update User' : 'Create User')
          }
        </Button>
      </DialogFooter>
    </div>
  );
}