'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CustomerUserForm } from '@/components/customer-config/customer-user-form';
import { CustomerUserEditForm } from '@/components/customer-config/customer-user-edit-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  permissions: any;
  createdAt: string;
  userType: 'admin' | 'customer';
  lastLoginAt?: string;
  mfaEnabled?: boolean;
}

export default function CustomerUsersPage() {
  const { id: customerId } = useParams();
  const { fetchWithAuth, checkPermission } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const canManageUsers = checkPermission('customers', 'edit') || checkPermission('admin');

  useEffect(() => {
    fetchCustomerUsers();
  }, [customerId]);

  const fetchCustomerUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchWithAuth(`/api/customers/${customerId}/users`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getAccessLevel = (user: User): string => {
    if (user.userType === 'customer') {
      // Customer users - check their specific permissions
      const perms = user.permissions || {};
      if (perms.users?.manage) return 'User Manager';
      if (perms.orders?.create) return 'Order Creator';
      if (perms.orders?.view) return 'Viewer';
      return 'Limited Access';
    } else {
      // Admin users
      if (user.permissions?.admin === true) return 'Super Admin';
      if (user.permissions?.customers?.includes('*')) return 'Full Access';
      return 'Admin';
    }
  };

  const getUserBadgeVariant = (userType: 'admin' | 'customer'): 'default' | 'secondary' | 'warning' => {
    return userType === 'admin' ? 'warning' : 'secondary';
  };

  const handleUserAdded = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    setIsAddUserOpen(false);
    fetchCustomerUsers(); // Refresh the list to get updated data
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setIsEditUserOpen(false);
    setSelectedUser(null);
  };

  const handleEditClick = (user: User) => {
    // Only allow editing customer users, not admin users
    if (user.userType !== 'customer') {
      alert('Admin users must be edited through the User Administration page');
      return;
    }
    setSelectedUser(user);
    setIsEditUserOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    // Only allow deleting customer users, not admin users
    if (user.userType !== 'customer') {
      alert('Admin users must be removed through the User Administration page');
      return;
    }
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetchWithAuth(
        `/api/customers/${customerId}/users/${selectedUser.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter(u => u.id !== selectedUser.id));
      setIsDeleteUserOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Users"
        message={error}
        action={
          <Button onClick={fetchCustomerUsers}>Retry</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">
            {t('module.customerConfig.usersWithAccess')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing both admin users with access and customer-specific users
          </p>
        </div>

        {canManageUsers && (
          <Button onClick={() => setIsAddUserOpen(true)}>
            Add Customer User
          </Button>
        )}
      </div>

      {users.length === 0 ? (
        <AlertBox
          type="info"
          title={t('module.customerConfig.noUsers')}
          message={t('module.customerConfig.noUsersDescription')}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.email')}</th>
              <th>User Type</th>
              <th>Access Level</th>
              <th>Last Login</th>
              <th>MFA</th>
              <th>{t('common.createdAt')}</th>
              {canManageUsers && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
              const accessLevel = getAccessLevel(user);

              return (
                <tr key={user.id}>
                  <td>{fullName}</td>
                  <td>{user.email}</td>
                  <td>
                    <Badge variant={getUserBadgeVariant(user.userType)}>
                      {user.userType === 'admin' ? 'Admin' : 'Customer'}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant="secondary">{accessLevel}</Badge>
                  </td>
                  <td>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td>
                    {user.mfaEnabled ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  {canManageUsers && (
                    <td>
                      {user.userType === 'customer' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(user)}
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(user)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Add Customer User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Customer User</DialogTitle>
            <DialogDescription>
              Create a new user account for this customer. They will only have access to this customer's data.
            </DialogDescription>
          </DialogHeader>
          <CustomerUserForm
            customerId={customerId as string}
            onSubmit={handleUserAdded}
            onCancel={() => setIsAddUserOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Customer User Dialog */}
      {selectedUser && selectedUser.userType === 'customer' && (
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Customer User</DialogTitle>
              <DialogDescription>
                Update user information and permissions for this customer.
              </DialogDescription>
            </DialogHeader>
            <CustomerUserEditForm
              customerId={customerId as string}
              user={selectedUser}
              onSubmit={handleUserUpdated}
              onCancel={() => {
                setIsEditUserOpen(false);
                setSelectedUser(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user {selectedUser?.email}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}