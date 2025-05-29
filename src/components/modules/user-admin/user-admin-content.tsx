// src/components/modules/user-admin/user-admin-content.tsx
'use client';

import { useState, useEffect } from 'react';
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

export function UserAdminContent() {
  const [users, setUsers] = useState<User[]>([]);
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
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError('An error occurred while fetching users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAdded = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    setIsAddUserOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map(user => user.id === updatedUser.id ? updatedUser : user));
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
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Countries</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>DSX</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No users found. Click "Add New User" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasPermission(user, 'countries') ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasPermission(user, 'services') ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasPermission(user, 'dsx') ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasPermission(user, 'customers') ? (
                          <CheckIcon className="h-5 w-5 mx-auto" style={{ color: '#10b981' }} />
                        ) : (
                          <XIcon className="h-5 w-5 mx-auto" style={{ color: '#ef4444' }} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => prepareUserEdit(user)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => prepareUserDelete(user)}
                          >
                            Delete
                          </Button>
                        </div>
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