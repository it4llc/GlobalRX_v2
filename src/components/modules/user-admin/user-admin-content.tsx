// src/components/modules/user-admin/user-admin-content.tsx
'use client';

import { useState, useEffect } from 'react';
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { UserForm } from '@/components/modules/user-admin/user-form';
import { CheckIcon, XIcon } from 'lucide-react';
import { ActionDropdown } from '@/components/ui/action-dropdown';

// Types
type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userType: 'internal' | 'customer' | 'vendor';
  customerId?: string | null;
  vendorId?: string | null;
  permissions: {
    // Old format (for backward compatibility)
    countries?: string[];
    services?: string[];
    dsx?: string[];
    customers?: string[];
    // New module-based format
    user_admin?: any;
    global_config?: any;
    customer_config?: any;
    candidate_workflow?: any;
    vendors?: any;
    fulfillment?: any;
  };
};

export function UserAdminContent() {
  const [users, setUsers] = useState<User[]>([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) {
        const errorData = await response.json();
        // Add permission debugging info to the error
        const permissionInfo = user?.permissions ? JSON.stringify(user.permissions) : 'No permissions found';
        const errorMessage = `${errorData.message || 'Failed to fetch users'}. Current user permissions: ${permissionInfo}`;
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching users');
      clientLogger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    setIsAddUserOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map((user: any) => user.id === updatedUser.id ? updatedUser : user));
    setIsEditUserOpen(false);
    setSelectedUser(null);
  };

  const handleUserDeleted = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      // Update user list and close dialog
      setUsers((prev) => prev.filter(user => user.id !== selectedUser.id));
      setSelectedUser(null);
      setIsDeleteUserOpen(false);
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Prepare to edit a user
  const prepareUserEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditUserOpen(true);
  };

  // Prepare to delete a user
  const prepareUserDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };

  // Helper function to check if a user has a specific permission
  const hasPermission = (user: User, permissionType: string) => {
    return !!user.permissions?.[permissionType as keyof typeof user.permissions]?.length;
  };

  // Inline styles for modal dialog
  const modalStyle = {
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    position: 'fixed' as const,
    top: '10vh',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    width: '95%',
    maxWidth: '500px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    padding: '20px'
  };

  // Overlay style
  const overlayStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 40
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsAddUserOpen(true)}>Add New User</Button>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading users...</p>}
          {error && <p className="text-red-500">{error}</p>}
          
          {!loading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actions</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>User Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>User Admin</TableHead>
                  <TableHead>Global Config</TableHead>
                  <TableHead>Customer Config</TableHead>
                  <TableHead>Vendors</TableHead>
                  <TableHead>Fulfillment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-4">
                      No users found. Click "Add New User" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <ActionDropdown
                          options={[
                            {
                              label: 'Edit',
                              onClick: () => prepareUserEdit(user),
                            },
                            {
                              label: 'Delete',
                              onClick: () => prepareUserDelete(user),
                              color: '#ef4444', // Red color for delete
                            },
                          ]}
                        />
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
                          ${user.userType === 'internal' ? 'bg-blue-100 text-blue-800' :
                            user.userType === 'customer' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'}`}>
                          {user.userType || 'internal'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.userType === 'customer' && user.customerId ? 'Customer Org' :
                         user.userType === 'vendor' && user.vendorId ? 'Vendor Org' :
                         user.userType === 'internal' ? 'GlobalRx' : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.permissions?.user_admin ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.permissions?.global_config ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.permissions?.customer_config || user.permissions?.customers ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.permissions?.vendors ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.permissions?.fulfillment ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Custom Add User Dialog */}
      {isAddUserOpen && (
        <>
          <div style={overlayStyle} onClick={() => setIsAddUserOpen(false)}></div>
          <div style={modalStyle}>
            <h2 className="text-lg font-bold mb-2">Add New User</h2>
            <p className="text-gray-500 mb-4">Create a new user account with specific permissions.</p>
            
            <UserForm 
              onSubmit={handleUserAdded} 
              onCancel={() => setIsAddUserOpen(false)}
            />
          </div>
        </>
      )}

      {/* Custom Edit User Dialog */}
      {isEditUserOpen && (
        <>
          <div style={overlayStyle} onClick={() => setIsEditUserOpen(false)}></div>
          <div style={modalStyle}>
            <h2 className="text-lg font-bold mb-2">Edit User</h2>
            <p className="text-gray-500 mb-4">Update user information and permissions.</p>
            
            <UserForm 
              user={selectedUser} 
              onSubmit={handleUserUpdated} 
              onCancel={() => {
                setIsEditUserOpen(false);
                setSelectedUser(null);
              }}
            />
          </div>
        </>
      )}

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user {selectedUser?.email}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUserDeleted}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}