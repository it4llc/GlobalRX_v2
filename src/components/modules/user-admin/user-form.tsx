// /GlobalRX_v2/src/components/modules/user-admin/user-form.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Types
type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userType?: 'internal' | 'customer' | 'vendor';
  customerId?: string | null;
  vendorId?: string | null;
  permissions: {
    countries?: string[];
    services?: string[];
    dsx?: string[];
    customers?: string[];
    user_admin?: boolean;
    global_config?: boolean;
    customer_config?: boolean | string[];
    vendors?: boolean;
    fulfillment?: boolean;
    comment_management?: boolean;
    candidates_invite?: boolean;
  };
};

type FormValues = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  userType: 'internal' | 'customer' | 'vendor';
  vendorId: string;
  customerId: string;
  permissions: {
    user_admin: boolean;
    global_config: boolean;
    customer_config: boolean;
    vendors: boolean;
    fulfillment: boolean;
    comment_management: boolean;
    candidates_invite: boolean;
  };
};

type UserFormProps = {
  user?: User | null;
  onSubmit: (user: User) => void;
  onCancel: () => void;
};

export function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Array<{id: string; name: string; isPrimary?: boolean}>>([]);
  const [customers, setCustomers] = useState<Array<{id: string; name: string}>>([]);
  const [formValues, setFormValues] = useState<FormValues>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    userType: 'internal',
    vendorId: '',
    customerId: '',
    permissions: {
      user_admin: false,
      global_config: false,
      customer_config: false,
      vendors: false,
      fulfillment: false,
      comment_management: false,
      candidates_invite: false,
    },
  });

  // Fetch vendors when component mounts
  useEffect(() => {
    fetch('/api/vendors')
      .then(res => res.json())
      // DEFENSIVE HANDLING: API can return either array or paginated response {data: [...], meta: {...}}
      // This prevents "customers.map is not a function" error when API response format changes
      // Bug fix: UserForm was crashing when APIs changed from plain arrays to paginated responses
      .then(data => setVendors(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {
        // Silently fail - vendors list will be empty
        setVendors([]);
      });

    fetch('/api/customers')
      .then(res => res.json())
      // DEFENSIVE HANDLING: API can return either array or paginated response {data: [...], meta: {...}}
      // This prevents "customers.map is not a function" error when API response format changes
      // Bug fix: UserForm was crashing when APIs changed from plain arrays to paginated responses
      .then(data => setCustomers(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {
        // Silently fail - customers list will be empty
        setCustomers([]);
      });
  }, []);

  // Set form values when editing a user
  useEffect(() => {
    if (user) {
      const newFormValues = {
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        password: '',
        confirmPassword: '',
        userType: user.userType || 'internal',
        vendorId: user.vendorId || '',
        customerId: user.customerId || '',
        permissions: {
          user_admin: !!user.permissions?.user_admin,
          global_config: !!user.permissions?.global_config,
          customer_config: !!user.permissions?.customer_config || !!user.permissions?.customers,
          vendors: !!user.permissions?.vendors,
          fulfillment: !!user.permissions?.fulfillment,
          comment_management: !!user.permissions?.comment_management,
          candidates_invite: !!user.permissions?.candidates?.invite,
        },
      };
      setFormValues(newFormValues);
    }
  }, [user]);

  // Handle vendor user permission restrictions
  useEffect(() => {
    if (formValues.userType === 'vendor') {
      // Vendor users can only have fulfillment permission
      setFormValues(prev => ({
        ...prev,
        permissions: {
          user_admin: false,
          global_config: false,
          customer_config: false,
          vendors: false,
          fulfillment: true,
          comment_management: false,
        },
      }));
    }
  }, [formValues.userType]);

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
      
      // Convert permission booleans to appropriate format
      const permissionsObj: any = {};

      Object.keys(formValues.permissions).forEach((key) => {
        const permKey = key as keyof FormValues['permissions'];
        if (formValues.permissions[permKey]) {
          // Single permissions that represent a specific capability use boolean true
          // (not array format) because they don't have sub-actions like "view", "edit"
          if (key === 'comment_management' || key === 'user_admin' || key === 'global_config' ||
              key === 'fulfillment' || key === 'vendors') {
            permissionsObj[key] = true;
          } else if (key === 'candidates_invite') {
            // candidates.invite permission is stored as nested object
            permissionsObj['candidates'] = { invite: true };
          } else {
            // Multi-action permissions (like customer_config) use array format for sub-permissions
            permissionsObj[key] = ['*'];
          }
        }
      });

      if (user) {
        // Update existing user
        const updateData: any = {
          email: formValues.email,
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          userType: formValues.userType,
          vendorId: formValues.userType === 'vendor' ? formValues.vendorId : null,
          customerId: formValues.userType === 'customer' ? formValues.customerId : null,
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
            userType: formValues.userType,
            vendorId: formValues.userType === 'vendor' ? formValues.vendorId : null,
            customerId: formValues.userType === 'customer' ? formValues.customerId : null,
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
          
          <div className="space-y-1">
            <Label htmlFor="userType">User Type</Label>
            <Select
              value={formValues.userType}
              onValueChange={(value: 'internal' | 'customer' | 'vendor') => {
                if (value) { // Only update if value is not empty
                  setFormValues(prev => ({ ...prev, userType: value }));
                }
              }}
            >
              <SelectTrigger id="userType">
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formValues.userType === 'vendor' && (
            <div className="space-y-1">
              <Label htmlFor="vendorId">Vendor Organization</Label>
              <Select
                value={formValues.vendorId}
                onValueChange={(value) => setFormValues(prev => ({ ...prev, vendorId: value }))}
              >
                <SelectTrigger id="vendorId">
                  <SelectValue placeholder="Select vendor organization" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name} {vendor.isPrimary ? '(Primary)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formValues.userType === 'customer' && (
            <div className="space-y-1">
              <Label htmlFor="customerId">Customer Organization</Label>
              <Select
                value={formValues.customerId}
                onValueChange={(value) => setFormValues(prev => ({ ...prev, customerId: value }))}
              >
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="Select customer organization" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="user_admin"
                  checked={formValues.permissions.user_admin}
                  onCheckedChange={() => handlePermissionChange('user_admin')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="user_admin" className="cursor-pointer">User Admin</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="global_config"
                  checked={formValues.permissions.global_config}
                  onCheckedChange={() => handlePermissionChange('global_config')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="global_config" className="cursor-pointer">Global Config</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customer_config"
                  checked={formValues.permissions.customer_config}
                  onCheckedChange={() => handlePermissionChange('customer_config')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="customer_config" className="cursor-pointer">Customer Config</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vendors"
                  checked={formValues.permissions.vendors}
                  onCheckedChange={() => handlePermissionChange('vendors')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="vendors" className="cursor-pointer">Vendors</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fulfillment"
                  checked={formValues.permissions.fulfillment}
                  onCheckedChange={() => handlePermissionChange('fulfillment')}
                />
                <Label htmlFor="fulfillment" className="cursor-pointer">Fulfillment</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="comment_management"
                  checked={formValues.permissions.comment_management}
                  onCheckedChange={() => handlePermissionChange('comment_management')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="comment_management" className="cursor-pointer">Comment Management</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="candidates_invite"
                  checked={formValues.permissions.candidates_invite}
                  onCheckedChange={() => handlePermissionChange('candidates_invite')}
                  disabled={formValues.userType === 'vendor'}
                />
                <Label htmlFor="candidates_invite" className="cursor-pointer">Candidate Invitations</Label>
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